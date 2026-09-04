import express from 'express';
import cors from 'cors';
import * as path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const prisma = new PrismaClient();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// DINAMISKĀ MAPE: Serveris tagad skatās tur, kur Tu iestati ceļu
let currentProjectPath = path.resolve(process.cwd(), '../../public/uploads'); 

app.use('/project-media', (req, res, next) => {
  express.static(currentProjectPath)(req, res, next);
});

const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, any>>();

// --- API LABOJUMI ---

// Ielādēt konkrēta projekta failu (Host panelim)
app.get('/api/projects/:name', (req, res) => {
  const filePath = path.join(currentProjectPath, req.params.name);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } else {
    res.status(404).json({ error: "Fails nav atrasts" });
  }
});

app.get('/api/shows', async (req, res) => {
  const data = await prisma.show.findMany({ include: { versions: true } });
  res.json(data);
});

app.post('/api/set-path', (req, res) => {
  currentProjectPath = req.body.path;
  const files = fs.readdirSync(currentProjectPath).filter(f => f.endsWith('.json'));
  res.json({ success: true, projects: files });
});

app.post('/api/save-to-file', (req, res) => {
  const fileName = req.body.fileName.endsWith('.json') ? req.body.fileName : req.body.fileName + '.json';
  const filePath = path.join(currentProjectPath, fileName);
  fs.writeFileSync(filePath, JSON.stringify(req.body.data, null, 2));
  res.json({ success: true });
});

// --- SOCKET.IO SINHRONIZĀCIJA ---

io.on('connection', (socket) => {
  socket.on('host:create-session', (data: { projectData: any }) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    sessions.set(pin, { 
      currentSceneIdx: -1, 
      scenes: data.projectData.scenes, 
      subState: 'IDLE', 
      votes: [],
      currentScene: null
    });
    sessionScores.set(pin, new Map());
    socket.join(pin);
    socket.emit('session-info', { pin, state: sessions.get(pin) });
  });

  socket.on('host:advance', (pin: string) => {
    const s = sessions.get(pin);
    if (!s) return;

    if (s.subState === 'IDLE' || s.subState === 'REVEAL') {
      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) return io.to(pin).emit('game-over');
      s.subState = 'READY';
      s.votes = [];
      s.currentScene = { ...s.scenes[s.currentSceneIdx], subState: 'READY' };
      io.to(pin).emit('state-update', s.currentScene);
    } else if (s.subState === 'READY') {
      s.subState = 'ACTIVE';
      const dur = s.currentScene.config.duration || 30;
      s.currentScene.endTime = Date.now() + (dur * 1000);
      s.currentScene.subState = 'ACTIVE';
      io.to(pin).emit('state-update', s.currentScene);
    } else if (s.subState === 'ACTIVE') {
      s.subState = 'STATS';
      io.to(pin).emit('stats-revealed');
    } else {
      s.subState = 'REVEAL';
      const correct = s.currentScene.config.correctAnswers || [];
      const players = sessionScores.get(pin);
      s.votes.forEach((v: any) => {
        const hits = v.optionIds.filter((id: string) => correct.includes(id)).length;
        const pts = Math.round((hits / Math.max(1, correct.length)) * 10);
        const p = players?.get(v.playerId);
        if (p) p.score += pts;
      });
      io.to(pin).emit('results-revealed', { correctAnswers: correct });
      io.to(pin).emit('leaderboard-update', Array.from(players?.values() || []).sort((a,b) => b.score - a.score));
    }
  });

  socket.on('join-session', (data: any) => {
    const s = sessions.get(data.pin);
    if (s) {
      socket.join(data.pin);
      const players = sessionScores.get(data.pin)!;
      if (data.name !== 'EKRĀNS' && !players.has(data.playerId)) {
        players.set(data.playerId, { name: data.name, score: 0 });
      }
      io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      // JAUNUMS: Sūtām pilnu stāvokli (Snapshot), lai spēlētājs uzreiz redz pareizo fāzi
      socket.emit('join-success', { pin: data.pin, currentScene: s.currentScene, subState: s.subState });
    }
  });

  socket.on('participant:submit-answer', (data: any) => {
    const s = sessions.get(data.pin);
    if (s?.subState === 'ACTIVE') {
      s.votes = s.votes.filter((v:any) => v.playerId !== data.playerId);
      s.votes.push({ optionIds: data.answers, playerId: data.playerId });
      const summary: any = {};
      s.votes.forEach((v: any) => v.optionIds.forEach((o: string) => summary[o] = (summary[o] || 0) + 1));
      io.to(data.pin).emit('votes-updated', summary);
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`🚀 DZINĒJS SALABOTS UN GATAVS!`));