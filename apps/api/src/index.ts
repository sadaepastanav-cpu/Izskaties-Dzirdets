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
import { spawn, exec, ChildProcessWithoutNullStreams } from 'child_process';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || crypto.randomBytes(8).toString('hex');

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
    if (!err && stats.size > 5 * 1024 * 1024) {
      fs.rename(LOG_FILE_PATH, path.join(LOGS_DIR, `event_${Date.now()}.log`), () => {});
    }
    fs.appendFile(LOG_FILE_PATH, logLine, () => {});
  });
};

logEvent('INFO', `Serveris inicializēts. Admin atslēga: ${process.env.ADMIN_API_KEY ? 'NO ENV' : ADMIN_API_KEY}`);

let publicTunnelUrl = '';
let tunnelProcess: ChildProcessWithoutNullStreams | null = null;
let tunnelRestartTimeout: NodeJS.Timeout | null = null;

const MEDIA_ROOT_DIR = path.resolve(process.cwd(), '../../public/uploads');
let currentProjectPath = MEDIA_ROOT_DIR;
if (!fs.existsSync(currentProjectPath)) {
  fs.mkdirSync(currentProjectPath, { recursive: true });
}

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
  max: 50,
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

const safeResolve = (userFileName: string): string => {
  const safeBase = path.basename(userFileName);
  return path.join(currentProjectPath, safeBase);
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
    const cleanName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safeName = path.basename(cleanName).replace(/\s+/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
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

interface PlayerState {
  id: string;
  name: string;
  deviceNumber?: number;
  score: number;
  roundScore: number;
  totalTimeMs: number;
  roundTimeMs: number;
  isDisabled?: boolean;
  isBot?: boolean;
  teamName?: string;
  isCaptain?: boolean;
  missedQuestionsCount: number;
}

const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, PlayerState>>();
const participants = new Map<string, Set<string>>();
const sessionHostTokens = new Map<string, string>();
const sessionTimers = new Map<string, NodeJS.Timeout>();
const socketPlayerMap = new Map<string, { pin: string; playerId: string }>();
const snapshotDebounceTimers = new Map<string, NodeJS.Timeout>();
const lastAdvanceTimestamps = new Map<string, number>();

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
    }
    delete cleanScene.config.notes;
  }
  return cleanScene;
};

const emitStateUpdate = (pin: string, scene: any, subState: string, extra: any = {}) => {
  const sanitized = sanitizeSceneForPlayer(scene, subState);
  io.to(pin).emit('state-update', { ...sanitized, subState, ...extra });
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
      state: cleanState,
      scores: Array.from(scores?.entries() || [])
    };

    const dataString = JSON.stringify(payload, null, 2);
    fs.writeFile(path.join(SECURE_DATA_DIR, 'active_session.json'), dataString, () => {});
    fs.writeFile(path.join(SECURE_DATA_DIR, `snapshot_${pin}.json`), dataString, () => {});
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
    }, 1500);
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
    });
  }
};

const getSortedLeaderboard = (playersMap: Map<string, PlayerState>, isRound: boolean = false): PlayerState[] => {
  return Array.from(playersMap.values())
    .filter((p) => !p.isDisabled)
    .sort((a, b) => {
      const scoreA = isRound ? a.roundScore || 0 : a.score || 0;
      const scoreB = isRound ? b.roundScore || 0 : b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = isRound ? a.roundTimeMs || 0 : a.totalTimeMs || 0;
      const timeB = isRound ? b.roundTimeMs || 0 : b.totalTimeMs || 0;
      return timeA - timeB;
    });
};

const getSortedTeamLeaderboard = (playersMap: Map<string, PlayerState>, scoringMode: 'AVG' | 'SUM' = 'AVG', isRound: boolean = false) => {
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
    });
};

// ==========================================
// 5. CLOUDFLARE TUNELIS
// ==========================================
function startCloudflareTunnel(onReady?: (url: string) => void) {
  if (publicTunnelUrl) {
    if (onReady) onReady(publicTunnelUrl);
    return;
  }

  if (tunnelProcess) {
    return;
  }

  logEvent('INFO', '⏳ Automātiski startējam Cloudflare tuneli...');

  try {
    tunnelProcess = spawn('cloudflared', ['tunnel', '--url', 'http://127.0.0.1:5173'], {
      shell: true
    });

    const handleOutput = (data: any) => {
      const output = data.toString();
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
      logEvent('ERROR', `Cloudflare procesa kļūda: ${err.message}`);
      tunnelProcess = null;
      publicTunnelUrl = '';
    });

    tunnelProcess.on('close', (code) => {
      logEvent('INFO', `Cloudflare tunelis aizvērts (${code})`);
      tunnelProcess = null;
      publicTunnelUrl = '';

      if (code !== 0 && !tunnelRestartTimeout) {
        tunnelRestartTimeout = setTimeout(() => {
          tunnelRestartTimeout = null;
          logEvent('INFO', '🔄 Mēģinām automātiski pārstartēt Cloudflare tuneli...');
          startCloudflareTunnel();
        }, 4000);
      }
    });
  } catch (err: any) {
    logEvent('ERROR', `Cloudflare izsaukuma kļūda: ${err.message}`);
    tunnelProcess = null;
  }
}

// ==========================================
// 6. REST API MARŠRUTI
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

      const lower = resolved.toLowerCase();
      if (lower.startsWith('c:\\windows') || lower.startsWith('c:\\program files') || lower === 'c:\\') {
        return res.status(403).json({ error: 'Drošības liegums: Sistēmas mapes nav atļauts iestatīt kā projekta mapi.' });
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
    fs.writeFileSync(filePath, JSON.stringify(req.body.data, null, 2));
    logEvent('INFO', `Projekts saglabāts: ${path.basename(filePath)}`);
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

  if (!playersMap || playersMap.size === 0) {
    return res.status(404).json({ error: 'Šai sesijai nav atrasti spēlētāju dati.' });
  }

  const sortedList = getSortedLeaderboard(playersMap, false);

  let csvContent = '\uFEFF';
  if (isTeamMode) {
    csvContent += 'Vieta;Pults #;Vārds;Komanda;Kopējie Punkti;Kārtas Punkti;Apdomas Laiks (s);Milisekundes;Statuss\n';
  } else {
    csvContent += 'Vieta;Pults #;Vārds;Kopējie Punkti;Kārtas Punkti;Apdomas Laiks (s);Milisekundes;Statuss\n';
  }

  sortedList.forEach((p, idx) => {
    const seconds = ((p.totalTimeMs || 0) / 1000).toFixed(2);
    const status = p.isDisabled ? 'Atslēgts' : p.isBot ? 'Bots' : 'Aktīvs';
    const escapedName = `"${(p.name || '').replace(/"/g, '""')}"`;
    const escapedTeam = `"${(p.teamName || '').replace(/"/g, '""')}"`;

    if (isTeamMode) {
      csvContent += `${idx + 1};${p.deviceNumber || '-'};${escapedName};${escapedTeam};${p.score || 0};${p.roundScore || 0};${seconds};${p.totalTimeMs || 0};${status}\n`;
    } else {
      csvContent += `${idx + 1};${p.deviceNumber || '-'};${escapedName};${p.score || 0};${p.roundScore || 0};${seconds};${p.totalTimeMs || 0};${status}\n`;
    }
  });

  logEvent('INFO', `CSV eksports sesijai: PIN ${pin}`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=rezultati_sesija_${pin}.csv`);
  return res.send(csvContent);
});

// ==========================================
// 7. SOCKET.IO REĀLLAIKA DZINĒJS
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

const handleVote = (pin: string, answers: string[], playerId: string) => {
  const s = sessions.get(pin);
  const playersMap = sessionScores.get(pin);
  const player = playersMap?.get(playerId);
  if (!s || !player || player.isDisabled) return;

  const activeParticipantsCount = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled).length;

  if (s.subState === 'ACTIVE') {
    const now = Date.now();
    const timeSpentMs = Math.max(0, now - (s.questionStartTime || now));

    const existingIndex = s.votes.findIndex((v: any) => v.playerId === playerId);
    if (existingIndex !== -1) {
      s.votes[existingIndex].optionIds = answers;
      s.votes[existingIndex].timeReceived = now;
      s.votes[existingIndex].timeSpentMs = timeSpentMs;
    } else {
      s.votes.push({
        optionIds: answers,
        playerId,
        timeReceived: now,
        timeSpentMs
      });
    }

    const summary: Record<string, number> = {};
    s.votes.forEach((v: any) => {
      if (Array.isArray(v.optionIds)) {
        v.optionIds.forEach((o: string) => (summary[o] = (summary[o] || 0) + 1));
      }
    });

    const votedPlayerIds = s.votes.map((v: any) => v.playerId);
    io.to(pin).emit('votes-updated', { summary, votedCount: s.votes.length, votedPlayerIds });

    const isFullTimeMode = s.branding?.timerMode === 'FULL_TIME';
    if (!isFullTimeMode && activeParticipantsCount > 0 && s.votes.length >= activeParticipantsCount) {
      clearSessionTimer(pin);
      s.subState = 'STATS';
      if (s.currentScene) s.currentScene.endTime = Date.now();
      emitStateUpdate(pin, s.currentScene, 'STATS');
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin, true);
    }
  }
};

io.on('connection', (socket: Socket) => {
  if (publicTunnelUrl) {
    socket.emit('tunnel-ready', { url: publicTunnelUrl });
  }

  socket.on('host:start-tunnel', (_data?: { pin?: string; hostToken?: string; adminKey?: string }) => {
    startCloudflareTunnel((url) => {
      socket.emit('tunnel-ready', { url });
    });
  });

  socket.on('host:create-session', (data: any) => {
    const incomingPin = data.existingPin;
    
    if (incomingPin && sessions.has(incomingPin)) {
      const existingToken = sessionHostTokens.get(incomingPin);
      if (existingToken && data.hostToken !== existingToken) {
        return socket.emit('error-message', 'Nevar pārrakstīt aktīvu sesiju bez derīga vadītāja marķiera!');
      }
    }

    const pin = incomingPin || Math.floor(1000 + Math.random() * 9000).toString();
    const finalUrl = data.connectionUrl || publicTunnelUrl || `http://${getLocalIpAddress()}:5173`;
    const hostToken = sessionHostTokens.get(pin) || crypto.randomBytes(16).toString('hex');

    const sessionData = {
      currentSceneIdx: -1,
      scenes: data.projectData?.scenes || [],
      branding: data.projectData?.branding || {},
      connectionUrl: finalUrl,
      subState: 'IDLE',
      votes: [],
      currentScene: null,
      isRevealed: false,
      revealReadyToAdvance: false,
      currentPaging: 0,
      finalPodiumStage: 0,
      finalLeaderboardView: data.projectData?.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL',
      questionStartTime: 0,
      isPaused: false,
      pausedRemainingMs: 0
    };

    sessions.set(pin, sessionData);
    sessionHostTokens.set(pin, hostToken);
    if (!sessionScores.has(pin)) sessionScores.set(pin, new Map());
    if (!participants.has(pin)) participants.set(pin, new Set());

    socket.join(pin);
    socket.emit('session-info', { pin, hostToken, state: sessionData });
    logEvent('INFO', `Izveidota jauna spēles sesija: PIN ${pin}`);
    saveSnapshot(pin, true);
  });

  socket.on('host:pause-session', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (s && s.subState === 'ACTIVE') {
      clearSessionTimer(data.pin);
      s.isPaused = true;
      s.pausedRemainingMs = Math.max(0, (s.currentScene?.endTime || 0) - Date.now());
      s.subState = 'PAUSED';

      emitStateUpdate(data.pin, s.currentScene, 'PAUSED', { pausedRemainingMs: s.pausedRemainingMs });
      io.to(data.pin).emit('video-command', 'pause');
      saveSnapshot(data.pin, true);
    }
  });

  socket.on('host:resume-session', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (s && s.subState === 'PAUSED') {
      s.isPaused = false;
      s.subState = 'ACTIVE';
      const remainingMs = s.pausedRemainingMs || 10000;
      s.currentScene.endTime = Date.now() + remainingMs;

      emitStateUpdate(data.pin, s.currentScene, 'ACTIVE', { endTime: s.currentScene.endTime });
      io.to(data.pin).emit('video-command', 'play');

      clearSessionTimer(data.pin);
      const timer = setTimeout(() => {
        const currentSession = sessions.get(data.pin);
        if (currentSession?.subState === 'ACTIVE') {
          currentSession.subState = 'STATS';
          if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
          emitStateUpdate(data.pin, currentSession.currentScene, 'STATS');
          io.to(data.pin).emit('video-command', 'pause');
          saveSnapshot(data.pin, true);
        }
      }, remainingMs);
      sessionTimers.set(data.pin, timer);
      saveSnapshot(data.pin, true);
    }
  });

  socket.on('host:restart-scene', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (s && s.currentScene) {
      clearSessionTimer(data.pin);
      s.votes = [];
      s.isPaused = false;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.subState = 'READY';

      emitStateUpdate(data.pin, s.currentScene, 'READY');
      io.to(data.pin).emit('votes-updated', { summary: {}, votedCount: 0, votedPlayerIds: [] });
      logEvent('INFO', `Restartēts jautājums sesijā: PIN ${data.pin}`);
      saveSnapshot(data.pin, true);
    }
  });

  socket.on('host:end-session', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;

    clearSessionTimer(data.pin);
    io.to(data.pin).emit('session-ended');
    clearSnapshot(data.pin);
    sessions.delete(data.pin);
    sessionScores.delete(data.pin);
    participants.delete(data.pin);
    sessionHostTokens.delete(data.pin);
    logEvent('INFO', `Sesija pabeigta un slēgta: PIN ${data.pin}`);
  });

  socket.on('get-branding', (data: { pin: string }) => {
    const cleanPin = String(data?.pin || '').trim();
    const s = sessions.get(cleanPin);
    if (s?.branding) {
      socket.emit('session-branding', s.branding);
    }
  });

  socket.on('participant:test-buzzer', (data: { pin: string; playerId: string }) => {
    const binding = socketPlayerMap.get(socket.id);
    if (!binding || binding.pin !== data.pin || binding.playerId !== data.playerId) return;
    io.to(data.pin).emit('player-buzzer-test', { playerId: data.playerId });
  });

  socket.on('host:toggle-team-view', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (!s) return;

    if (!s.finalLeaderboardView) {
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
    }
    s.finalLeaderboardView = s.finalLeaderboardView === 'TEAMS' ? 'INDIVIDUAL' : 'TEAMS';
    s.currentPaging = 0;

    io.to(data.pin).emit('toggle-team-leaderboard', { view: s.finalLeaderboardView, page: 0 });
    saveSnapshot(data.pin, true);
  });

  socket.on('host:update-player', (data: any) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const players = sessionScores.get(data.pin);
    const s = sessions.get(data.pin);
    if (players && players.has(data.playerId)) {
      const p = players.get(data.playerId)!;
      if (data.name !== undefined) p.name = data.name;
      if (data.teamName !== undefined) p.teamName = data.teamName;
      if (data.score !== undefined) p.score = Number(data.score);
      if (data.totalTimeMs !== undefined) p.totalTimeMs = Number(data.totalTimeMs);
      if (data.isDisabled !== undefined) p.isDisabled = data.isDisabled;

      const isRound = s?.currentScene?.config?.lbType === 'ROUND';
      const sortedLb = getSortedLeaderboard(players, isRound);
      const sortedTeams = getSortedTeamLeaderboard(players, s?.branding?.teamScoringMode || 'AVG', isRound);

      io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      io.to(data.pin).emit('leaderboard-update', { data: sortedLb, lbType: s?.currentScene?.config?.lbType || 'TOTAL' });
      io.to(data.pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: s?.currentScene?.config?.lbType || 'TOTAL' });
      saveSnapshot(data.pin);
    }
  });

  socket.on('host:simulate-players', (data: { pin: string; hostToken: string; count: number }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const players = sessionScores.get(data.pin);
    const session = sessions.get(data.pin);
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
          totalTimeMs: 0,
          roundTimeMs: 0,
          isDisabled: false,
          isBot: true,
          teamName: isTeamMode ? sampleTeams[i % sampleTeams.length] : '',
          missedQuestionsCount: 0
        });
      }
    }

    const sortedTeams = getSortedTeamLeaderboard(players, session?.branding?.teamScoringMode || 'AVG', false);
    io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(data.pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: 'TOTAL' });
    logEvent('INFO', `Simulēti ${targetCount} boti sesijai: PIN ${data.pin}`);
    saveSnapshot(data.pin, true);
  });

  socket.on('host:clear-bots', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const players = sessionScores.get(data.pin);
    const session = sessions.get(data.pin);
    if (!players) return;

    players.forEach((p, id) => {
      if (p.isBot) players.delete(id);
    });

    const sortedTeams = getSortedTeamLeaderboard(players, session?.branding?.teamScoringMode || 'AVG', false);
    io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
    io.to(data.pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: 'TOTAL' });
    logEvent('INFO', `Dzēsti visi boti sesijai: PIN ${data.pin}`);
    saveSnapshot(data.pin, true);
  });

  socket.on('host:toggle-chart', (data: { pin: string; hostToken: string }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    io.to(data.pin).emit('toggle-audience-chart');
  });

  socket.on('host:change-leaderboard-page', (data: { pin: string; hostToken: string; page: number }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (s && s.currentScene?.type === 'LEADERBOARD') {
      s.currentPaging = data.page;
      io.to(data.pin).emit('leaderboard-page-change', data.page);
    }
  });

  // =========================================================================
  // SPACE VADĪBAS DZINĒJS AR DAUDZATBILŽU (2/2, 1/2, 0/2) PRECIZITĀTI
  // =========================================================================
  socket.on('host:advance', (data: { pin: string; hostToken: string; force?: boolean } | string) => {
    const pin = typeof data === 'string' ? data : data?.pin;
    const token = typeof data === 'string' ? undefined : data?.hostToken;
    const force = typeof data === 'object' ? !!data?.force : false;
    if (!isHostAuthorized(pin, token)) return;

    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    const now = Date.now();
    const lastAdvance = lastAdvanceTimestamps.get(pin) || 0;
    if (!force && now - lastAdvance < 300) {
      return;
    }
    lastAdvanceTimestamps.set(pin, now);

    if (s.subState === 'ACTIVE' && !force) {
      return;
    }

    clearSessionTimer(pin);

    // FINĀLA APBALVOŠANA
    if (s.currentScene?.type === 'LEADERBOARD' && s.currentScene?.config?.lbType === 'FINAL') {
      const activePlayers = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);
      const isTeamMode = !!s.branding?.teamModeEnabled;
      const teamList = isTeamMode ? getSortedTeamLeaderboard(playersMap!, s?.branding?.teamScoringMode || 'AVG', false) : [];

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
        const maxPages = Math.ceil(remainingCount / 10);

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
      (s.currentScene && (s.currentScene.type === 'BILLBOARD' || s.currentScene.type === 'LEADERBOARD'))
    ) {
      if (s.currentScene?.type === 'LEADERBOARD') resetRoundScores(pin);

      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) {
        clearSnapshot(pin);
        logEvent('INFO', `Spēle pabeigta: PIN ${pin}`);
        return io.to(pin).emit('game-over');
      }

      s.currentScene = s.scenes[s.currentSceneIdx];
      s.votes = [];
      s.isPaused = false;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.subState = 'READY';
      s.currentPaging = 0;
      s.finalPodiumStage = 0;
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
      delete s.summaryStats;

      emitStateUpdate(pin, s.currentScene, 'READY');

      if (s.currentScene.type === 'LEADERBOARD' && playersMap) {
        const isRound = s.currentScene?.config?.lbType === 'ROUND';
        const sortedLb = getSortedLeaderboard(playersMap, isRound);
        const sortedTeams = getSortedTeamLeaderboard(playersMap, s?.branding?.teamScoringMode || 'AVG', isRound);
        io.to(pin).emit('leaderboard-update', { data: sortedLb, lbType: s.currentScene?.config?.lbType || 'TOTAL' });
        io.to(pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: s.currentScene?.config?.lbType || 'TOTAL' });
      }
      saveSnapshot(pin, true);
    } 
    // 2. READY -> ACTIVE
    else if (s.subState === 'READY') {
      s.subState = 'ACTIVE';
      s.isPaused = false;
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
          if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
          emitStateUpdate(pin, currentSession.currentScene, 'STATS');
          io.to(pin).emit('video-command', 'pause');
          saveSnapshot(pin, true);
        }
      }, dur * 1000);
      sessionTimers.set(pin, timer);

      const options = s.currentScene?.config?.options || [];
      if (playersMap) {
        playersMap.forEach((p, id) => {
          if (p.isBot && !p.isDisabled) {
            const delay = Math.random() * Math.max(0.5, dur - 1) * 1000;
            setTimeout(() => {
              const currentSession = sessions.get(pin);
              if (currentSession?.subState === 'ACTIVE') {
                const selectedOption =
                  options.length > 0 ? [options[Math.floor(Math.random() * options.length)]] : ['A'];
                handleVote(pin, selectedOption, id);
              }
            }, delay);
          }
        });
      }
      saveSnapshot(pin, true);
    } 
    // 3. ACTIVE / PAUSED -> STATS
    else if (s.subState === 'ACTIVE' || s.subState === 'PAUSED') {
      s.subState = 'STATS';
      s.isPaused = false;
      s.currentScene.endTime = Date.now();
      emitStateUpdate(pin, s.currentScene, 'STATS');
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin, true);
    } 
    // 4. STATS -> SUMMARY (KOPSAVILKUMS AR DAUDZATBILŽU ANALĪZI: 2/2, 1/2, 0/2)
    else if (s.subState === 'STATS') {
      s.subState = 'SUMMARY';
      s.isPaused = false;
      s.isRevealed = false;

      const config = s.currentScene?.config || {};
      let correct = config.correctAnswers || [];

      if (s.currentScene?.type === 'MAJORITY') {
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
        let matchedCount = 0;
        if (Array.isArray(v.optionIds)) {
          v.optionIds.forEach((opt: string) => {
            if (correct.includes(opt)) matchedCount++;
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
      });

      const unsubmittedCount = Math.max(0, totalActive - s.votes.length);
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
        // Standarta 1 atbildes jautājumiem:
        correctCount: fullCorrectCount,
        correctPct: fullCorrectPct
      };

      emitStateUpdate(pin, s.currentScene, 'SUMMARY', { summaryStats: s.summaryStats });
      saveSnapshot(pin, true);
    } 
    // 5. SUMMARY -> REVEAL (PUNKTU IESKAITĪŠANA: 100%, 50%, 0%)
    else if (s.subState === 'SUMMARY') {
      s.subState = 'REVEAL';
      s.isRevealed = true;
      s.revealReadyToAdvance = false;

      const config = s.currentScene?.config || {};
      let correct = config.correctAnswers || [];
      const correctnessMap: Record<string, number> = config.answerCorrectness || {};

      if (s.currentScene?.type === 'MAJORITY') {
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

      const sortedVotes = [...s.votes].sort((a, b) => a.timeReceived - b.timeReceived);
      const votedPlayerIds = new Set(sortedVotes.map((v: any) => v.playerId));
      let correctCounter = 0;

      // AFK DEAKTIVIZĀCIJA
      const maxMissed = s.branding?.maxMissedQuestions || 5;
      playersMap?.forEach((p) => {
        if (!p.isDisabled && !p.isBot) {
          if (votedPlayerIds.has(p.id)) {
            p.missedQuestionsCount = 0;
          } else {
            p.missedQuestionsCount = (p.missedQuestionsCount || 0) + 1;
            if (p.missedQuestionsCount >= maxMissed) {
              p.isDisabled = true;
              logEvent('WARN', `Spēlētājs ${p.name} (#${p.deviceNumber}) atslēgts AFK dēļ (${p.missedQuestionsCount} kavējumi)`);
              io.to(pin).emit('player-disabled-afk', { playerId: p.id, name: p.name });
            }
          }
        }
      });

      // DAUDZATBILŽU PROPORCIONĀLA PUNKTU PIEŠĶIRŠANA (100%, 50%, 0%)
      sortedVotes.forEach((v: any) => {
        let earnedPercentage = 0;
        if (Array.isArray(v.optionIds)) {
          v.optionIds.forEach((opt: string) => {
            if (correct.includes(opt)) {
              const pct =
                correctnessMap[opt] !== undefined
                  ? correctnessMap[opt]
                  : isAnyOneMode
                  ? 100
                  : Math.round(100 / Math.max(1, correct.length));
              earnedPercentage += pct;
            }
          });
        }

        earnedPercentage = Math.min(100, earnedPercentage);

        if (playersMap) {
          const p = playersMap.get(v.playerId);
          if (p && !p.isDisabled) {
            const timeTaken = v.timeSpentMs || 0;
            p.totalTimeMs = (p.totalTimeMs || 0) + timeTaken;
            p.roundTimeMs = (p.roundTimeMs || 0) + timeTaken;

            if (earnedPercentage > 0) {
              let baseEarned = maxPoints;
              if (config.scoringMode === 'DECREASING') {
                const timeLeft = Math.max(0, (s.currentScene.endTime || Date.now()) - v.timeReceived);
                baseEarned = Math.round(minPoints + (timeLeft / totalDuration) * (maxPoints - minPoints));
              }

              if (config.speedBonusEnabled && earnedPercentage === 100 && correctCounter < 3) {
                const bonuses = [3, 2, 1];
                baseEarned += bonuses[correctCounter];
                correctCounter++;
              }

              const finalPts = Math.round((baseEarned * earnedPercentage) / 100);
              p.score = (p.score || 0) + finalPts;
              p.roundScore = (p.roundScore || 0) + finalPts;
            }
          }
        }
      });

      emitStateUpdate(pin, s.currentScene, 'REVEAL', { isRevealed: true, summaryStats: s.summaryStats });
      io.to(pin).emit('results-revealed', { correctAnswers: correct, correctnessMap });

      const nextScene = s.scenes[s.currentSceneIdx + 1];
      const isRound = nextScene?.config?.lbType === 'ROUND';
      const sortedLb = getSortedLeaderboard(playersMap!, isRound);
      const sortedTeams = getSortedTeamLeaderboard(playersMap!, s?.branding?.teamScoringMode || 'AVG', isRound);

      io.to(pin).emit('leaderboard-update', { data: sortedLb, lbType: nextScene?.config?.lbType || 'TOTAL' });
      io.to(pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: nextScene?.config?.lbType || 'TOTAL' });
      saveSnapshot(pin, true);
    }
  });

  socket.on('host:next-scene', (data: { pin: string; hostToken: string; scene: any }) => {
    if (!isHostAuthorized(data.pin, data.hostToken)) return;
    const s = sessions.get(data.pin);
    if (s) {
      clearSessionTimer(data.pin);
      if (s.currentScene?.type === 'LEADERBOARD') resetRoundScores(data.pin);

      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      s.isPaused = false;
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.currentPaging = 0;
      s.finalPodiumStage = 0;
      s.finalLeaderboardView = s.branding?.teamModeEnabled ? 'TEAMS' : 'INDIVIDUAL';
      delete s.summaryStats;

      emitStateUpdate(data.pin, s.currentScene, 'IDLE');
      saveSnapshot(data.pin, true);
    }
  });

  socket.on('join-session', (data: { pin: string; name: string; playerId: string; teamName?: string; isCaptain?: boolean }) => {
    if (sessions.has(data.pin)) {
      const session = sessions.get(data.pin);
      const players = sessionScores.get(data.pin)!;
      const isTeamMode = !!session?.branding?.teamModeEnabled;

      let playerObj = players.get(data.playerId);
      const sanitizedTeam = isTeamMode && data.teamName ? data.teamName.trim() : '';

      if (isTeamMode && sanitizedTeam) {
        const teamLower = sanitizedTeam.toLowerCase();
        let teamCaptainExists: PlayerState | null = null;

        players.forEach((p) => {
          if (p.teamName?.toLowerCase() === teamLower && p.isCaptain && p.id !== data.playerId) {
            teamCaptainExists = p;
          }
        });

        if (data.isCaptain && teamCaptainExists) {
          return socket.emit(
            'error-message',
            `❌ Komanda ar nosaukumu "${sanitizedTeam}" jau ir reģistrēta!\nLūdzu noskenējiet sava kapteiņa QR kodu vai izdomājiet atšķirīgu nosaukumu.`
          );
        }

        if (!data.isCaptain && !teamCaptainExists) {
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

      if (data.name !== 'EKRĀNS') {
        if (!participants.has(data.pin)) participants.set(data.pin, new Set());
        participants.get(data.pin)?.add(socket.id);

        socketPlayerMap.set(socket.id, { pin: data.pin, playerId: data.playerId });

        if (!playerObj) {
          playerObj = {
            id: data.playerId,
            name: data.name.trim(),
            teamName: sanitizedTeam,
            isCaptain: isTeamMode ? !!data.isCaptain : false,
            deviceNumber: players.size + 1,
            score: 0,
            roundScore: 0,
            totalTimeMs: 0,
            roundTimeMs: 0,
            isDisabled: false,
            isBot: false,
            missedQuestionsCount: 0
          };
          players.set(data.playerId, playerObj);
        } else {
          if (data.name) playerObj.name = data.name.trim();
          playerObj.teamName = sanitizedTeam;
          if (isTeamMode && data.isCaptain !== undefined) playerObj.isCaptain = !!data.isCaptain;
        }
      }

      const isRound = session?.currentScene?.config?.lbType === 'ROUND';
      const sortedTeams = getSortedTeamLeaderboard(players, session?.branding?.teamScoringMode || 'AVG', isRound);

      io.to(data.pin).emit('presence-update', {
        count: players.size,
        players: Array.from(players.values())
      });
      io.to(data.pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: session?.currentScene?.config?.lbType || 'TOTAL' });

      const sanitizedScene = sanitizeSceneForPlayer(session?.currentScene, session?.subState);

      socket.emit('join-success', {
        pin: data.pin,
        playerId: data.playerId,
        deviceNumber: playerObj?.deviceNumber || 1,
        branding: session?.branding || {},
        connectionUrl: session?.connectionUrl || publicTunnelUrl || '',
        currentScene: sanitizedScene,
        subState: session?.subState,
        teamName: playerObj?.teamName || '',
        isCaptain: !!playerObj?.isCaptain
      });

      saveSnapshot(data.pin);
    } else {
      socket.emit('error-message', 'Sesija ar šādu PIN kodu nav atrasta.');
    }
  });

  socket.on('participant:submit-answer', (data: { pin: string; playerId: string; answers?: string[]; answer?: string }) => {
    const binding = socketPlayerMap.get(socket.id);
    if (!binding || binding.pin !== data.pin || binding.playerId !== data.playerId) {
      return socket.emit('error-message', 'Neautorizēta atbildes iesniegšana!');
    }
    const answerList = Array.isArray(data.answers) ? data.answers : data.answer ? [data.answer] : [];
    handleVote(data.pin, answerList, data.playerId);
  });

  socket.on('disconnect', () => {
    socketPlayerMap.delete(socket.id);
    participants.forEach((set, pin) => {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        const players = sessionScores.get(pin);
        const session = sessions.get(pin);
        if (players) {
          const isRound = session?.currentScene?.config?.lbType === 'ROUND';
          const sortedTeams = getSortedTeamLeaderboard(players, session?.branding?.teamScoringMode || 'AVG', isRound);
          io.to(pin).emit('presence-update', {
            count: players.size,
            players: Array.from(players.values())
          });
          io.to(pin).emit('team-leaderboard-update', { data: sortedTeams, lbType: session?.currentScene?.config?.lbType || 'TOTAL' });
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