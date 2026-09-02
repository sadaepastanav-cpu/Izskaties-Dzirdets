import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DINAMISKĀ MAPE: Ļauj piekļūt Taviem attēliem/video bez augšuplādes
let projectFolderPath = path.resolve(process.cwd(), '../../public/uploads'); 
app.use('/project-media', (req, res, next) => {
  express.static(projectFolderPath)(req, res, next);
});

const sessions = new Map<string, any>();
const scores = new Map<string, Map<string, any>>();

io.on('connection', (socket) => {
  // Studio paziņo, kurā mapē stāv bildes
  socket.on('host:set-project-path', (folder: string) => {
    projectFolderPath = folder;
    console.log("📂 Mediju mape piesaistīta:", folder);
  });

  socket.on('host:create-session', async (data: { showId: string }) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const version = await prisma.showVersion.findFirst({ where: { showId: data.showId }, orderBy: { createdAt: 'desc' } });
    if (!version) return;

    sessions.set(pin, { currentScene: null, votes: [], scenes: version.scenes, subState: 'IDLE' });
    scores.set(pin, new Map());
    socket.join(pin);
    socket.emit('session-info', { pin, state: sessions.get(pin) });
  });

  socket.on('host:advance', (pin: string) => {
    const s = sessions.get(pin);
    if (!s || !s.currentScene) return;

    if (s.subState === 'IDLE') { // Sākt taimeri
      s.subState = 'ACTIVE';
      const dur = s.currentScene.config.duration || 30;
      s.currentScene.endTime = Date.now() + (dur * 1000);
      io.to(pin).emit('state-update', s.currentScene);
    } else if (s.subState === 'ACTIVE') { // Rādīt stabiņus
      s.subState = 'STATS';
      io.to(pin).emit('stats-revealed');
    } else { // Atklāt atbildi un skaitīt punktus
      s.subState = 'REVEAL';
      const correct = s.currentScene.config.correctAnswers || [];
      const players = scores.get(pin);
      s.votes.forEach((v: any) => {
        const hits = v.optionIds.filter((id: string) => correct.includes(id)).length;
        const pts = Math.round((hits / Math.max(1, correct.length)) * 10);
        const p = players?.get(v.playerId);
        if (p) p.score += pts;
      });
      io.to(pin).emit('results-revealed', { correctAnswers: correct });
    }
  });

  socket.on('join-session', (data: { pin: string, name: string, playerId: string }) => {
    const s = sessions.get(data.pin);
    if (s) {
      socket.join(data.pin);
      const players = scores.get(data.pin)!;
      if (data.name !== 'EKRĀNS' && !players.has(data.playerId)) players.set(data.playerId, { name: data.name, score: 0 });
      io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      socket.emit('join-success', { pin: data.pin, currentScene: s.currentScene });
    }
  });

  socket.on('participant:submit-answer', (data: { pin: string, answers: string[], playerId: string }) => {
    const s = sessions.get(data.pin);
    if (s?.subState === 'ACTIVE') {
      s.votes = s.votes.filter((v:any) => v.playerId !== data.playerId);
      s.votes.push({ optionIds: data.answers, playerId: data.playerId });
      const summary: any = {};
      s.votes.forEach((v: any) => v.optionIds.forEach((o: string) => summary[o] = (summary[o] || 0) + 1));
      io.to(data.pin).emit('votes-updated', summary);
    }
  });

  socket.on('host:next-scene', (data: { pin: string, scene: any }) => {
    const s = sessions.get(data.pin);
    if (s) {
      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      io.to(data.pin).emit('state-update', s.currentScene);
    }
  });
});

app.get('/api/shows', async (req, res) => {
  const data = await prisma.show.findMany({ include: { versions: true } });
  res.json(data);
});

app.post('/api/shows', async (req, res) => {
  const show = await prisma.show.create({
    data: { title: req.body.title, ownerId: (await prisma.user.findFirst())!.id, 
    versions: { create: { scenes: req.body.scenes, version: 1 } } }
  });
  res.json(show);
});

httpServer.listen(PORT, () => console.log(`🚀 DZINĒJS GATAVS UZ PORTA ${PORT}`));