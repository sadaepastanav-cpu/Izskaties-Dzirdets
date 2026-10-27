import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import multer from 'multer';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || crypto.randomBytes(16).toString('hex');

// ==========================================
// 1. MAPES UN ŽURNĀLFAILU (LOGS) SISTĒMA
// ==========================================
const SECURE_DATA_DIR = path.resolve(process.cwd(), 'server_data');
const LOGS_DIR = path.join(SECURE_DATA_DIR, 'logs');
const LOG_FILE_PATH = path.join(LOGS_DIR, 'event.log');

if (!fs.existsSync(SECURE_DATA_DIR)) fs.mkdirSync(SECURE_DATA_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const logEvent = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

  if (level === 'ERROR') console.error(`❌ ${logLine.trim()}`);
  else if (level === 'WARN') console.warn(`⚠️ ${logLine.trim()}`);
  else console.log(`ℹ️ ${logLine.trim()}`);

  fs.stat(LOG_FILE_PATH, (err, stats) => {
    if (!err && stats && stats.size > 5 * 1024 * 1024) {
      fs.rename(LOG_FILE_PATH, path.join(LOGS_DIR, `event_${Date.now()}.log`), () => {});
    }
    fs.appendFile(LOG_FILE_PATH, logLine, () => {});
  });
};

// 🌟 GLOBĀLA AIZSARDZĪBA PRET SERVERA AVĀRIJĀM (SERVERIS NEKAD NENOKRĪT!)
process.on('uncaughtException', (err) => {
  logEvent('ERROR', `Nepārtverta sistēmas kļūda (uncaughtException): ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason: any) => {
  logEvent('ERROR', `Nepārtverts solījums (unhandledRejection): ${reason?.message || reason}`);
});

const atomicWriteJson = (filePath: string, data: any) => {
  const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).substring(7)}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err: any) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    logEvent('ERROR', `Atomārās saglabāšanas kļūda (${filePath}): ${err.message}`);
  }
};

logEvent('INFO', `Serveris inicializēts. Admin atslēga: ${process.env.ADMIN_API_KEY ? 'NO ENV' : ADMIN_API_KEY}`);

let publicTunnelUrl = '';
let tunnelProcess: ChildProcessWithoutNullStreams | null = null;

const MEDIA_ROOT_DIR = path.resolve(process.cwd(), '../../public/uploads');
let currentProjectPath = MEDIA_ROOT_DIR;
if (!fs.existsSync(currentProjectPath)) {
  fs.mkdirSync(currentProjectPath, { recursive: true });
}

const isSystemProtectedPath = (targetPath: string): boolean => {
  const normalized = path.resolve(targetPath).toLowerCase();
  const blockedPaths = [
    'c:\\windows',
    'c:\\windows\\system32',
    '/etc',
    '/bin',
    '/sbin',
    '/usr',
    '/var',
    '/sys',
    '/proc',
    '/dev'
  ];
  return blockedPaths.some((p) => normalized === p || normalized.startsWith(p + path.sep));
};

const safeResolve = (userFileName: string): string => {
  const safeBase = path.basename(userFileName);
  return path.join(currentProjectPath, safeBase);
};

// ==========================================
// 2. CORS UN RATE LIMITING
// ==========================================
const allowedOriginPatterns = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com$/
];

const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) callback(null, true);
      else callback(new Error('Bloķēts ar CORS drošības politiku'));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Pārāk daudz pieprasījumu. Lūdzu, uzgaidiet brīdi.' }
});

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  message: { error: 'Pārāk daudz augšupielāžu vienlaikus.' }
});

app.use('/api/', apiLimiter);

const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const incomingKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (incomingKey === ADMIN_API_KEY) {
    return next();
  }
  return res.status(403).json({ error: 'Piekļuve liegta: Nepieciešama derīga administratora atslēga.' });
};

const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

app.use('/project-media', (req, res, next) => {
  if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
    return res.status(404).send('Mape nav iestatīta vai neeksistē');
  }
  express.static(currentProjectPath)(req, res, next);
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(currentProjectPath)) fs.mkdirSync(currentProjectPath, { recursive: true });
    cb(null, currentProjectPath);
  },
  filename: (_req, file, cb) => {
    let cleanName = file.originalname;
    try {
      cleanName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch {}
    const safeName = path.basename(cleanName).replace(/\s+/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isExtAllowed = /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(file.originalname);
    if (isMimeAllowed || isExtAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Neatļauts faila tips!'));
    }
  }
});

const sanitizeCsvCell = (val: any): string => {
  const str = String(val ?? '');
  if (/^[=\+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

// ==========================================
// 🌟 UNIVERSĀLAIS ATBILŽU SALĪDZINĀTĀJS
// ==========================================
const isAnswerMatch = (userAns: string, correctAns: string, options: string[] = []): boolean => {
  if (!userAns || !correctAns) return false;
  const cleanUser = userAns.trim().toLowerCase();
  const cleanCorrect = correctAns.trim().toLowerCase();

  if (cleanUser === cleanCorrect) return true;

  const letterMatch = cleanCorrect.match(/^[a-f]$/);
  if (letterMatch) {
    const idx = letterMatch[0].charCodeAt(0) - 97;
    if (options[idx] && options[idx].trim().toLowerCase() === cleanUser) {
      return true;
    }
  }

  const userLetterMatch = cleanUser.match(/^[a-f]$/);
  if (userLetterMatch) {
    const idx = userLetterMatch[0].charCodeAt(0) - 97;
    if (options[idx] && options[idx].trim().toLowerCase() === cleanCorrect) {
      return true;
    }
  }

  return false;
};

// PUNKTIEM DERĪGIE JAUTĀJUMU TIPI
const SCORABLE_TYPES = ['QUESTION', 'QUIZ', 'MAJORITY', 'VOTE', 'ORDERING', 'BUZZER_RACE'];

// ==========================================
// SPĒLĒTĀJA UN SESIJAS STRUKTŪRA
// ==========================================
interface PlayerState {
  id: string;
  token?: string;
  socketId?: string;
  name: string;
  deviceNumber?: number;
  score: number;
  roundScore: number;
  lastQuestionScore: number;
  totalTimeMs: number;
  roundTimeMs: number;
  rank?: number | null;
  previousRank?: number | null;
  rankDelta?: number;
  isDisabled?: boolean;
  isBot?: boolean;
  teamName?: string;
  isCaptain?: boolean;
  missedQuestionsCount: number;
  contacts?: Record<string, string>;
}

const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, PlayerState>>();
const participants = new Map<string, Set<string>>();
const sessionHostTokens = new Map<string, string>();
const sessionTimers = new Map<string, NodeJS.Timeout>();

const sessionTeamPreviousRanks = new Map<string, Map<string, number>>();

const socketPlayerMap = new Map<string, { pin: string; playerId: string }>();
const playerIdToSocketMap = new Map<string, string>();

const snapshotDebounceTimers = new Map<string, NodeJS.Timeout>();
const lastAdvanceTimestamps = new Map<string, number>();
const voteBroadcastThrottleTimers = new Map<string, NodeJS.Timeout>();

const clearSessionTimer = (pin: string) => {
  if (sessionTimers.has(pin)) {
    clearTimeout(sessionTimers.get(pin)!);
    sessionTimers.delete(pin);
  }
};

const isHostAuthorized = (pin: string, token?: string): boolean => {
  if (!pin || !token) return false;
  return sessionHostTokens.get(pin) === token;
};

const sanitizeSceneForPlayer = (scene: any, subState: string) => {
  if (!scene) return null;
  const isReveal = (subState || '').toUpperCase() === 'REVEAL';

  const cleanScene = JSON.parse(JSON.stringify(scene));
  if (cleanScene.config) {
    if (cleanScene.config.correctAnswers && Array.isArray(cleanScene.config.correctAnswers)) {
      cleanScene.config.requiredCount = cleanScene.config.correctAnswers.length;
    }
    if (!isReveal) {
      delete cleanScene.config.correctAnswers;
      delete cleanScene.config.answerCorrectness;
      delete cleanScene.config.correctOrder;
    }
    delete cleanScene.config.notes;
  }
  return cleanScene;
};

// 🌟 STĀVOKĻA IZPLATĪŠANA (Ar atbalstu iesaldētajam laikam & pauzei)
const emitStateUpdate = (pin: string, scene: any, subState: string, extra: any = {}) => {
  const sanitized = sanitizeSceneForPlayer(scene, subState);
  const s = sessions.get(pin);
  const isBlackout = !!s?.isBlackout;

  const scenesList = s?.scenes || [];
  const currentIdx = s ? s.currentSceneIdx : 0;

  const totalQuestions = scenesList.filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;
  const isScorable = scene ? SCORABLE_TYPES.includes(scene.type) : false;
  const currentQuestionNum = scenesList
    .slice(0, currentIdx + 1)
    .filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;

  const payload = {
    ...sanitized,
    subState,
    isBlackout,
    isPaused: !!s?.isPaused,
    frozenRemainingMs: s?.frozenRemainingMs ?? (extra?.frozenRemainingMs !== undefined ? extra.frozenRemainingMs : null),
    pausedRemainingMs: s?.pausedRemainingMs ?? (extra?.pausedRemainingMs !== undefined ? extra.pausedRemainingMs : null),
    currentSceneIdx: currentIdx,
    totalScenes: scenesList.length,
    currentQuestionNum,
    totalQuestions,
    isScorable,
    ...extra
  };

  io.to(pin).emit('state-update', payload);

  const playersMap = sessionScores.get(pin);
  if (s) {
    const nextScene = s.scenes[s.currentSceneIdx + 1];
    const activeParticipants = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);

    io.to(`${pin}_host`).emit('host-state-update', {
      currentScene: scene,
      subState,
      isBlackout,
      isPaused: !!s?.isPaused,
      frozenRemainingMs: s?.frozenRemainingMs ?? (extra?.frozenRemainingMs !== undefined ? extra.frozenRemainingMs : null),
      pausedRemainingMs: s?.pausedRemainingMs ?? (extra?.pausedRemainingMs !== undefined ? extra.pausedRemainingMs : null),
      currentSceneIdx: s.currentSceneIdx,
      totalScenes: s.scenes.length,
      currentQuestionNum,
      totalQuestions,
      isScorable,
      nextSceneTitle: nextScene?.title || 'Spēles beigas',
      votedCount: s.votes?.length || 0,
      totalParticipantsCount: activeParticipants.length,
      hostName: s.hostName || '',
      allScenes: (s.scenes || []).map((sc: any, idx: number) => ({
        index: idx,
        id: sc.id,
        title: sc.title,
        type: sc.type,
        question: sc.config?.question,
        notes: sc.config?.notes
      })),
      ...extra
    });
  }
};

const executeSaveSnapshot = (pin: string) => {
  try {
    const state = sessions.get(pin);
    const scores = sessionScores.get(pin);
    const hostToken = sessionHostTokens.get(pin);
    if (!state) return;

    const cleanState = { ...state };
    delete (cleanState as any).activeTimerTimeout;

    const payload = {
      timestamp: new Date().toISOString(),
      pin,
      hostToken,
      hostName: state.hostName || '',
      questionsScored: state.questionsScored || 0,
      state: cleanState,
      scores: Array.from(scores?.entries() || [])
    };

    atomicWriteJson(path.join(SECURE_DATA_DIR, 'active_session.json'), payload);
    atomicWriteJson(path.join(SECURE_DATA_DIR, `snapshot_${pin}.json`), payload);
  } catch (err: any) {
    logEvent('ERROR', `Kļūda saglabājot snapshot sesijai ${pin}: ${err.message}`);
  }
};

const saveSnapshot = (pin: string, immediate: boolean = false) => {
  if (immediate) {
    if (snapshotDebounceTimers.has(pin)) {
      clearTimeout(snapshotDebounceTimers.get(pin)!);
      snapshotDebounceTimers.delete(pin);
    }
    executeSaveSnapshot(pin);
    return;
  }

  if (!snapshotDebounceTimers.has(pin)) {
    const timer = setTimeout(() => {
      snapshotDebounceTimers.delete(pin);
      executeSaveSnapshot(pin);
    }, 1000);
    snapshotDebounceTimers.set(pin, timer);
  }
};

const clearSnapshot = (pin: string) => {
  try {
    const activeFile = path.join(SECURE_DATA_DIR, 'active_session.json');
    const pinFile = path.join(SECURE_DATA_DIR, `snapshot_${pin}.json`);
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
    if (fs.existsSync(pinFile)) fs.unlinkSync(pinFile);
  } catch (err: any) {
    logEvent('WARN', `Kļūda dzēšot snapshot: ${err.message}`);
  }
};

const resetRoundScores = (pin: string) => {
  const playersMap = sessionScores.get(pin);
  if (playersMap) {
    playersMap.forEach((p) => {
      p.roundScore = 0;
      p.roundTimeMs = 0;
      p.lastQuestionScore = 0;
    });
  }
};

const getSortedLeaderboard = (
  playersMap: Map<string, PlayerState>,
  isRound: boolean = false,
  isInitialBaseline: boolean = false
): PlayerState[] => {
  const sorted = Array.from(playersMap.values())
    .filter((p) => !p.isDisabled)
    .sort((a, b) => {
      const scoreA = isRound ? a.roundScore || 0 : a.score || 0;
      const scoreB = isRound ? b.roundScore || 0 : b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = isRound ? a.roundTimeMs || 0 : a.totalTimeMs || 0;
      const timeB = isRound ? b.roundTimeMs || 0 : b.totalTimeMs || 0;
      return timeA - timeB;
    });

  return sorted.map((p, idx) => {
    const currentRank = idx + 1;
    let delta = 0;
    let prevRank = p.previousRank;

    if (!isInitialBaseline && p.previousRank !== null && p.previousRank !== undefined) {
      delta = p.previousRank - currentRank;
    } else {
      prevRank = null;
      delta = 0;
    }

    p.rank = currentRank;
    p.rankDelta = delta;

    return {
      ...p,
      rank: currentRank,
      previousRank: prevRank,
      rankDelta: delta
    };
  });
};

const getSortedTeamLeaderboard = (
  pin: string,
  playersMap: Map<string, PlayerState>,
  scoringMode: 'AVG' | 'SUM' = 'AVG',
  isRound: boolean = false,
  isInitialBaseline: boolean = false
) => {
  const teamsMap = new Map<string, { name: string; score: number; totalTimeMs: number; memberCount: number; members: string[] }>();

  playersMap.forEach((p) => {
    if (p.isDisabled || !p.teamName || p.teamName.trim() === '') return;
    const tName = p.teamName.trim();

    if (!teamsMap.has(tName)) {
      teamsMap.set(tName, {
        name: tName,
        score: 0,
        totalTimeMs: 0,
        memberCount: 0,
        members: []
      });
    }

    const t = teamsMap.get(tName)!;
    t.score += isRound ? (p.roundScore || 0) : (p.score || 0);
    t.totalTimeMs += isRound ? (p.roundTimeMs || 0) : (p.totalTimeMs || 0);
    t.memberCount++;
    t.members.push(p.name);
  });

  const prevTeamsMap = sessionTeamPreviousRanks.get(pin);

  return Array.from(teamsMap.values())
    .map((t) => ({
      name: t.name,
      score: scoringMode === 'AVG' && t.memberCount > 0 ? Math.round(t.score / t.memberCount) : t.score,
      rawScore: t.score,
      totalTimeMs: t.memberCount > 0 ? Math.round(t.totalTimeMs / t.memberCount) : 0,
      memberCount: t.memberCount,
      members: t.members
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalTimeMs - b.totalTimeMs;
    })
    .map((t, idx) => {
      const currentRank = idx + 1;
      let delta = 0;
      let prevRank: number | null = null;

      if (!isInitialBaseline && prevTeamsMap && prevTeamsMap.has(t.name)) {
        prevRank = prevTeamsMap.get(t.name)!;
        delta = prevRank - currentRank;
      }

      return {
        ...t,
        rank: currentRank,
        previousRank: prevRank,
        rankDelta: delta
      };
    });
};

const broadcastLeaderboardAndPersonalStats = (pin: string, isRound: boolean = false) => {
  const playersMap = sessionScores.get(pin);
  const session = sessions.get(pin);
  if (!playersMap || !session) return;

  const questionsScored = session.questionsScored || 0;
  const isInitialBaseline = questionsScored <= 1;

  const isRoundScene = session?.currentScene?.type === 'LEADERBOARD' && session?.currentScene?.config?.lbType === 'ROUND';
  const effectiveIsRound = isRound || isRoundScene;
  const lbType = effectiveIsRound ? 'ROUND' : (session?.currentScene?.config?.lbType || 'TOTAL');

  const sortedLb = getSortedLeaderboard(playersMap, effectiveIsRound, isInitialBaseline);
  const sortedTeams = getSortedTeamLeaderboard(pin, playersMap, session?.branding?.teamScoringMode || 'AVG', effectiveIsRound, isInitialBaseline);

  io.to(`${pin}_screens`).emit('leaderboard-update', { data: sortedLb, lbType });
  io.to(`${pin}_screens`).emit('team-leaderboard-update', { data: sortedTeams, lbType });
  io.to(`${pin}_host`).emit('leaderboard-update', { data: sortedLb, lbType });
  io.to(`${pin}_host`).emit('team-leaderboard-update', { data: sortedTeams, lbType });

  const totalPlayers = sortedLb.length;
  const totalTeams = sortedTeams.length;

  sortedLb.forEach((player) => {
    if (player.isBot) return;
    const targetSocketId = player.socketId || playerIdToSocketMap.get(player.id);
    if (!targetSocketId) return;

    let teamRank: number | null = null;
    let previousTeamRank: number | null = null;
    let teamRankDelta: number = 0;
    let teamData: any = null;

    if (player.teamName) {
      const tIdx = sortedTeams.findIndex((t) => t.name.toLowerCase() === player.teamName?.toLowerCase());
      if (tIdx !== -1) {
        teamData = sortedTeams[tIdx];
        teamRank = teamData.rank;
        previousTeamRank = teamData.previousRank;
        teamRankDelta = teamData.rankDelta;
      }
    }

    io.to(targetSocketId).emit('my-personal-stats', {
      myRank: player.rank,
      previousRank: player.previousRank,
      rankDelta: isInitialBaseline ? 0 : (player.rankDelta ?? 0),
      totalPlayers,
      score: player.score || 0,
      roundScore: player.roundScore || 0,
      lastQuestionScore: player.lastQuestionScore || 0,
      totalTimeMs: player.totalTimeMs || 0,
      roundTimeMs: player.roundTimeMs || 0,
      lbType,
      teamRank,
      previousTeamRank,
      teamRankDelta: isInitialBaseline ? 0 : teamRankDelta,
      totalTeams,
      teamScore: teamData?.score ?? null,
      teamName: player.teamName || '',
      isInitialBaseline
    });
  });
};

// ==========================================
// 3. CLOUDFLARE TUNELIS AR KĻŪDU DIAGNOSTIKU
// ==========================================
function startCloudflareTunnel(onReady?: (url: string) => void) {
  if (publicTunnelUrl) {
    if (onReady) onReady(publicTunnelUrl);
    return;
  }
  if (tunnelProcess) return;

  logEvent('INFO', '⏳ Mēģinām startēt Cloudflare tuneli uz portu 5173...');

  try {
    tunnelProcess = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:5173'], {
      shell: true
    });

    const handleOutput = (data: any) => {
      const output = data.toString();

      const isHarmlessStreamCancel = output.includes('error code 0') || output.includes('canceled by remote');
      if (!isHarmlessStreamCancel && (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed'))) {
        console.warn(`⚠️ Cloudflare ziņojums: ${output.trim()}`);
      }

      const match = output.match(/https:\/\/(?!api\.)([a-zA-Z0-9-]+)\.trycloudflare\.com/i);

      if (match && !publicTunnelUrl) {
        publicTunnelUrl = match[0];
        logEvent('INFO', `=========================================`);
        logEvent('INFO', `🚀 CLOUDFLARE TUNELIS GATAVS: ${publicTunnelUrl}`);
        logEvent('INFO', `=========================================`);

        io.emit('tunnel-ready', { url: publicTunnelUrl });
        if (onReady) onReady(publicTunnelUrl);

        sessions.forEach((sessionData, sessionPin) => {
          sessionData.connectionUrl = publicTunnelUrl;
          io.to(sessionPin).emit('connection-url-changed', publicTunnelUrl);
          saveSnapshot(sessionPin, true);
        });
      }
    };

    tunnelProcess.stdout?.on('data', handleOutput);
    tunnelProcess.stderr?.on('data', handleOutput);

    tunnelProcess.on('error', (err) => {
      logEvent('WARN', `Cloudflare rīks nav pieejams šajā datorā (${err.message}). Turpinām lokālajā tīklā.`);
      tunnelProcess = null;
      publicTunnelUrl = '';
    });

    tunnelProcess.on('close', (code) => {
      logEvent('INFO', `Cloudflare tunelis aizvērts (${code})`);
      tunnelProcess = null;
      publicTunnelUrl = '';
    });
  } catch (err: any) {
    logEvent('WARN', `Cloudflare izsaukuma kļūda: ${err.message}`);
    tunnelProcess = null;
  }
}

// ==========================================
// 4. BALSOŠANAS APSTRĀDE AR THROTTLING
// ==========================================
const triggerVotesUpdatedThrottled = (pin: string) => {
  if (voteBroadcastThrottleTimers.has(pin)) return;

  const timer = setTimeout(() => {
    voteBroadcastThrottleTimers.delete(pin);
    const s = sessions.get(pin);
    if (!s) return;

    const summary: Record<string, number> = {};
    s.votes.forEach((v: any) => {
      if (Array.isArray(v.optionIds)) {
        v.optionIds.forEach((o: string) => (summary[o] = (summary[o] || 0) + 1));
      }
    });

    const votedPlayerIds = s.votes.filter((v: any) => v.isComplete).map((v: any) => v.playerId);

    io.to(`${pin}_screens`).emit('votes-updated', { summary, votedCount: votedPlayerIds.length, votedPlayerIds });
    io.to(`${pin}_host`).emit('votes-updated', { summary, votedCount: votedPlayerIds.length, votedPlayerIds });
    io.to(`${pin}_players`).emit('votes-updated', { summary, votedCount: votedPlayerIds.length });
  }, 250);

  voteBroadcastThrottleTimers.set(pin, timer);
};

const handleVote = (
  pin: string,
  answers: string[],
  playerId: string,
  category?: 'TOP' | 'BOTTOM' | 'SINGLE'
) => {
  const s = sessions.get(pin);
  const playersMap = sessionScores.get(pin);
  const player = playersMap?.get(playerId);
  if (!s || !player || player.isDisabled) return;

  const activeParticipantsCount = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled).length;

  if (s.subState === 'ACTIVE') {
    const now = Date.now();
    const timeSpentMs = Math.max(0, now - (s.questionStartTime || now));
    const isMusicMode = s.currentScene?.config?.playerUIMode === 'MUSIC_DUAL';

    // ⚡ ĀTRĀ PULTS (BUZZER RACE)
    if (s.currentScene?.type === 'BUZZER_RACE') {
      if (!s.buzzerRaceWinners) s.buzzerRaceWinners = [];
      const maxQueue = s.currentScene.config?.buzzerMaxQueue || 5;
      const isBuzzOnly = answers.includes('BUZZ');

      if (isBuzzOnly) {
        const alreadyInQueue = s.buzzerRaceWinners.some((w: any) => w.playerId === playerId);
        if (alreadyInQueue || s.buzzerRaceWinners.length >= maxQueue) return;

        const position = s.buzzerRaceWinners.length + 1;
        const winnerData = {
          position,
          playerId,
          name: player.name,
          deviceNumber: player.deviceNumber || 1,
          teamName: player.teamName || '',
          timeSpentMs,
          status: position === 1 ? 'ACTIVE' : 'QUEUED',
          submittedAnswers: []
        };
        s.buzzerRaceWinners.push(winnerData);

        io.to(pin).emit('buzzer-race-press', { winner: winnerData, allWinners: s.buzzerRaceWinners });
        if (position === 1) io.to(pin).emit('play-sfx', { sfx: 'buzzer_hit' });
        saveSnapshot(pin, true);
        return;
      }

      const activeWinner = s.buzzerRaceWinners.find((w: any) => w.playerId === playerId && w.status === 'ACTIVE');
      if (activeWinner && !isBuzzOnly) {
        activeWinner.submittedAnswers = answers;

        const config = s.currentScene.config || {};
        const correctAnswers = config.correctAnswers || [];
        const opts = config.options || [];
        const isCorrect = correctAnswers.some((ans: string) =>
          answers.some((userAns: string) => isAnswerMatch(userAns, ans, opts))
        );

        if (config.buzzerEvaluationMode !== 'MANUAL') {
          const questionsScored = s.questionsScored || 0;
          if (questionsScored >= 1) {
            const preLb = getSortedLeaderboard(playersMap, false, false);
            preLb.forEach((p, idx) => {
              const org = playersMap.get(p.id);
              if (org) org.previousRank = idx + 1;
            });
            const preTeams = getSortedTeamLeaderboard(pin, playersMap, s?.branding?.teamScoringMode || 'AVG', false, false);
            const teamPrevMap = new Map<string, number>();
            preTeams.forEach((t, idx) => teamPrevMap.set(t.name, idx + 1));
            sessionTeamPreviousRanks.set(pin, teamPrevMap);
          }

          const maxPts = config.pointsMax ?? config.points ?? 10;
          const awarded = isCorrect ? maxPts : 0;

          player.lastQuestionScore = awarded;
          player.score = (player.score || 0) + awarded;
          player.roundScore = (player.roundScore || 0) + awarded;
          player.totalTimeMs = (player.totalTimeMs || 0) + timeSpentMs;
          player.roundTimeMs = (player.roundTimeMs || 0) + timeSpentMs;

          s.questionsScored = (s.questionsScored || 0) + 1;

          io.to(pin).emit('play-sfx', { sfx: isCorrect ? 'correct' : 'wrong' });
          broadcastLeaderboardAndPersonalStats(pin, false);

          clearSessionTimer(pin);
          s.subState = 'REVEAL';
          s.isRevealed = true;
          emitStateUpdate(pin, s.currentScene, 'REVEAL', { isRevealed: true });
          io.to(pin).emit('results-revealed', { correctAnswers });
          saveSnapshot(pin, true);
        }
        return;
      }
      return;
    }

    // 🎵 MUZIKĀLĀ SPĒLE (MUSIC_DUAL)
    if (isMusicMode) {
      let vote = s.votes.find((v: any) => v.playerId === playerId);
      if (!vote) {
        vote = {
          playerId,
          optionIds: [],
          topAnswer: null,
          topTimeSpentMs: null,
          bottomAnswer: null,
          bottomTimeSpentMs: null,
          timeReceived: now,
          timeSpentMs: timeSpentMs,
          isComplete: false
        };
        s.votes.push(vote);
      }

      if (category === 'TOP' && answers[0]) {
        vote.topAnswer = answers[0];
        vote.topTimeSpentMs = timeSpentMs;
      } else if (category === 'BOTTOM' && answers[0]) {
        vote.bottomAnswer = answers[0];
        vote.bottomTimeSpentMs = timeSpentMs;
      } else if (answers.length >= 2) {
        vote.topAnswer = answers[0];
        vote.topTimeSpentMs = vote.topTimeSpentMs ?? timeSpentMs;
        vote.bottomAnswer = answers[1];
        vote.bottomTimeSpentMs = timeSpentMs;
      } else if (answers.length === 1 && !vote.topAnswer) {
        vote.topAnswer = answers[0];
        vote.topTimeSpentMs = timeSpentMs;
      } else if (answers.length === 1 && vote.topAnswer) {
        vote.bottomAnswer = answers[0];
        vote.bottomTimeSpentMs = timeSpentMs;
      }

      const activeOptList: string[] = [];
      if (vote.topAnswer) activeOptList.push(vote.topAnswer);
      if (vote.bottomAnswer) activeOptList.push(vote.bottomAnswer);
      vote.optionIds = activeOptList;

      vote.isComplete = Boolean(vote.topAnswer && vote.bottomAnswer);
      vote.timeSpentMs = Math.max(vote.topTimeSpentMs || timeSpentMs, vote.bottomTimeSpentMs || timeSpentMs);

      triggerVotesUpdatedThrottled(pin);

      // 🌟 JA VISI NOBALSOJUŠI ĀTRĀK — IESALDĒJAM ATLIKUŠO LAIKU!
      const completeVotesCount = s.votes.filter((v: any) => v.isComplete).length;
      const isFullTimeMode = s.branding?.timerMode === 'FULL_TIME';
      if (!isFullTimeMode && activeParticipantsCount > 0 && completeVotesCount >= activeParticipantsCount) {
        clearSessionTimer(pin);
        const remainingTimeMs = Math.max(0, (s.currentScene?.endTime || 0) - Date.now());
        s.frozenRemainingMs = remainingTimeMs;
        s.subState = 'STATS';
        emitStateUpdate(pin, s.currentScene, 'STATS', { frozenRemainingMs: remainingTimeMs });
        io.to(pin).emit('video-command', 'pause');
        saveSnapshot(pin, true);
      }
      return;
    }

    // 🅰️ STANDARTA BALSOŠANA
    const existingIndex = s.votes.findIndex((v: any) => v.playerId === playerId);
    if (existingIndex !== -1) {
      const existingVote = s.votes[existingIndex];
      const mergedOptions = Array.from(new Set([...existingVote.optionIds, ...answers]));
      existingVote.optionIds = mergedOptions;
      existingVote.timeReceived = now;
      existingVote.timeSpentMs = timeSpentMs;
      existingVote.isComplete = true;
    } else {
      s.votes.push({
        optionIds: answers,
        playerId,
        timeReceived: now,
        timeSpentMs,
        isComplete: true
      });
    }

    triggerVotesUpdatedThrottled(pin);

    // 🌟 JA VISI NOBALSOJUŠI ĀTRĀK — IESALDĒJAM ATLIKUŠO LAIKU!
    const completeVotesCount = s.votes.filter((v: any) => v.isComplete).length;
    const isFullTimeMode = s.branding?.timerMode === 'FULL_TIME';
    if (!isFullTimeMode && activeParticipantsCount > 0 && completeVotesCount >= activeParticipantsCount) {
      clearSessionTimer(pin);
      const remainingTimeMs = Math.max(0, (s.currentScene?.endTime || 0) - Date.now());
      s.frozenRemainingMs = remainingTimeMs;
      s.subState = 'STATS';
      emitStateUpdate(pin, s.currentScene, 'STATS', { frozenRemainingMs: remainingTimeMs });
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin, true);
    }
  }
};

// ==========================================
// 🌟 UNIVERSIĀLAIS BOTU BALSOŠANAS DZINĒJS
// ==========================================
const triggerBotVotes = (pin: string) => {
  const s = sessions.get(pin);
  const playersMap = sessionScores.get(pin);
  if (!s || !playersMap || s.subState !== 'ACTIVE') return;

  const currentScene = s.currentScene;
  if (!currentScene) return;

  if (!SCORABLE_TYPES.includes(currentScene.type)) return;

  const dur = currentScene.config?.duration || currentScene.config?.timeLimit || 30;
  const rawOptions = currentScene.config?.options || [];
  const optCount = currentScene.config?.optionsCount || (rawOptions.length > 0 ? rawOptions.length : 4);
  const letterList = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, optCount);
  const validChoicePool = letterList.map((letter, idx) => {
    const optText = rawOptions[idx];
    return (optText && typeof optText === 'string' && optText.trim() !== '') ? optText : letter;
  });

  const isMusicMode = currentScene.config?.playerUIMode === 'MUSIC_DUAL';
  const isOrdering = currentScene.type === 'ORDERING';

  playersMap.forEach((p, id) => {
    if (p.isBot && !p.isDisabled) {
      const delay = Math.random() * Math.max(0.8, dur - 1.5) * 1000;
      setTimeout(() => {
        const currentSession = sessions.get(pin);
        if (currentSession?.subState === 'ACTIVE') {
          if (isOrdering) {
            const shuffled = [...validChoicePool].sort(() => Math.random() - 0.5);
            handleVote(pin, shuffled, id);
          } else if (isMusicMode) {
            const topPool = validChoicePool.slice(0, 3);
            const bottomPool = validChoicePool.slice(3, 6);
            const topChoice = topPool[Math.floor(Math.random() * topPool.length)] || 'A';
            const bottomChoice = bottomPool[Math.floor(Math.random() * bottomPool.length)] || 'D';
            handleVote(pin, [topChoice, bottomChoice], id);
          } else {
            const selectedOption = [validChoicePool[Math.floor(Math.random() * validChoicePool.length)]];
            handleVote(pin, selectedOption, id);
          }
        }
      }, delay);
    }
  });
};

// ==========================================
// 5. REST API MARŠRUTI
// ==========================================
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body || {};
  if (password && (password === ADMIN_PASSWORD || password === ADMIN_API_KEY)) {
    logEvent('INFO', 'Veiksmīga administratora autorizācija no IP: ' + req.ip);
    return res.json({ success: true, adminKey: ADMIN_API_KEY });
  }
  logEvent('WARN', 'Neveiksmīgs administratora autorizācijas mēģinājums no IP: ' + req.ip);
  return res.status(401).json({ success: false, error: 'Nepareiza administratora parole!' });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    activeSessions: sessions.size,
    tunnelUrl: publicTunnelUrl || null,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/tunnel-url', (_req, res) => res.json({ tunnelUrl: publicTunnelUrl }));
app.get('/api/network-ip', (_req, res) => res.json({ localIp: getLocalIpAddress(), tunnelUrl: publicTunnelUrl }));

app.get('/api/session-branding/:pin', (req, res) => {
  const session = sessions.get(req.params.pin);
  if (session && session.branding) {
    return res.json({ success: true, branding: session.branding, connectionUrl: session.connectionUrl || publicTunnelUrl });
  }
  res.status(404).json({ success: false, error: 'Sesija nav atrasta' });
});

app.get('/api/current-path', requireAdminAuth, (_req, res) => res.json({ currentPath: currentProjectPath }));

app.post('/api/set-path', requireAdminAuth, (req, res) => {
  try {
    const rawPath = req.body?.path;
    if (typeof rawPath === 'string' && rawPath.trim()) {
      const cleaned = rawPath.trim().replace(/^["']|["']$/g, '');
      const resolved = path.resolve(path.normalize(cleaned));

      if (isSystemProtectedPath(resolved)) {
        return res.status(400).json({ error: 'Kļūda: Sistēmas mapes (piem., Windows) nav atļauts izmantot kā mediju mapi.' });
      }

      currentProjectPath = resolved;
    }

    if (!fs.existsSync(currentProjectPath)) {
      fs.mkdirSync(currentProjectPath, { recursive: true });
    }

    const allFiles = fs.readdirSync(currentProjectPath);
    const projects = allFiles.filter(
      (f) => f.toLowerCase().endsWith('.json') && !f.toLowerCase().includes('snapshot') && !f.toLowerCase().includes('active_session')
    );
    const media = allFiles.filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );

    res.json({ success: true, currentPath: currentProjectPath, projects, media });
  } catch (err: any) {
    res.status(500).json({ error: 'Kļūda piekļūstot mapei: ' + err.message });
  }
});

app.get('/api/media-list', requireAdminAuth, (_req, res) => {
  try {
    if (!currentProjectPath || !fs.existsSync(currentProjectPath)) return res.json([]);
    const files = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    res.json(files);
  } catch {
    res.status(500).json({ error: 'Kļūda nolasot medijus' });
  }
});

app.post('/api/upload-media', requireAdminAuth, uploadLimiter, upload.single('mediaFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nav faila vai neatļauts formāts' });
  const files = fs.readdirSync(currentProjectPath).filter((f) =>
    /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
  );
  res.json({ success: true, fileName: req.file.filename, files });
});

app.get('/api/load-project/:name', requireAdminAuth, (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name);
    const fileName = rawName.toLowerCase().endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = safeResolve(fileName);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      res.json(JSON.parse(content));
    } else {
      res.status(404).json({ error: `Fails nav atrasts: ${filePath}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Kļūda nolasot failu: ' + err.message });
  }
});

app.post('/api/save-to-file', requireAdminAuth, (req, res) => {
  try {
    const rawName = req.body.fileName || 'project';
    const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = safeResolve(fileName);
    atomicWriteJson(filePath, req.body.data);
    logEvent('INFO', `Projekts saglabāts atomāri: ${path.basename(filePath)}`);
    res.json({ success: true, fileName: path.basename(filePath), fullPath: filePath });
  } catch (err: any) {
    res.status(500).json({ error: 'Neizdevās saglabāt: ' + err.message });
  }
});

app.get('/api/check-recovery', (_req, res) => {
  const p1 = path.join(SECURE_DATA_DIR, 'active_session.json');
  if (fs.existsSync(p1)) {
    try {
      const data = JSON.parse(fs.readFileSync(p1, 'utf-8'));
      res.json({
        canRecover: true,
        pin: data.pin,
        title: data.state?.currentScene?.title || 'Saglabātā Sesija'
      });
    } catch {
      res.json({ canRecover: false });
    }
  } else {
    res.json({ canRecover: false });
  }
});

app.post('/api/recover-session', requireAdminAuth, (_req, res) => {
  const p1 = path.join(SECURE_DATA_DIR, 'active_session.json');
  if (fs.existsSync(p1)) {
    try {
      const data = JSON.parse(fs.readFileSync(p1, 'utf-8'));
      sessions.set(data.pin, data.state);
      sessionScores.set(data.pin, new Map(data.scores));
      if (data.hostToken) sessionHostTokens.set(data.pin, data.hostToken);
      if (!participants.has(data.pin)) participants.set(data.pin, new Set());
      logEvent('INFO', `Sesija atjaunota no snapshot: PIN ${data.pin}`);
      res.json({ success: true, pin: data.pin, state: data.state, hostToken: data.hostToken });
    } catch {
      res.status(500).json({ error: 'Kļūda atjaunojot sesiju' });
    }
  } else {
    res.status(404).json({ error: 'Nav saglabātas sesijas' });
  }
});

app.get('/api/export-csv/:pin', requireAdminAuth, (req, res) => {
  const { pin } = req.params;
  const playersMap = sessionScores.get(pin);
  const session = sessions.get(pin);
  const isTeamMode = !!session?.branding?.teamModeEnabled;
  const hostName = session?.hostName || 'Nav norādīts';

  if (!playersMap || playersMap.size === 0) {
    return res.status(404).json({ error: 'Šai sesijai nav atrasti spēlētāju dati.' });
  }

  const contactScenes = (session?.scenes || []).filter((sc: any) => sc.type === 'CONTACTS');
  const contactFieldDefs: { id: string; label: string }[] = [];
  const seenContactIds = new Set<string>();

  contactScenes.forEach((sc: any) => {
    (sc.config?.contactFields || []).forEach((f: any) => {
      if (!seenContactIds.has(f.id)) {
        seenContactIds.add(f.id);
        contactFieldDefs.push({ id: f.id, label: f.label || f.id });
      }
    });
  });

  playersMap.forEach((p) => {
    if (p.contacts) {
      Object.keys(p.contacts).forEach((k) => {
        if (!seenContactIds.has(k)) {
          seenContactIds.add(k);
          contactFieldDefs.push({ id: k, label: k });
        }
      });
    }
  });

  const sortedList = getSortedLeaderboard(playersMap, false, false);

  let csvContent = '\uFEFF';
  csvContent += `# Spēles atskaite • PIN: ${pin} • Vadītājs: ${hostName} • Datums: ${new Date().toLocaleDateString('lv-LV')}\n`;

  let baseHeader = isTeamMode
    ? 'Vieta;Dinamika;Pults #;Vārds;Komanda;Kopējie Punkti;Kārtas Punkti;Pēdējais Jautājums;Apdomas Laiks (s);Milisekundes;Statuss'
    : 'Vieta;Dinamika;Pults #;Vārds;Kopējie Punkti;Kārtas Punkti;Pēdējais Jautājums;Apdomas Laiks (s);Milisekundes;Statuss';

  if (contactFieldDefs.length > 0) {
    baseHeader += ';' + contactFieldDefs.map((f) => sanitizeCsvCell(f.label)).join(';');
  }
  csvContent += baseHeader + '\n';

  sortedList.forEach((p) => {
    const seconds = ((p.totalTimeMs || 0) / 1000).toFixed(2);
    const status = p.isDisabled ? 'Atslēgts' : p.isBot ? 'Bots' : 'Aktīvs';
    const deltaStr = p.rankDelta && p.rankDelta > 0 ? `+${p.rankDelta}` : p.rankDelta && p.rankDelta < 0 ? `${p.rankDelta}` : '=';

    const safeName = sanitizeCsvCell(p.name);
    const safeTeam = sanitizeCsvCell(p.teamName);

    let row = isTeamMode
      ? `${p.rank || '-'};${deltaStr};${p.deviceNumber || '-'};${safeName};${safeTeam};${p.score || 0};${p.roundScore || 0};${p.lastQuestionScore || 0};${seconds};${p.totalTimeMs || 0};${status}`
      : `${p.rank || '-'};${deltaStr};${p.deviceNumber || '-'};${safeName};${p.score || 0};${p.roundScore || 0};${p.lastQuestionScore || 0};${seconds};${p.totalTimeMs || 0};${status}`;

    if (contactFieldDefs.length > 0) {
      const contactVals = contactFieldDefs.map((f) => sanitizeCsvCell(p.contacts?.[f.id] || ''));
      row += ';' + contactVals.join(';');
    }
    csvContent += row + '\n';
  });

  logEvent('INFO', `CSV eksports sesijai: PIN ${pin} (Vadītājs: ${hostName}) ar ${contactFieldDefs.length} kontaktu laukiem`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=rezultati_sesija_${pin}.csv`);
  return res.send(csvContent);
});

app.get('/host-remote', (req, res) => {
  const localIp = getLocalIpAddress();
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  res.redirect(`http://${localIp}:5173/host-remote${queryStr}`);
});

// ==========================================
// 6. SOCKET.IO REĀLLAIKA DZINĒJS
// ==========================================
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 10000,
  perMessageDeflate: false
});

io.on('connection', (socket: Socket) => {
  if (publicTunnelUrl) {
    socket.emit('tunnel-ready', { url: publicTunnelUrl });
  }

  socket.on('host:toggle-blackout', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s) {
      s.isBlackout = !s.isBlackout;
      io.to(pin).emit('blackout-toggled', s.isBlackout);
      io.to(`${pin}_host`).emit('blackout-toggled', s.isBlackout);
      saveSnapshot(pin, true);
      logEvent('INFO', `Skatuves Blackout režīms: ${s.isBlackout ? 'IESLĒGTS' : 'IZSLĒGTS'} (PIN ${pin})`);
    }
  });

  socket.on('host:set-theme', (data: { pin: string; hostToken: string; theme: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s) {
      if (!s.branding) s.branding = {};
      s.branding.presentationTheme = data.theme;
      io.to(pin).emit('theme-changed', data.theme);
      io.to(pin).emit('session-branding', s.branding);
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:join-remote', (data: { pin: string; hostToken: string; hostName?: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) {
      return socket.emit('error-message', 'Neautorizēta vadītāja piekļuve!');
    }

    socket.join(pin);
    socket.join(`${pin}_host`);
    socket.join(`${pin}_screens`);

    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    if (data.hostName && data.hostName.trim()) {
      s.hostName = data.hostName.trim();
    }

    const nextScene = s.scenes[s.currentSceneIdx + 1];
    const activeParticipants = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);

    const scList = s.scenes || [];
    const curIdx = s.currentSceneIdx;
    const totalQuestions = scList.filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;
    const isScorable = s.currentScene ? SCORABLE_TYPES.includes(s.currentScene.type) : false;
    const currentQuestionNum = scList
      .slice(0, curIdx + 1)
      .filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;

    socket.emit('host-state-update', {
      currentScene: s.currentScene,
      subState: s.subState,
      isBlackout: !!s.isBlackout,
      isPaused: !!s.isPaused,
      frozenRemainingMs: s.frozenRemainingMs ?? null,
      pausedRemainingMs: s.pausedRemainingMs ?? null,
      currentSceneIdx: s.currentSceneIdx,
      totalScenes: s.scenes.length,
      currentQuestionNum,
      totalQuestions,
      isScorable,
      nextSceneTitle: nextScene?.title || 'Spēles beigas',
      votedCount: s.votes?.length || 0,
      totalParticipantsCount: activeParticipants.length,
      hostName: s.hostName || '',
      allScenes: (s.scenes || []).map((sc: any, idx: number) => ({
        index: idx,
        id: sc.id,
        title: sc.title,
        type: sc.type,
        question: sc.config?.question,
        notes: sc.config?.notes
      }))
    });

    io.to(pin).emit('host-remote-connected', { success: true });
  });

  socket.on('host:set-name', (data: { pin: string; hostToken: string; hostName: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && data.hostName) {
      s.hostName = data.hostName.trim();
      saveSnapshot(pin);
    }
  });

  socket.on('host:jump-to-scene', (data: { pin: string; hostToken: string; sceneIndex: number }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (!s || !s.scenes || data.sceneIndex < 0 || data.sceneIndex >= s.scenes.length) return;

    clearSessionTimer(pin);
    if (s.currentScene?.type === 'LEADERBOARD') resetRoundScores(pin);

    s.currentSceneIdx = data.sceneIndex;
    s.currentScene = s.scenes[s.currentSceneIdx];
    s.subState = 'READY';
    s.votes = [];
    s.buzzerRaceWinners = [];
    s.isPaused = false;
    s.pausedRemainingMs = 0;
    s.frozenRemainingMs = null;
    s.isRevealed = false;
    s.slideLoadedTime = Date.now();
    delete s.summaryStats;

    emitStateUpdate(pin, s.currentScene, 'READY');
    saveSnapshot(pin, true);
  });

  socket.on('host:start-tunnel', (_data?: { pin?: string; hostToken?: string; adminKey?: string }) => {
    startCloudflareTunnel((url) => {
      socket.emit('tunnel-ready', { url });
    });
  });

  socket.on('host:play-sfx', (data: { pin: string; hostToken: string; sfx: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    io.to(pin).emit('play-sfx', { sfx: data.sfx });
  });

  socket.on('host:award-buzzer-points', (data: { pin: string; hostToken: string; playerId: string; points: number }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const players = sessionScores.get(pin);
    const s = sessions.get(pin);
    if (players && players.has(data.playerId)) {
      const questionsScored = s?.questionsScored || 0;
      if (questionsScored >= 1) {
        const preLb = getSortedLeaderboard(players, false, false);
        preLb.forEach((p, idx) => {
          const org = players.get(p.id);
          if (org) org.previousRank = idx + 1;
        });
      }

      const p = players.get(data.playerId)!;
      p.lastQuestionScore = data.points;
      p.score = (p.score || 0) + data.points;
      p.roundScore = (p.roundScore || 0) + data.points;

      if (s) s.questionsScored = (s.questionsScored || 0) + 1;

      io.to(pin).emit('play-sfx', { sfx: data.points > 0 ? 'correct' : 'wrong' });
      broadcastLeaderboardAndPersonalStats(pin, false);
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:buzzer-pass-next', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.buzzerRaceWinners && s.buzzerRaceWinners.length > 0) {
      const currentWinner = s.buzzerRaceWinners.find((w: any) => w.status === 'ACTIVE');
      if (currentWinner) currentWinner.status = 'PASSED';

      const nextWinner = s.buzzerRaceWinners.find((w: any) => w.status === 'QUEUED');
      if (nextWinner) {
        nextWinner.status = 'ACTIVE';
        io.to(pin).emit('buzzer-race-press', { winner: nextWinner, allWinners: s.buzzerRaceWinners });
        io.to(pin).emit('play-sfx', { sfx: 'buzzer_hit' });
      } else {
        io.to(pin).emit('buzzer-race-press', { winner: null, allWinners: s.buzzerRaceWinners });
      }
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:buzzer-reopen', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.currentScene?.type === 'BUZZER_RACE') {
      s.buzzerRaceWinners = [];
      s.subState = 'ACTIVE';
      s.questionStartTime = Date.now();
      const dur = s.currentScene?.config?.duration || 30;
      s.currentScene.endTime = Date.now() + dur * 1000;
      s.frozenRemainingMs = null;
      s.isPaused = false;

      emitStateUpdate(pin, s.currentScene, 'ACTIVE');
      io.to(pin).emit('buzzer-race-press', { winner: null, allWinners: [] });
      io.to(pin).emit('play-sfx', { sfx: 'suspense' });
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:create-session', (data: any) => {
    let pin = data.existingPin;
    if (!pin) {
      do {
        pin = Math.floor(1000 + Math.random() * 9000).toString();
      } while (sessions.has(pin));
    }

    const finalUrl = data.connectionUrl || publicTunnelUrl || `http://${getLocalIpAddress()}:5173`;
    const hostToken = sessionHostTokens.get(pin) || crypto.randomBytes(16).toString('hex');

    const sessionData = {
      currentSceneIdx: -1,
      scenes: data.projectData?.scenes || [],
      branding: data.projectData?.branding || {},
      connectionUrl: finalUrl,
      subState: 'IDLE',
      isBlackout: false,
      questionsScored: 0,
      slideLoadedTime: Date.now(),
      votes: [],
      buzzerRaceWinners: [],
      currentScene: null,
      isRevealed: false,
      revealReadyToAdvance: false,
      currentPaging: 0,
      finalPodiumStage: 0,
      finalLeaderboardView: data.projectData?.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL',
      questionStartTime: 0,
      isPaused: false,
      pausedRemainingMs: 0,
      frozenRemainingMs: null,
      hostName: ''
    };

    sessions.set(pin, sessionData);
    sessionHostTokens.set(pin, hostToken);
    if (!sessionScores.has(pin)) sessionScores.set(pin, new Map());
    if (!participants.has(pin)) participants.set(pin, new Set());
    if (!sessionTeamPreviousRanks.has(pin)) sessionTeamPreviousRanks.set(pin, new Map());

    socket.join(pin);
    socket.join(`${pin}_host`);
    socket.join(`${pin}_screens`);
    socket.emit('session-info', { pin, hostToken, state: sessionData });
    logEvent('INFO', `Izveidota jauna spēles sesija: PIN ${pin}`);
    saveSnapshot(pin, true);
  });

  // 🌟 PAUZE: Nofiksējam atlikušo laiku un nosūtam visiem
  socket.on('host:pause-session', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.subState === 'ACTIVE') {
      clearSessionTimer(pin);
      s.isPaused = true;
      s.pausedRemainingMs = Math.max(0, (s.currentScene?.endTime || 0) - Date.now());
      s.subState = 'PAUSED';

      emitStateUpdate(pin, s.currentScene, 'PAUSED', {
        pausedRemainingMs: s.pausedRemainingMs,
        isPaused: true
      });
      io.to(pin).emit('session-paused');
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin, true);
    }
  });

  // 🌟 ATSĀKT: Turpinām no precīzām nopauzētajām milisekundēm
  socket.on('host:resume-session', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.subState === 'PAUSED') {
      s.isPaused = false;
      s.subState = 'ACTIVE';
      const remainingMs = s.pausedRemainingMs || 10000;
      s.currentScene.endTime = Date.now() + remainingMs;

      emitStateUpdate(pin, s.currentScene, 'ACTIVE', {
        endTime: s.currentScene.endTime,
        isPaused: false
      });
      io.to(pin).emit('session-resumed');
      io.to(pin).emit('video-command', 'play');

      clearSessionTimer(pin);
      const timer = setTimeout(() => {
        const currentSession = sessions.get(pin);
        if (currentSession?.subState === 'ACTIVE') {
          currentSession.subState = 'STATS';
          currentSession.frozenRemainingMs = 0;
          if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
          emitStateUpdate(pin, currentSession.currentScene, 'STATS', { frozenRemainingMs: 0 });
          io.to(pin).emit('video-command', 'pause');
          saveSnapshot(pin, true);
        }
      }, remainingMs);
      sessionTimers.set(pin, timer);
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:restart-scene', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.currentScene) {
      clearSessionTimer(pin);
      s.votes = [];
      s.buzzerRaceWinners = [];
      s.isPaused = false;
      s.pausedRemainingMs = 0;
      s.frozenRemainingMs = null;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.subState = 'READY';
      s.slideLoadedTime = Date.now();

      emitStateUpdate(pin, s.currentScene, 'READY');
      triggerVotesUpdatedThrottled(pin);
      logEvent('INFO', `Restartēts jautājums sesijā: PIN ${pin}`);
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:end-session', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;

    clearSessionTimer(pin);
    io.to(pin).emit('session-ended');
    clearSnapshot(pin);
    sessions.delete(pin);
    sessionScores.delete(pin);
    participants.delete(pin);
    sessionHostTokens.delete(pin);
    sessionTeamPreviousRanks.delete(pin);
    logEvent('INFO', `Sesija pabeigta un slēgta: PIN ${pin}`);
  });

  socket.on('get-branding', (data: { pin: string }) => {
    const cleanPin = String(data?.pin || '').trim();
    const s = sessions.get(cleanPin);
    if (s?.branding) {
      socket.emit('session-branding', s.branding);
    }
  });

  socket.on('participant:test-buzzer', (data: { pin: string; playerId: string }) => {
    io.to(data.pin).emit('player-buzzer-test', { playerId: data.playerId });
  });

  socket.on('host:toggle-team-view', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (!s) return;

    if (!s.finalLeaderboardView) {
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
    }
    s.finalLeaderboardView = s.finalLeaderboardView === 'TEAMS' ? 'INDIVIDUAL' : 'TEAMS';
    s.currentPaging = 0;

    io.to(pin).emit('toggle-team-leaderboard', { view: s.finalLeaderboardView, page: 0 });
    saveSnapshot(pin, true);
  });

  socket.on('host:toggle-qr-zoom', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    io.to(pin).emit('toggle-large-qr');
  });

  socket.on('host:update-player', (data: any) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const players = sessionScores.get(pin);
    if (players && players.has(data.playerId)) {
      const p = players.get(data.playerId)!;
      if (data.name !== undefined) p.name = data.name;
      if (data.teamName !== undefined) p.teamName = data.teamName;
      if (data.score !== undefined) p.score = Number(data.score);
      if (data.totalTimeMs !== undefined) p.totalTimeMs = Number(data.totalTimeMs);
      if (data.isDisabled !== undefined) p.isDisabled = data.isDisabled;

      io.to(`${pin}_screens`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      io.to(`${pin}_host`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      io.to(`${pin}_players`).emit('presence-update', { count: players.size });

      broadcastLeaderboardAndPersonalStats(pin, false);
      saveSnapshot(pin);
    }
  });

  socket.on('host:simulate-players', (data: { pin: string; hostToken: string; count: number }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const players = sessionScores.get(pin);
    const session = sessions.get(pin);
    if (!players) return;

    const isTeamMode = !!session?.branding?.teamModeEnabled;
    const sampleTeams = [
      '1. Galdiņš', '2. Galdiņš', '3. Galdiņš', '4. Galdiņš', '5. Galdiņš',
      'VIP Galdiņš', 'Čempioni', 'Ātrie Prāti', 'Zelta Bulta', 'Gudrinieki'
    ];

    const targetCount = data.count || 500;
    for (let i = 0; i < targetCount; i++) {
      const botId = `bot_${Date.now()}_${i}`;
      if (!players.has(botId)) {
        players.set(botId, {
          id: botId,
          name: `Dalībnieks #${players.size + 1}`,
          deviceNumber: players.size + 1,
          score: 0,
          roundScore: 0,
          lastQuestionScore: 0,
          totalTimeMs: 0,
          roundTimeMs: 0,
          rank: null,
          previousRank: null,
          rankDelta: 0,
          isDisabled: false,
          isBot: true,
          teamName: isTeamMode ? sampleTeams[i % sampleTeams.length] : '',
          missedQuestionsCount: 0
        });
      }
    }

    io.to(`${pin}_screens`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(`${pin}_host`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(`${pin}_players`).emit('presence-update', { count: players.size });

    broadcastLeaderboardAndPersonalStats(pin, false);
    logEvent('INFO', `Simulēti ${targetCount} boti sesijai: PIN ${pin}`);
    saveSnapshot(pin, true);

    if (session?.subState === 'ACTIVE') {
      triggerBotVotes(pin);
    }
  });

  socket.on('host:clear-bots', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const players = sessionScores.get(pin);
    if (!players) return;

    players.forEach((p, id) => {
      if (p.isBot) players.delete(id);
    });

    io.to(`${pin}_screens`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(`${pin}_host`).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(`${pin}_players`).emit('presence-update', { count: players.size });

    broadcastLeaderboardAndPersonalStats(pin, false);
    logEvent('INFO', `Dzēsti visi boti sesijai: PIN ${pin}`);
    saveSnapshot(pin, true);
  });

  socket.on('host:toggle-chart', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    io.to(pin).emit('toggle-audience-chart');
  });

  socket.on('host:change-leaderboard-page', (data: { pin: string; hostToken: string; page: number }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s && s.currentScene?.type === 'LEADERBOARD') {
      s.currentPaging = data.page;
      io.to(pin).emit('leaderboard-page-change', data.page);
    }
  });

  socket.on('host:backtrack', (data: { pin: string; hostToken: string }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    clearSessionTimer(pin);

    if (s.currentScene?.type === 'LEADERBOARD' && s.currentScene?.config?.lbType === 'FINAL') {
      if (s.finalPodiumStage > 0) {
        s.finalPodiumStage--;
        io.to(pin).emit('podium-stage-change', s.finalPodiumStage);
        saveSnapshot(pin, true);
        return;
      }
    }

    if (s.subState === 'REVEAL') {
      s.subState = 'SUMMARY';
      s.isRevealed = false;
      s.revealReadyToAdvance = false;

      if (playersMap) {
        playersMap.forEach((p) => {
          const pts = p.lastQuestionScore || 0;
          if (pts > 0) {
            p.score = Math.max(0, p.score - pts);
            p.roundScore = Math.max(0, p.roundScore - pts);
            p.lastQuestionScore = 0;
          }
          if (p.previousRank !== undefined && p.previousRank !== null) {
            p.rank = p.previousRank;
            p.rankDelta = 0;
          }
        });
      }

      if (s.questionsScored && s.questionsScored > 0) {
        s.questionsScored--;
      }

      emitStateUpdate(pin, s.currentScene, 'SUMMARY', { summaryStats: s.summaryStats });
      broadcastLeaderboardAndPersonalStats(pin, false);
      logEvent('INFO', `Backtrack uz SUMMARY sesijā: PIN ${pin}`);
      saveSnapshot(pin, true);
      return;
    }

    if (s.subState === 'SUMMARY') {
      s.subState = 'STATS';
      emitStateUpdate(pin, s.currentScene, 'STATS');
      saveSnapshot(pin, true);
      return;
    }

    if (s.subState === 'STATS' || s.subState === 'ACTIVE' || s.subState === 'PAUSED') {
      s.subState = 'READY';
      s.isPaused = false;
      s.pausedRemainingMs = 0;
      s.frozenRemainingMs = null;
      emitStateUpdate(pin, s.currentScene, 'READY');
      saveSnapshot(pin, true);
      return;
    }

    if (s.subState === 'READY' || s.subState === 'IDLE') {
      if (s.currentSceneIdx > 0) {
        s.currentSceneIdx--;
        s.currentScene = s.scenes[s.currentSceneIdx];
        s.votes = [];
        s.buzzerRaceWinners = [];
        s.isPaused = false;
        s.pausedRemainingMs = 0;
        s.frozenRemainingMs = null;
        s.isRevealed = false;
        s.revealReadyToAdvance = false;
        s.currentPaging = 0;
        s.finalPodiumStage = 0;
        s.subState = 'READY';
        s.slideLoadedTime = Date.now();

        emitStateUpdate(pin, s.currentScene, 'READY');
        logEvent('INFO', `Backtrack uz slaidu #${s.currentSceneIdx + 1} sesijā: PIN ${pin}`);
        saveSnapshot(pin, true);
      }
    }
  });

  socket.on('host:advance', (data: { pin: string; hostToken: string; force?: boolean } | string) => {
    const pin = typeof data === 'string' ? data : data?.pin;
    const token = typeof data === 'string' ? undefined : data?.hostToken;
    if (!isHostAuthorized(pin, token)) return;

    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    const now = Date.now();
    const lastAdvance = lastAdvanceTimestamps.get(pin) || 0;

    if (now - lastAdvance < 450) return;
    lastAdvanceTimestamps.set(pin, now);

    if (s.subState === 'ACTIVE') {
      const activeElapsed = now - (s.questionStartTime || 0);
      if (activeElapsed < 3000) {
        return;
      }
    }

    clearSessionTimer(pin);

    // FINĀLA APBALVOŠANA
    if (s.currentScene?.type === 'LEADERBOARD' && s.currentScene?.config?.lbType === 'FINAL') {
      const activePlayers = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);
      const isTeamMode = !!s.branding?.teamModeEnabled;
      const teamList = isTeamMode ? getSortedTeamLeaderboard(pin, playersMap!, s?.branding?.teamScoringMode || 'AVG', false, false) : [];

      if (!s.finalLeaderboardView) {
        s.finalLeaderboardView = isTeamMode && teamList.length > 0 ? 'TEAMS' : 'INDIVIDUAL';
      }

      const isViewingTeams = isTeamMode && s.finalLeaderboardView === 'TEAMS' && teamList.length > 0;
      const totalItems = isViewingTeams ? teamList.length : activePlayers.length;

      if (s.finalPodiumStage === undefined) s.finalPodiumStage = 0;

      if (s.finalPodiumStage < 1) {
        s.finalPodiumStage = 1;
        io.to(pin).emit('podium-stage-change', 1);
      } else if (s.finalPodiumStage === 1) {
        s.finalPodiumStage = 2;
        io.to(pin).emit('podium-stage-change', 2);
      } else if (s.finalPodiumStage === 2) {
        s.finalPodiumStage = 3;
        io.to(pin).emit('podium-stage-change', 3);
      } else if (s.finalPodiumStage === 3) {
        const remainingCount = Math.max(0, totalItems - 3);
        if (remainingCount > 0) {
          s.finalPodiumStage = 4;
          s.currentPaging = 0;
          io.to(pin).emit('podium-stage-change', 4);
          io.to(pin).emit('leaderboard-page-change', 0);
        } else {
          s.finalPodiumStage = 3;
          s.currentPaging = 0;
          io.to(pin).emit('podium-stage-change', 3);
          io.to(pin).emit('leaderboard-page-change', 0);
        }
      } else if (s.finalPodiumStage === 4) {
        const remainingCount = Math.max(0, totalItems - 3);
        const maxPages = Math.ceil(remainingCount / 12);

        if (s.currentPaging < maxPages - 1) {
          s.currentPaging++;
          io.to(pin).emit('leaderboard-page-change', s.currentPaging);
        } else {
          s.finalPodiumStage = 3;
          s.currentPaging = 0;
          io.to(pin).emit('podium-stage-change', 3);
          io.to(pin).emit('leaderboard-page-change', 0);
        }
      }
      saveSnapshot(pin, true);
      return;
    }

    if (s.subState === 'REVEAL' && !s.revealReadyToAdvance) {
      s.revealReadyToAdvance = true;
      io.to(pin).emit('reveal-wait-for-host');
      return;
    }

    // 1. PĀREJA UZ NĀKAMO SLAIDU
    if (
      s.subState === 'IDLE' ||
      s.subState === 'REVEAL' ||
      (s.currentScene && (s.currentScene.type === 'BILLBOARD' || s.currentScene.type === 'LEADERBOARD' || s.currentScene.type === 'TIMER' || s.currentScene.type === 'CONTACTS'))
    ) {
      if (now - (s.slideLoadedTime || 0) < 600) return;

      if (s.currentScene?.type === 'LEADERBOARD') {
        resetRoundScores(pin);
      }

      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) {
        clearSnapshot(pin);
        logEvent('INFO', `Spēle pabeigta: PIN ${pin}`);
        return io.to(pin).emit('game-over');
      }

      s.currentScene = s.scenes[s.currentSceneIdx];
      s.votes = [];
      s.buzzerRaceWinners = [];
      s.isPaused = false;
      s.pausedRemainingMs = 0;
      s.frozenRemainingMs = null;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.currentPaging = 0;
      s.finalPodiumStage = 0;
      s.slideLoadedTime = Date.now();
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
      delete s.summaryStats;

      const isAutoStart = !!s.currentScene?.config?.autoStart && ['QUESTION', 'MAJORITY', 'ORDERING', 'BUZZER_RACE'].includes(s.currentScene.type);

      if (isAutoStart) {
        s.subState = 'ACTIVE';
        s.questionStartTime = Date.now();
        const dur = s.currentScene?.config?.duration || s.currentScene?.config?.timeLimit || 30;
        s.currentScene.endTime = Date.now() + dur * 1000;
        emitStateUpdate(pin, s.currentScene, 'ACTIVE');

        clearSessionTimer(pin);
        const timer = setTimeout(() => {
          const currentSession = sessions.get(pin);
          if (currentSession?.subState === 'ACTIVE') {
            currentSession.subState = 'STATS';
            currentSession.frozenRemainingMs = 0;
            if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
            emitStateUpdate(pin, currentSession.currentScene, 'STATS', { frozenRemainingMs: 0 });
            io.to(pin).emit('video-command', 'pause');
            saveSnapshot(pin, true);
          }
        }, dur * 1000);
        sessionTimers.set(pin, timer);

        triggerBotVotes(pin);
      } else {
        s.subState = 'READY';
        emitStateUpdate(pin, s.currentScene, 'READY');
      }

      if (s.currentScene.type === 'LEADERBOARD') {
        const isRound = s.currentScene?.config?.lbType === 'ROUND';
        broadcastLeaderboardAndPersonalStats(pin, isRound);
      }
      saveSnapshot(pin, true);
    }
    // 2. READY -> ACTIVE
    else if (s.subState === 'READY') {
      s.subState = 'ACTIVE';
      s.isPaused = false;
      s.pausedRemainingMs = 0;
      s.frozenRemainingMs = null;
      s.questionStartTime = Date.now();
      const dur = s.currentScene?.config?.duration || s.currentScene?.config?.timeLimit || 30;
      s.currentScene.endTime = Date.now() + dur * 1000;
      delete s.summaryStats;
      emitStateUpdate(pin, s.currentScene, 'ACTIVE');

      clearSessionTimer(pin);
      const timer = setTimeout(() => {
        const currentSession = sessions.get(pin);
        if (currentSession?.subState === 'ACTIVE') {
          currentSession.subState = 'STATS';
          currentSession.frozenRemainingMs = 0;
          if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
          emitStateUpdate(pin, currentSession.currentScene, 'STATS', { frozenRemainingMs: 0 });
          io.to(pin).emit('video-command', 'pause');
          saveSnapshot(pin, true);
        }
      }, dur * 1000);
      sessionTimers.set(pin, timer);

      triggerBotVotes(pin);
      saveSnapshot(pin, true);
    }
    // 3. ACTIVE / PAUSED -> STATS (Ar atlikušā laika iesaldēšanu!)
    else if (s.subState === 'ACTIVE' || s.subState === 'PAUSED') {
      const remainingTimeMs = s.isPaused
        ? (s.pausedRemainingMs || 0)
        : Math.max(0, (s.currentScene?.endTime || 0) - Date.now());

      s.subState = 'STATS';
      s.isPaused = false;
      s.frozenRemainingMs = remainingTimeMs;
      emitStateUpdate(pin, s.currentScene, 'STATS', { frozenRemainingMs: remainingTimeMs });
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin, true);
    }
    // 4. STATS -> SUMMARY (Saglabājot iesaldēto laiku)
    else if (s.subState === 'STATS') {
      s.subState = 'SUMMARY';
      s.isPaused = false;
      s.isRevealed = false;

      const config = s.currentScene?.config || {};
      let correct = config.correctAnswers || [];
      const opts = config.options || [];

      if (s.currentScene?.type === 'ORDERING') {
        correct = config.correctOrder || config.options || [];
      } else if (s.currentScene?.type === 'MAJORITY') {
        const counts: Record<string, number> = {};
        s.votes.forEach((v: any) => {
          if (Array.isArray(v.optionIds)) {
            v.optionIds.forEach((o: string) => (counts[o] = (counts[o] || 0) + 1));
          }
        });
        const winner = Object.keys(counts).reduce((a, b) => ((counts[a] || 0) > (counts[b] || 0) ? a : b), '');
        if (winner) correct = [winner];
      }

      const activePlayers = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);
      const totalActive = activePlayers.length || s.votes.length || 1;
      const isAnyOneMode = config.selectionMode === 'ANY_ONE';
      const requiredCount = correct.length || 1;
      const isMultiChoice = !isAnyOneMode && requiredCount > 1;

      let fullCorrectCount = 0;
      let partialCorrectCount = 0;
      let incorrectCount = 0;

      s.votes.forEach((v: any) => {
        if (s.currentScene?.type === 'ORDERING') {
          const userOrder = v.optionIds || [];
          const isExact = JSON.stringify(userOrder) === JSON.stringify(correct);
          if (isExact) fullCorrectCount++;
          else incorrectCount++;
        } else {
          let matchedCount = 0;
          if (Array.isArray(v.optionIds)) {
            v.optionIds.forEach((opt: string) => {
              if (correct.some((correctAns: string) => isAnswerMatch(opt, correctAns, opts))) {
                matchedCount++;
              }
            });
          }

          if (isAnyOneMode) {
            if (matchedCount > 0) fullCorrectCount++;
            else incorrectCount++;
          } else if (isMultiChoice) {
            if (matchedCount === requiredCount && v.optionIds.length === requiredCount) {
              fullCorrectCount++;
            } else if (matchedCount > 0) {
              partialCorrectCount++;
            } else {
              incorrectCount++;
            }
          } else {
            if (matchedCount === 1) fullCorrectCount++;
            else incorrectCount++;
          }
        }
      });

      const completeVotes = s.votes.filter((v: any) => v.isComplete);
      const unsubmittedCount = Math.max(0, totalActive - completeVotes.length);
      const fullCorrectPct = Math.round((fullCorrectCount / Math.max(1, totalActive)) * 100);
      const partialCorrectPct = Math.round((partialCorrectCount / Math.max(1, totalActive)) * 100);
      const incorrectPct = Math.round((incorrectCount / Math.max(1, totalActive)) * 100);

      s.summaryStats = {
        isMultiChoice,
        requiredCount,
        fullCorrectCount,
        partialCorrectCount,
        incorrectCount,
        unsubmittedCount,
        totalActive,
        fullCorrectPct,
        partialCorrectPct,
        incorrectPct,
        correctCount: fullCorrectCount,
        correctPct: fullCorrectPct
      };

      emitStateUpdate(pin, s.currentScene, 'SUMMARY', {
        summaryStats: s.summaryStats,
        frozenRemainingMs: s.frozenRemainingMs
      });
      saveSnapshot(pin, true);
    }
    // 5. SUMMARY -> REVEAL (Saglabājot iesaldēto laiku)
    else if (s.subState === 'SUMMARY') {
      s.subState = 'REVEAL';
      s.isRevealed = true;
      s.revealReadyToAdvance = false;

      const questionsScored = s.questionsScored || 0;

      if (playersMap) {
        if (questionsScored >= 1) {
          const preLb = getSortedLeaderboard(playersMap, false, false);
          preLb.forEach((p, idx) => {
            const org = playersMap.get(p.id);
            if (org) org.previousRank = idx + 1;
          });

          const preTeams = getSortedTeamLeaderboard(pin, playersMap, s?.branding?.teamScoringMode || 'AVG', false, false);
          const teamPrevMap = new Map<string, number>();
          preTeams.forEach((t, idx) => teamPrevMap.set(t.name, idx + 1));
          sessionTeamPreviousRanks.set(pin, teamPrevMap);
        } else {
          playersMap.forEach((p) => {
            p.previousRank = null;
            p.rankDelta = 0;
          });
          sessionTeamPreviousRanks.delete(pin);
        }
      }

      const config = s.currentScene?.config || {};
      let correct = config.correctAnswers || [];
      const opts = config.options || [];
      const correctnessMap: Record<string, number> = config.answerCorrectness || {};

      if (s.currentScene?.type === 'ORDERING') {
        correct = config.correctOrder || config.options || [];
      } else if (s.currentScene?.type === 'MAJORITY') {
        const counts: Record<string, number> = {};
        s.votes.forEach((v: any) => {
          if (Array.isArray(v.optionIds)) {
            v.optionIds.forEach((o: string) => (counts[o] = (counts[o] || 0) + 1));
          }
        });
        const winner = Object.keys(counts).reduce((a, b) => ((counts[a] || 0) > (counts[b] || 0) ? a : b), '');
        if (winner) correct = [winner];
      }

      const dur = config.duration || config.timeLimit || 30;
      const totalDuration = dur * 1000;
      const maxPoints = config.pointsMax ?? config.points ?? 10;
      const minPoints = config.pointsMin ?? (config.scoringMode === 'DECREASING' ? 1 : maxPoints);
      const isAnyOneMode = config.selectionMode === 'ANY_ONE';
      const isMusicMode = config.playerUIMode === 'MUSIC_DUAL';

      const calculateDecreasingPoints = (timeSpent: number): number => {
        if (config.scoringMode !== 'DECREASING') return maxPoints;
        const timeLeft = Math.max(0, totalDuration - timeSpent);
        return Math.round(minPoints + (timeLeft / totalDuration) * (maxPoints - minPoints));
      };

      const sortedVotes = [...s.votes].sort((a, b) => a.timeReceived - b.timeReceived);
      const votedPlayerIds = new Set(sortedVotes.map((v: any) => v.playerId));
      let correctCounter = 0;

      const maxMissed = s.branding?.maxMissedQuestions || 5;
      playersMap?.forEach((p) => {
        if (!p.isDisabled && !p.isBot) {
          if (votedPlayerIds.has(p.id)) {
            p.missedQuestionsCount = 0;
          } else {
            p.missedQuestionsCount = (p.missedQuestionsCount || 0) + 1;
            if (p.missedQuestionsCount >= maxMissed) {
              p.isDisabled = true;
              logEvent('WARN', `Spēlētājs ${p.name} (#${p.deviceNumber}) atslēgts AFK dēļ`);
              io.to(pin).emit('player-disabled-afk', { playerId: p.id, name: p.name });
            }
          }
        }
      });

      playersMap?.forEach((p) => { p.lastQuestionScore = 0; });

      sortedVotes.forEach((v: any) => {
        const p = playersMap?.get(v.playerId);
        if (!p || p.isDisabled) return;

        if (isMusicMode) {
          const isTopCorrect = v.topAnswer && correct.some((c: string) => isAnswerMatch(v.topAnswer, c, opts.slice(0, 3)));
          const isBottomCorrect = v.bottomAnswer && correct.some((c: string) => isAnswerMatch(v.bottomAnswer, c, opts.slice(3, 6)));

          let earnedPts = 0;

          if (isTopCorrect) {
            const topTime = v.topTimeSpentMs || v.timeSpentMs || 0;
            const availableAtTop = calculateDecreasingPoints(topTime);
            earnedPts += Math.round(availableAtTop * 0.5);
          }

          if (isBottomCorrect) {
            const bottomTime = v.bottomTimeSpentMs || v.timeSpentMs || 0;
            const availableAtBottom = calculateDecreasingPoints(bottomTime);
            earnedPts += Math.round(availableAtBottom * 0.5);
          }

          const overallTime = Math.max(v.topTimeSpentMs || 0, v.bottomTimeSpentMs || 0, v.timeSpentMs || 0);
          p.totalTimeMs = (p.totalTimeMs || 0) + overallTime;
          p.roundTimeMs = (p.roundTimeMs || 0) + overallTime;

          p.lastQuestionScore = earnedPts;
          p.score = (p.score || 0) + earnedPts;
          p.roundScore = (p.roundScore || 0) + earnedPts;
          return;
        }

        let earnedPercentage = 0;
        if (s.currentScene?.type === 'ORDERING') {
          const userOrder = v.optionIds || [];
          const isExact = JSON.stringify(userOrder) === JSON.stringify(correct);
          earnedPercentage = isExact ? 100 : 0;
        } else {
          let matchedCount = 0;
          if (Array.isArray(v.optionIds)) {
            v.optionIds.forEach((opt: string) => {
              if (correct.some((c: string) => isAnswerMatch(opt, c, opts))) {
                matchedCount++;
              }
            });
          }

          if (isAnyOneMode) {
            earnedPercentage = matchedCount > 0 ? 100 : 0;
          } else {
            const required = correct.length || 1;
            if (matchedCount === required && v.optionIds.length === required) {
              earnedPercentage = 100;
            } else if (matchedCount > 0 && v.optionIds.length <= required) {
              earnedPercentage = Math.round((matchedCount / required) * 100);
            } else {
              earnedPercentage = 0;
            }
          }
        }

        earnedPercentage = Math.min(100, earnedPercentage);
        const timeSpent = v.timeSpentMs || 0;
        p.totalTimeMs = (p.totalTimeMs || 0) + timeSpent;
        p.roundTimeMs = (p.roundTimeMs || 0) + timeSpent;

        if (earnedPercentage > 0) {
          let baseEarned = calculateDecreasingPoints(timeSpent);

          if (config.speedBonusEnabled && earnedPercentage === 100 && correctCounter < 3) {
            const bonuses = [3, 2, 1];
            baseEarned += bonuses[correctCounter];
            correctCounter++;
          }

          const finalPts = Math.round((baseEarned * earnedPercentage) / 100);
          p.lastQuestionScore = finalPts;
          p.score = (p.score || 0) + finalPts;
          p.roundScore = (p.roundScore || 0) + finalPts;
        } else {
          p.lastQuestionScore = 0;
        }
      });

      s.questionsScored = (s.questionsScored || 0) + 1;

      emitStateUpdate(pin, s.currentScene, 'REVEAL', {
        isRevealed: true,
        summaryStats: s.summaryStats,
        frozenRemainingMs: s.frozenRemainingMs
      });
      io.to(pin).emit('results-revealed', { correctAnswers: correct, correctnessMap });

      const nextScene = s.scenes[s.currentSceneIdx + 1];
      const isRound = nextScene?.config?.lbType === 'ROUND';
      broadcastLeaderboardAndPersonalStats(pin, isRound);
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:next-scene', (data: { pin: string; hostToken: string; scene: any }) => {
    const pin = data?.pin;
    const hostToken = data?.hostToken;
    if (!isHostAuthorized(pin, hostToken)) return;
    const s = sessions.get(pin);
    if (s) {
      clearSessionTimer(pin);
      if (s.currentScene?.type === 'LEADERBOARD') resetRoundScores(pin);

      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      s.buzzerRaceWinners = [];
      s.isPaused = false;
      s.pausedRemainingMs = 0;
      s.frozenRemainingMs = null;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.currentPaging = 0;
      s.finalPodiumStage = 0;
      s.slideLoadedTime = Date.now();
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
      delete s.summaryStats;

      emitStateUpdate(pin, s.currentScene, 'IDLE');
      saveSnapshot(pin, true);
    }
  });

  socket.on('client:request-sync', (data: { pin: string; playerId: string; playerToken?: string }) => {
    const s = sessions.get(data.pin);
    const players = sessionScores.get(data.pin);
    const player = players?.get(data.playerId);

    if (s && player) {
      const sanitizedScene = sanitizeSceneForPlayer(s.currentScene, s.subState);
      const existingVote = s.votes?.find((v: any) => v.playerId === data.playerId);
      const isInitialBaseline = (s.questionsScored || 0) <= 1;

      socket.emit('client:sync-response', {
        currentScene: sanitizedScene,
        subState: s.subState,
        isBlackout: !!s.isBlackout,
        score: player.score || 0,
        roundScore: player.roundScore || 0,
        lastQuestionScore: player.lastQuestionScore || 0,
        myRank: player.rank,
        previousRank: player.previousRank,
        rankDelta: isInitialBaseline ? 0 : (player.rankDelta ?? 0),
        myChoice: existingVote ? (existingVote.optionIds?.join(', ') || null) : null,
        myOptionIds: existingVote?.optionIds || [],
        topAnswer: existingVote?.topAnswer || null,
        bottomAnswer: existingVote?.bottomAnswer || null,
        myContacts: player.contacts || {},
        isInitialBaseline
      });
    }
  });

  // =========================================================================
  // 🌟 VIEDĀ DALĪBNIEKU PIEVIENOŠANĀS UN ATJAUNOŠANA (SMART RE-ATTACHMENT)
  // =========================================================================
  socket.on('join-session', (data: { pin: string; name: string; playerId: string; playerToken?: string; teamName?: string; isCaptain?: boolean }) => {
    if (sessions.has(data.pin)) {
      const session = sessions.get(data.pin);
      const players = sessionScores.get(data.pin)!;
      const isTeamMode = !!session?.branding?.teamModeEnabled;

      let playerObj = players.get(data.playerId);
      const cleanName = data.name.trim();
      const cleanNameLower = cleanName.toLowerCase();
      const sanitizedTeam = isTeamMode && data.teamName ? data.teamName.trim() : '';

      // 🌟 JA PĒC ID NEATROD (piem., jauns tunelis, pāreja uz LAN Wi-Fi vai telefons notīrījis sīkfailus):
      // Meklējam esošo dalībnieku pēc VĀRDA!
      if (!playerObj && cleanName && data.name !== 'EKRĀNS') {
        for (const [existingId, p] of players.entries()) {
          if (p.name.trim().toLowerCase() === cleanNameLower && !p.isBot) {
            logEvent('INFO', `♻️ Atpazīts atgriezies spēlētājs "${p.name}" (#${p.deviceNumber}) no jaunas adreses. Atjaunojam datus!`);
            
            // Pārnesam datus uz jauno tālruņa ID
            players.delete(existingId);
            p.id = data.playerId;
            if (data.playerToken) p.token = data.playerToken;
            playerObj = p;
            players.set(data.playerId, playerObj);

            // Atjaunojam balsojumu piesaisti
            session.votes?.forEach((v: any) => {
              if (v.playerId === existingId) v.playerId = data.playerId;
            });
            break;
          }
        }
      }

      // Komandu pārbaude kapteiņiem un biedriem
      if (isTeamMode && sanitizedTeam) {
        const teamLower = sanitizedTeam.toLowerCase();
        let teamCaptainExists: PlayerState | null = null;

        players.forEach((p) => {
          if (p.teamName?.toLowerCase() === teamLower && p.isCaptain && p.id !== data.playerId && p.id !== playerObj?.id) {
            teamCaptainExists = p;
          }
        });

        // Bloķē tikai tad, ja tas ir PAVISAM CITS kapteinis, nevis tas pats atgriezušais
        if (data.isCaptain && teamCaptainExists) {
          return socket.emit(
            'error-message',
            `❌ Komanda ar nosaukumu "${sanitizedTeam}" jau ir reģistrēta!\nLūdzu noskenējiet sava kapteiņa QR kodu vai izdomājiet atšķirīgu nosaukumu.`
          );
        }

        if (!data.isCaptain && !teamCaptainExists && !playerObj) {
          const teamMemberExists = Array.from(players.values()).some(
            (p) => p.teamName?.toLowerCase() === teamLower && p.id !== data.playerId
          );
          if (!teamMemberExists) {
            return socket.emit(
              'error-message',
              `❌ Komanda "${sanitizedTeam}" vēl nav izveidota!\nKapteinim vispirms jāizveido komanda un jāparāda QR kods.`
            );
          }
        }
      }

      socket.join(data.pin);

      if (data.name === 'EKRĀNS') {
        socket.join(`${data.pin}_screens`);
      } else {
        socket.join(`${data.pin}_players`);

        if (!participants.has(data.pin)) participants.set(data.pin, new Set());
        participants.get(data.pin)?.add(socket.id);

        socketPlayerMap.set(socket.id, { pin: data.pin, playerId: data.playerId });
        playerIdToSocketMap.set(data.playerId, socket.id);

        const sessionToken = (playerObj && playerObj.token)
          ? playerObj.token
          : (data.playerToken || crypto.randomBytes(16).toString('hex'));

        if (!playerObj) {
          // Jauns dalībnieks pirmo reizi
          playerObj = {
            id: data.playerId,
            token: sessionToken,
            socketId: socket.id,
            name: cleanName,
            teamName: sanitizedTeam,
            isCaptain: isTeamMode ? !!data.isCaptain : false,
            deviceNumber: players.size + 1,
            score: 0,
            roundScore: 0,
            lastQuestionScore: 0,
            totalTimeMs: 0,
            roundTimeMs: 0,
            rank: null,
            previousRank: null,
            rankDelta: 0,
            isDisabled: false,
            isBot: false,
            missedQuestionsCount: 0,
            contacts: {}
          };
          players.set(data.playerId, playerObj);
        } else {
          // Atgriezies dalībnieks (saglabā punktus, vietu un pults numuru!)
          playerObj.socketId = socket.id;
          playerObj.isBot = false;
          if (!playerObj.token) playerObj.token = sessionToken;
          if (cleanName) playerObj.name = cleanName;
          if (sanitizedTeam) playerObj.teamName = sanitizedTeam;
          if (isTeamMode && data.isCaptain !== undefined) playerObj.isCaptain = !!data.isCaptain;
        }
      }

      io.to(`${data.pin}_screens`).emit('presence-update', {
        count: players.size,
        players: Array.from(players.values())
      });
      io.to(`${data.pin}_host`).emit('presence-update', {
        count: players.size,
        players: Array.from(players.values())
      });
      io.to(`${data.pin}_players`).emit('presence-update', { count: players.size });

      const sanitizedScene = sanitizeSceneForPlayer(session?.currentScene, session?.subState);

      const isInitialBaseline = (session.questionsScored || 0) <= 1;
      const sortedLb = getSortedLeaderboard(players, false, isInitialBaseline);
      const sortedTeams = getSortedTeamLeaderboard(data.pin, players, session?.branding?.teamScoringMode || 'AVG', false, isInitialBaseline);
      const myRankIdx = sortedLb.findIndex((p) => p.id === data.playerId);
      const myTeamRankIdx = sanitizedTeam ? sortedTeams.findIndex((t) => t.name.toLowerCase() === sanitizedTeam.toLowerCase()) : -1;

      const scList = session?.scenes || [];
      const curIdx = session?.currentSceneIdx ?? 0;
      const totalQuestions = scList.filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;
      const isScorable = session?.currentScene ? SCORABLE_TYPES.includes(session.currentScene.type) : false;
      const currentQuestionNum = scList
        .slice(0, curIdx + 1)
        .filter((sc: any) => SCORABLE_TYPES.includes(sc?.type)).length;

      socket.emit('join-success', {
        pin: data.pin,
        playerId: data.playerId,
        playerToken: playerObj?.token,
        deviceNumber: playerObj?.deviceNumber || 1,
        branding: session?.branding || {},
        connectionUrl: session?.connectionUrl || publicTunnelUrl || '',
        currentScene: sanitizedScene,
        subState: session?.subState,
        isBlackout: !!session?.isBlackout,
        isPaused: !!session?.isPaused,
        frozenRemainingMs: session?.frozenRemainingMs ?? null,
        pausedRemainingMs: session?.pausedRemainingMs ?? null,
        currentSceneIdx: curIdx,
        totalScenes: scList.length,
        currentQuestionNum,
        totalQuestions,
        isScorable,
        teamName: playerObj?.teamName || '',
        isCaptain: !!playerObj?.isCaptain,
        score: playerObj?.score || 0,
        roundScore: playerObj?.roundScore || 0,
        lastQuestionScore: playerObj?.lastQuestionScore || 0,
        myRank: myRankIdx !== -1 ? myRankIdx + 1 : 1,
        previousRank: playerObj?.previousRank ?? null,
        rankDelta: playerObj?.rankDelta ?? 0,
        totalPlayers: sortedLb.length,
        teamRank: myTeamRankIdx !== -1 ? myTeamRankIdx + 1 : null,
        totalTeams: sortedTeams.length,
        teamScore: myTeamRankIdx !== -1 ? sortedTeams[myTeamRankIdx].score : null,
        isInitialBaseline
      });

      broadcastLeaderboardAndPersonalStats(data.pin, false);
      saveSnapshot(data.pin);
    } else {
      socket.emit('error-message', 'Sesija ar šādu PIN kodu nav atrasta.');
    }
  });

  socket.on('participant:submit-answer', (data: {
    pin: string;
    playerId: string;
    playerToken?: string;
    answers?: string[];
    answer?: string;
    category?: 'TOP' | 'BOTTOM' | 'SINGLE';
  }) => {
    const session = sessions.get(data.pin);
    const players = sessionScores.get(data.pin);
    if (!session || !players || !players.has(data.playerId)) {
      return socket.emit('error-message', 'Neautorizēta atbildes iesniegšana!');
    }

    const player = players.get(data.playerId)!;

    if (player.token && data.playerToken && player.token !== data.playerToken) {
      return socket.emit('error-message', 'Drošības kļūda: Nederīgs spēlētāja autorizācijas tokens!');
    }

    const answerList = Array.isArray(data.answers) ? data.answers : data.answer ? [data.answer] : [];
    handleVote(data.pin, answerList, data.playerId, data.category);
  });

  socket.on('participant:submit-contacts', (data: {
    pin: string;
    playerId: string;
    playerToken?: string;
    contacts: Record<string, string>;
  }) => {
    const session = sessions.get(data.pin);
    const players = sessionScores.get(data.pin);
    if (!session || !players || !players.has(data.playerId)) return;

    const player = players.get(data.playerId)!;
    if (player.token && data.playerToken && player.token !== data.playerToken) return;

    player.contacts = { ...(player.contacts || {}), ...(data.contacts || {}) };

    const existingIndex = session.votes.findIndex((v: any) => v.playerId === data.playerId);
    if (existingIndex !== -1) {
      session.votes[existingIndex].isComplete = true;
    } else {
      session.votes.push({
        optionIds: ['CONTACTS_SUBMITTED'],
        playerId: data.playerId,
        timeReceived: Date.now(),
        timeSpentMs: 0,
        isComplete: true
      });
    }

    triggerVotesUpdatedThrottled(data.pin);
    saveSnapshot(data.pin);
    logEvent('INFO', `Dalībnieks #${player.deviceNumber} (${player.name}) iesniedza kontaktus (PIN: ${data.pin})`);
  });

  socket.on('disconnect', () => {
    const binding = socketPlayerMap.get(socket.id);
    if (binding) {
      socketPlayerMap.delete(socket.id);
      if (playerIdToSocketMap.get(binding.playerId) === socket.id) {
        playerIdToSocketMap.delete(binding.playerId);
      }
    }

    participants.forEach((set, pin) => {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        const players = sessionScores.get(pin);
        if (players) {
          io.to(`${pin}_screens`).emit('presence-update', {
            count: players.size,
            players: Array.from(players.values())
          });
          io.to(`${pin}_host`).emit('presence-update', {
            count: players.size,
            players: Array.from(players.values())
          });
          io.to(`${pin}_players`).emit('presence-update', { count: players.size });
        }
      }
    });
  });
});

httpServer.listen(PORT, () => {
  logEvent('INFO', `🚀 EVENT STUDIO SERVERIS PALAISTS UZ PORTA: ${PORT}`);
  logEvent('INFO', `📡 Lokālā tīkla IP adrese: http://${getLocalIpAddress()}:5173`);
  logEvent('INFO', `🔒 Snapshoti un žurnālfails droši glabājas: ${SECURE_DATA_DIR}`);

  startCloudflareTunnel();
});