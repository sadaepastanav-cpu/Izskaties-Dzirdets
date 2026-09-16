import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import fs from 'fs';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { spawn } from 'child_process';
import rateLimit from 'express-rate-limit';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'izskaties_dzirdets_super_secret_key_2026';

let publicTunnelUrl = '';

// 1. DROŠS CORS
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

// 2. RATE LIMITING
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Pārāk daudz pieprasījumu. Lūdzu, uzgaidiet brīdi.' }
});

const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { error: 'Pārāk daudz augšupielāžu vienlaikus.' }
});

app.use('/api/', apiLimiter);

// 3. SOCKET.IO
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

// ADMIN AUTH MIDDLEWARE
const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const incomingKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (incomingKey === ADMIN_API_KEY) {
    return next();
  }
  return res.status(403).json({ error: 'Piekļuve liegta: Nepieciešama derīga administratora atslēga.' });
};

// FAILU SISTĒMA
let currentProjectPath = path.resolve(process.cwd(), '../../public/uploads');
if (!fs.existsSync(currentProjectPath)) {
  fs.mkdirSync(currentProjectPath, { recursive: true });
}

const safeResolve = (userFileName: string): string => {
  const safeBase = path.basename(userFileName);
  return path.join(currentProjectPath, safeBase);
};

// MULTER VALIDĀCIJA
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
      cb(new Error('Neatļauts faila tips! Drīkst augšupielādēt tikai attēlus, video un audio.'));
    }
  }
});

function startCloudflareTunnel() {
  console.log('[Cloudflare] Startējam tuneli...');

  try {
    const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5173'], {
      shell: true
    });

    const handleOutput = (data: any) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match && !publicTunnelUrl) {
        publicTunnelUrl = match[0];
        console.log(`\n=========================================`);
        console.log(`🚀 DINAMISKAIS CLOUDFLARE LINKS: ${publicTunnelUrl}`);
        console.log(`=========================================\n`);

        io.emit('tunnel-ready', { url: publicTunnelUrl });

        sessions.forEach((sessionData, sessionPin) => {
          sessionData.connectionUrl = publicTunnelUrl;
          io.to(sessionPin).emit('connection-url-changed', publicTunnelUrl);
          saveSnapshot(sessionPin);
        });
      }
    };

    tunnel.stdout?.on('data', handleOutput);
    tunnel.stderr?.on('data', handleOutput);
    tunnel.on('error', (err) => console.error('⚠️ [Cloudflare] Kļūda:', err.message));
    tunnel.on('close', (code) => console.log(`[Cloudflare] Tunelis aizvērts (${code})`));
  } catch (err: any) {
    console.error('⚠️ [Cloudflare] Izsaukuma kļūda:', err.message);
  }
}

app.use('/project-media', (req, res, next) => {
  if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
    return res.status(404).send('Mape nav iestatīta vai neeksistē');
  }
  express.static(currentProjectPath)(req, res, next);
});

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

// SESIJU STĀVOKĻA MAPES
const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, any>>();
const participants = new Map<string, Set<string>>();
// TAIMERI TIEK GLABĀTI ĀRPUS SESIJAS DATIEM, LAI NEVEIDOTU CIRCULAR STRUCTURE KĻŪDU
const sessionTimers = new Map<string, NodeJS.Timeout>();

const clearSessionTimer = (pin: string) => {
  if (sessionTimers.has(pin)) {
    clearTimeout(sessionTimers.get(pin)!);
    sessionTimers.delete(pin);
  }
};

const saveSnapshot = (pin: string) => {
  try {
    const state = sessions.get(pin);
    const scores = sessionScores.get(pin);
    if (!state) return;

    // Klonējam tīru stāvokli bez taimeriem
    const cleanState = { ...state };
    delete (cleanState as any).activeTimerTimeout;

    const payload = {
      timestamp: new Date().toISOString(),
      pin,
      state: cleanState,
      scores: Array.from(scores?.entries() || [])
    };

    fs.writeFileSync(path.join(currentProjectPath, 'active_session.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(currentProjectPath, 'last_session_snapshot.json'), JSON.stringify(payload, null, 2));
  } catch (err: any) {
    console.error(`[Snapshot] Kļūda saglabājot sesiju ${pin}:`, err.message);
  }
};

const clearSnapshot = (pin: string) => {
  try {
    const activeFile = path.join(currentProjectPath, 'active_session.json');
    const lastFile = path.join(currentProjectPath, 'last_session_snapshot.json');
    const pinFile = path.join(currentProjectPath, `snapshot_${pin}.json`);
    if (fs.existsSync(activeFile)) fs.unlinkSync(activeFile);
    if (fs.existsSync(lastFile)) fs.unlinkSync(lastFile);
    if (fs.existsSync(pinFile)) fs.unlinkSync(pinFile);
  } catch (err: any) {
    console.error(`[Snapshot] Kļūda dzēšot snapshot:`, err.message);
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

// BALSOŠANAS LOĢIKA
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

    io.to(pin).emit('votes-updated', { summary, votedCount: s.votes.length });

    const isFullTimeMode = s.branding?.timerMode === 'FULL_TIME';

    if (!isFullTimeMode && activeParticipantsCount > 0 && s.votes.length >= activeParticipantsCount) {
      clearSessionTimer(pin);
      s.subState = 'STATS';
      if (s.currentScene) s.currentScene.endTime = Date.now();
      io.to(pin).emit('state-update', { ...s.currentScene, subState: 'STATS' });
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin);
    }
  }
};

// --- REST API MARŠRUTI ---
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

app.get('/api/network-ip', (_req, res) => {
  res.json({ localIp: getLocalIpAddress(), tunnelUrl: publicTunnelUrl });
});

app.get('/api/check-recovery', (_req, res) => {
  try {
    const p1 = path.join(currentProjectPath, 'active_session.json');
    const p2 = path.join(currentProjectPath, 'last_session_snapshot.json');
    const target = fs.existsSync(p1) ? p1 : p2;
    if (fs.existsSync(target)) {
      const data = JSON.parse(fs.readFileSync(target, 'utf-8'));
      res.json({ canRecover: true, pin: data.pin, title: data.state?.currentScene?.title || 'Saglabātā Sesija', ...data });
    } else res.json({ canRecover: false });
  } catch (err: any) {
    console.error('Kļūda /api/check-recovery:', err.message);
    res.json({ canRecover: false });
  }
});

app.get('/api/current-path', requireAdminAuth, (_req, res) => res.json({ currentPath: currentProjectPath }));

app.post('/api/set-path', requireAdminAuth, (req, res) => {
  try {
    if (req.body.path?.trim()) currentProjectPath = path.resolve(req.body.path.trim());
    if (!fs.existsSync(currentProjectPath)) fs.mkdirSync(currentProjectPath, { recursive: true });
    const projects = fs.readdirSync(currentProjectPath).filter((f) => f.endsWith('.json') && !f.includes('snapshot'));
    const media = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    res.json({ success: true, currentPath: currentProjectPath, projects, media });
  } catch (err: any) {
    console.error('Kļūda /api/set-path:', err.message);
    res.status(500).json({ error: 'Kļūda piekļūstot mapei' });
  }
});

app.get('/api/media-list', requireAdminAuth, (_req, res) => {
  try {
    if (!currentProjectPath || !fs.existsSync(currentProjectPath)) return res.json([]);
    const files = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    res.json(files);
  } catch (err: any) {
    console.error('Kļūda /api/media-list:', err.message);
    res.status(500).json({ error: 'Kļūda nolasot medijus' });
  }
});

app.post('/api/upload-media', requireAdminAuth, uploadLimiter, upload.single('mediaFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nav faila vai neatļauts formāts' });
    const files = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    io.emit('media-list', files);
    res.json({ success: true, fileName: req.file.filename, files });
  } catch (err: any) {
    console.error('Kļūda /api/upload-media:', err.message);
    res.status(500).json({ error: 'Kļūda saglabājot failu' });
  }
});

app.get('/api/list-projects', requireAdminAuth, (_req, res) => {
  try {
    if (!currentProjectPath || !fs.existsSync(currentProjectPath)) return res.json([]);
    const files = fs.readdirSync(currentProjectPath).filter((f) => f.endsWith('.json') && !f.includes('snapshot'));
    res.json(files);
  } catch (err: any) {
    console.error('Kļūda /api/list-projects:', err.message);
    res.status(500).json({ error: 'Kļūda nolasot projektus' });
  }
});

app.get('/api/load-project/:name', requireAdminAuth, (req, res) => {
  try {
    const filePath = safeResolve(req.params.name.endsWith('.json') ? req.params.name : `${req.params.name}.json`);
    if (fs.existsSync(filePath)) res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    else res.status(404).json({ error: 'Fails nav atrasts' });
  } catch (err: any) {
    console.error('Kļūda /api/load-project:', err.message);
    res.status(500).json({ error: 'Kļūda nolasot failu' });
  }
});

app.post('/api/save-to-file', requireAdminAuth, (req, res) => {
  try {
    const rawName = req.body.fileName || 'project';
    const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = safeResolve(fileName);
    fs.writeFileSync(filePath, JSON.stringify(req.body.data, null, 2));
    res.json({ success: true, fileName: path.basename(filePath), fullPath: filePath });
  } catch (err: any) {
    console.error('Kļūda /api/save-to-file:', err.message);
    res.status(500).json({ error: 'Neizdevās saglabāt' });
  }
});

app.post('/api/recover-session', requireAdminAuth, (_req, res) => {
  try {
    const p1 = path.join(currentProjectPath, 'active_session.json');
    if (fs.existsSync(p1)) {
      const data = JSON.parse(fs.readFileSync(p1, 'utf-8'));
      sessions.set(data.pin, data.state);
      sessionScores.set(data.pin, new Map(data.scores));
      if (!participants.has(data.pin)) participants.set(data.pin, new Set());
      res.json({ success: true, pin: data.pin, state: data.state });
    } else res.status(404).json({ error: 'Nav faila' });
  } catch (err: any) {
    console.error('Kļūda /api/recover-session:', err.message);
    res.status(500).json({ error: 'Kļūda atjaunojot' });
  }
});

app.post('/api/cleanup-session', requireAdminAuth, (req, res) => {
  try {
    const { pin } = req.body;

    if (pin) {
      clearSessionTimer(pin);
      io.to(pin).emit('session-ended');
      sessions.delete(pin);
      sessionScores.delete(pin);
      participants.delete(pin);
      clearSnapshot(pin);
    } else {
      sessions.forEach((_, p) => clearSessionTimer(p));
      io.emit('session-ended');
      sessions.clear();
      sessionScores.clear();
      participants.clear();
    }

    const files = fs.readdirSync(currentProjectPath);
    files.forEach((file) => {
      if (file.includes('snapshot') || file.includes('active_session')) {
        try {
          fs.unlinkSync(path.join(currentProjectPath, file));
        } catch {}
      }
    });

    console.log(`[Cleanup] Sesijas veiksmīgi dzēstas.`);
    res.json({ success: true, message: 'Dati un sesijas veiksmīgi dzēstas.' });
  } catch (err: any) {
    console.error('Kļūda /api/cleanup-session:', err.message);
    res.status(500).json({ error: 'Kļūda tīrot datus' });
  }
});

// --- SOCKET.IO NOTIKUMI ---
io.on('connection', (socket) => {
  if (publicTunnelUrl) {
    socket.emit('tunnel-ready', { url: publicTunnelUrl });
  }

  socket.on('host:create-session', (data: any) => {
    const pin = data.existingPin || Math.floor(1000 + Math.random() * 9000).toString();
    const finalUrl = data.connectionUrl || publicTunnelUrl || `http://${getLocalIpAddress()}:5173`;

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
      questionStartTime: 0
    };

    sessions.set(pin, sessionData);
    if (!sessionScores.has(pin)) sessionScores.set(pin, new Map());
    if (!participants.has(pin)) participants.set(pin, new Set());

    socket.join(pin);
    socket.emit('session-info', { pin, state: sessionData });
    saveSnapshot(pin);
  });

  // SESIJAS BEIGŠANA NO HOST PULTS
  socket.on('host:end-session', (data: { pin: string }) => {
    const pin = data?.pin;
    if (!pin) return;

    clearSessionTimer(pin);
    io.to(pin).emit('session-ended');
    clearSnapshot(pin);
    sessions.delete(pin);
    sessionScores.delete(pin);
    participants.delete(pin);
    console.log(`[Host] Sesija ${pin} veiksmīgi noslēgta.`);
  });

  socket.on('host:update-connection-url', (data: { pin: string; connectionUrl: string }) => {
    const s = sessions.get(data.pin);
    if (s) {
      s.connectionUrl = data.connectionUrl;
      io.to(data.pin).emit('connection-url-changed', data.connectionUrl);
      saveSnapshot(data.pin);
    }
  });

  socket.on('get-branding', (data: { pin: string }) => {
    const cleanPin = String(data?.pin || '').trim();
    const s = sessions.get(cleanPin);
    if (s && s.branding) {
      socket.emit('session-branding', s.branding);
    }
  });

  socket.on('participant:test-buzzer', (data: { pin: string; playerId: string }) => {
    io.to(data.pin).emit('player-buzzer-test', { playerId: data.playerId });
  });

  socket.on('host:update-player', (data: { pin: string; playerId: string; name?: string; score?: number; totalTimeMs?: number; isDisabled?: boolean }) => {
    const players = sessionScores.get(data.pin);
    const s = sessions.get(data.pin);
    if (players && players.has(data.playerId)) {
      const p = players.get(data.playerId);
      if (data.name !== undefined) p.name = data.name;
      if (data.score !== undefined) p.score = Number(data.score);
      if (data.totalTimeMs !== undefined) p.totalTimeMs = Number(data.totalTimeMs);
      if (data.isDisabled !== undefined) p.isDisabled = data.isDisabled;

      const isRound = s?.currentScene?.config?.lbType === 'ROUND';
      const sortedLb = getSortedLeaderboard(players, isRound);

      io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      io.to(data.pin).emit('leaderboard-update', {
        data: sortedLb,
        lbType: s?.currentScene?.config?.lbType || 'TOTAL'
      });
      saveSnapshot(data.pin);
    }
  });

  socket.on('host:simulate-players', (data: { pin: string; count: number }) => {
    const players = sessionScores.get(data.pin);
    if (!players) return;

    for (let i = 0; i < data.count; i++) {
      const botId = `bot_${i}`;
      if (!players.has(botId)) {
        players.set(botId, {
          id: botId,
          name: `Dalībnieks-${i + 1}`,
          deviceNumber: players.size + 1,
          score: 0,
          roundScore: 0,
          totalTimeMs: 0,
          roundTimeMs: 0,
          isDisabled: false,
          isBot: true
        });
      }
    }

    io.to(data.pin).emit('presence-update', {
      count: players.size,
      players: Array.from(players.values())
    });
  });

  socket.on('host:toggle-chart', (data: { pin: string }) => {
    io.to(data.pin).emit('toggle-audience-chart');
  });

  socket.on('host:change-leaderboard-page', (data: { pin: string; page: number }) => {
    const s = sessions.get(data.pin);
    if (s && s.currentScene?.type === 'LEADERBOARD') {
      s.currentPaging = data.page;
      io.to(data.pin).emit('leaderboard-page-change', data.page);
    }
  });

  const getSortedLeaderboard = (playersMap: Map<string, any>, isRound: boolean) => {
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

  socket.on('host:advance', (pin: string) => {
    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    clearSessionTimer(pin);

    // FINĀLA APBALVOŠANAS PLŪSMA
    if (s.currentScene?.type === 'LEADERBOARD' && s.currentScene?.config?.lbType === 'FINAL') {
      const activePlayers = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled);
      const totalPlayers = activePlayers.length;
      if (s.finalPodiumStage === undefined) s.finalPodiumStage = 0;

      if (totalPlayers <= 2) {
        if (s.finalPodiumStage < 2) s.finalPodiumStage = 2;
        else if (s.finalPodiumStage === 2) s.finalPodiumStage = 3;
        else {
          clearSnapshot(pin);
          return io.to(pin).emit('game-over');
        }
        io.to(pin).emit('podium-stage-change', s.finalPodiumStage);
        saveSnapshot(pin);
        return;
      }

      if (s.finalPodiumStage < 3) {
        s.finalPodiumStage++;
        io.to(pin).emit('podium-stage-change', s.finalPodiumStage);
      } else if (s.finalPodiumStage === 3) {
        s.finalPodiumStage = 4;
        s.currentPaging = 0;
        io.to(pin).emit('podium-stage-change', 4);
        io.to(pin).emit('leaderboard-page-change', 0);
      } else if (s.finalPodiumStage === 4) {
        const remainingCount = Math.max(0, totalPlayers - 3);
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
      saveSnapshot(pin);
      return;
    }

    // LEADERBOARD LAPU ŠĶIRŠANA
    if (s.currentScene && s.currentScene.type === 'LEADERBOARD') {
      const totalPlayers = Array.from(playersMap?.values() || []).filter((p) => !p.isDisabled).length;
      const maxPages = Math.ceil(totalPlayers / 10);
      if (s.currentPaging < maxPages - 1) {
        s.currentPaging++;
        io.to(pin).emit('leaderboard-page-change', s.currentPaging);
        return;
      }
    }

    if (s.subState === 'REVEAL' && !s.revealReadyToAdvance) {
      s.revealReadyToAdvance = true;
      io.to(pin).emit('reveal-wait-for-host');
      return;
    }

    // PĀREJA UZ NĀKAMO SLAIDU
    if (
      s.subState === 'IDLE' ||
      s.subState === 'REVEAL' ||
      (s.currentScene && (s.currentScene.type === 'BILLBOARD' || s.currentScene.type === 'LEADERBOARD'))
    ) {
      // Ja iepriekšējais slaids bija LEADERBOARD, atiestatām kārtas punktus jaunajai kārtai!
      if (s.currentScene?.type === 'LEADERBOARD') {
        resetRoundScores(pin);
      }

      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) {
        clearSnapshot(pin);
        return io.to(pin).emit('game-over');
      }

      s.currentScene = s.scenes[s.currentSceneIdx];
      s.votes = [];
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.subState = 'READY';
      s.currentPaging = 0;
      s.finalPodiumStage = 0;

      io.to(pin).emit('state-update', { ...s.currentScene, subState: 'READY' });

      if (s.currentScene.type === 'LEADERBOARD' && playersMap) {
        const isRound = s.currentScene?.config?.lbType === 'ROUND';
        const sortedLeaderboard = getSortedLeaderboard(playersMap, isRound);
        io.to(pin).emit('leaderboard-update', {
          data: sortedLeaderboard,
          lbType: s.currentScene?.config?.lbType || 'TOTAL'
        });
      }
      saveSnapshot(pin);
    } else if (s.subState === 'READY') {
      s.subState = 'ACTIVE';
      s.questionStartTime = Date.now();
      const dur = s.currentScene?.config?.duration || s.currentScene?.config?.timeLimit || 30;
      s.currentScene.endTime = Date.now() + dur * 1000;
      io.to(pin).emit('state-update', { ...s.currentScene, subState: 'ACTIVE' });

      // AUTOMĀTISKAIS TAIMERIS
      clearSessionTimer(pin);
      const timer = setTimeout(() => {
        const currentSession = sessions.get(pin);
        if (currentSession && currentSession.subState === 'ACTIVE') {
          currentSession.subState = 'STATS';
          if (currentSession.currentScene) currentSession.currentScene.endTime = Date.now();
          io.to(pin).emit('state-update', { ...currentSession.currentScene, subState: 'STATS' });
          io.to(pin).emit('video-command', 'pause');
          saveSnapshot(pin);
        }
      }, dur * 1000);
      sessionTimers.set(pin, timer);

      const options = s.currentScene?.config?.options || [];
      playersMap?.forEach((p, id) => {
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
      saveSnapshot(pin);
    } else if (s.subState === 'ACTIVE') {
      s.subState = 'STATS';
      s.currentScene.endTime = Date.now();
      io.to(pin).emit('state-update', { ...s.currentScene, subState: 'STATS' });
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin);
    } else if (s.subState === 'STATS') {
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
      let correctCounter = 0;

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

              if (config.speedBonusEnabled && correctCounter < 3) {
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

      io.to(pin).emit('state-update', { ...s.currentScene, subState: 'REVEAL', isRevealed: true });
      io.to(pin).emit('results-revealed', { correctAnswers: correct, correctnessMap });

      const nextScene = s.scenes[s.currentSceneIdx + 1];
      const isRound = nextScene?.config?.lbType === 'ROUND';
      const sortedLb = getSortedLeaderboard(playersMap!, isRound);

      io.to(pin).emit('leaderboard-update', {
        data: sortedLb,
        lbType: nextScene?.config?.lbType || 'TOTAL'
      });
      saveSnapshot(pin);
    }
  });

  socket.on('host:next-scene', (data: { pin: string; scene: any }) => {
    const s = sessions.get(data.pin);
    if (s) {
      clearSessionTimer(data.pin);

      if (s.currentScene?.type === 'LEADERBOARD') {
        resetRoundScores(data.pin);
      }

      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      s.isRevealed = false;
      s.revealReadyToAdvance = false;
      s.currentPaging = 0;
      s.finalPodiumStage = 0;
      io.to(data.pin).emit('state-update', s.currentScene);
      saveSnapshot(data.pin);
    }
  });

  socket.on('join-session', (data: { pin: string; name: string; playerId: string }) => {
    if (sessions.has(data.pin)) {
      socket.join(data.pin);
      const players = sessionScores.get(data.pin)!;

      let playerObj = players.get(data.playerId);
      if (data.name !== 'EKRĀNS') {
        if (!participants.has(data.pin)) participants.set(data.pin, new Set());
        participants.get(data.pin)?.add(socket.id);

        if (!playerObj) {
          const deviceNumber = players.size + 1;
          playerObj = {
            id: data.playerId,
            name: data.name,
            deviceNumber,
            score: 0,
            roundScore: 0,
            totalTimeMs: 0,
            roundTimeMs: 0,
            isDisabled: false,
            isBot: false
          };
          players.set(data.playerId, playerObj);
        } else {
          if (data.name && data.name !== playerObj.name) {
            playerObj.name = data.name;
          }
        }
      }

      io.to(data.pin).emit('presence-update', {
        count: players.size,
        players: Array.from(players.values())
      });

      const session = sessions.get(data.pin);

      socket.emit('join-success', {
        pin: data.pin,
        playerId: data.playerId,
        deviceNumber: playerObj?.deviceNumber || 1,
        branding: session?.branding || {},
        connectionUrl: session?.connectionUrl || publicTunnelUrl || '',
        currentScene: session?.currentScene,
        subState: session?.subState
      });
    } else {
      socket.emit('error-message', 'Sesija ar šādu PIN kodu nav atrasta.');
    }
  });

  socket.on('participant:submit-answer', (data: { pin: string; playerId: string; answers?: string[]; answer?: string }) => {
    const answerList = Array.isArray(data.answers) ? data.answers : data.answer ? [data.answer] : [];
    handleVote(data.pin, answerList, data.playerId);
  });

  socket.on('disconnect', () => {
    participants.forEach((set, pin) => {
      if (set.has(socket.id)) {
        set.delete(socket.id);
        const players = sessionScores.get(pin);
        io.to(pin).emit('presence-update', {
          count: players ? players.size : set.size,
          players: players ? Array.from(players.values()) : []
        });
      }
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 EVENT STUDIO SERVERIS PALAISTS UZ PORTA: ${PORT}`);
  console.log(`📡 Lokālā tīkla IP adrese: http://${getLocalIpAddress()}:5173`);

  startCloudflareTunnel();
});