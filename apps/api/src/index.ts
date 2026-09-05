import * as dotenv from 'dotenv';
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

// Nokalusējuma pasākuma/mediju mape un tās droša izveide
let currentProjectPath = path.resolve(process.cwd(), '../../public/uploads');
if (!fs.existsSync(currentProjectPath)) {
  fs.mkdirSync(currentProjectPath, { recursive: true });
}

// Statisko mediju piekļuve (Attēli, Video, Audio)
app.use('/project-media', (req, res, next) => {
  if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
    return res.status(404).send("Mape nav iestatīta vai neeksistē");
  }
  express.static(currentProjectPath)(req, res, next);
});

// --- API MARŠRUTI ---

// 1. Atgriež pieejamo mediju failu sarakstu
app.get('/api/media-list', (req, res) => {
  try {
    if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
      return res.json([]);
    }
    const files = fs.readdirSync(currentProjectPath).filter(f => 
      /\.(jpg|jpeg|png|gif|mp4|mov|mp3|wav|ogg)$/i.test(f)
    );
    res.json(files);
  } catch (err) {
    console.error("Kļūda ielādējot mediju sarakstu:", err);
    res.status(500).json({ error: "Neizdevās nolasīt mediju mapi" });
  }
});

// 2. Iestatīt darba mapi un nolasīt pieejamos .json projektus
app.post('/api/set-path', (req, res) => {
  try {
    if (req.body.path) {
      currentProjectPath = req.body.path;
    }
    if (!fs.existsSync(currentProjectPath)) {
      fs.mkdirSync(currentProjectPath, { recursive: true });
    }
    console.log("📂 Darba mape iestatīta uz:", currentProjectPath);
    const files = fs.readdirSync(currentProjectPath).filter(f => f.endsWith('.json'));
    res.json({ success: true, projects: files });
  } catch (err) {
    console.error("Kļūda iestatot mapi:", err);
    res.status(500).json({ error: "Neizdevās piekļūt norādītajai mapei" });
  }
});

// 3. Ielādēt konkrēta projekta JSON failu
app.get('/api/projects/:name', (req, res) => {
  const rawName = req.params.name;
  const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
  const filePath = path.join(currentProjectPath, fileName);

  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: "Kļūda nolasot projekta JSON saturu" });
    }
  } else {
    res.status(404).json({ error: "Fails nav atrasts" });
  }
});

// 4. Saglabāt projektu JSON failā
app.post('/api/save-to-file', (req, res) => {
  try {
    const rawName = req.body.fileName || 'project';
    const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = path.join(currentProjectPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(req.body.data, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("Kļūda saglabājot failu:", err);
    res.status(500).json({ error: "Neizdevās saglabāt projektu" });
  }
});

// 5. Ielādēt šovus no Prisma datubāzes (Savietojamībai)
app.get('/api/shows', async (req, res) => {
  try {
    const data = await prisma.show.findMany({ include: { versions: true } });
    res.json(data);
  } catch (err) {
    console.error("Datubāzes kļūda:", err);
    res.status(500).json({ error: "Kļūda iegūstot šovus no datubāzes" });
  }
});

// --- SOCKET.IO DZINĒJS UN STATE MANAGEMENT ---

const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, any>>();

io.on('connection', (socket) => {

  // Jaunas sesijas izveide (Host)
  socket.on('host:create-session', (data: { projectData: any }) => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    sessions.set(pin, { 
      currentSceneIdx: -1, 
      scenes: data.projectData?.scenes || [], 
      subState: 'IDLE', 
      votes: [],
      currentScene: null
    });
    sessionScores.set(pin, new Map());
    socket.join(pin);
    socket.emit('session-info', { pin, state: sessions.get(pin) });
  });

  // Virzīšanai pa slaidu fāzēm uz priekšu (Space vai Host poga)
  socket.on('host:advance', (pin: string) => {
    const s = sessions.get(pin);
    if (!s) return;

    if (s.subState === 'IDLE' || s.subState === 'REVEAL') {
      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) {
        return io.to(pin).emit('game-over');
      }
      s.subState = 'READY';
      s.votes = [];
      s.currentScene = { ...s.scenes[s.currentSceneIdx], subState: 'READY' };
      io.to(pin).emit('state-update', s.currentScene);

    } else if (s.subState === 'READY') {
      s.subState = 'ACTIVE';
      const dur = s.currentScene?.config?.duration || 30;
      s.currentScene.endTime = Date.now() + (dur * 1000);
      s.currentScene.subState = 'ACTIVE';
      io.to(pin).emit('state-update', s.currentScene);

    } else if (s.subState === 'ACTIVE') {
      s.subState = 'STATS';
      io.to(pin).emit('stats-revealed');

    } else { // Fāze STATS -> Pāreja uz REVEAL un punktu aprēķins
      s.subState = 'REVEAL';
      const correct = s.currentScene?.config?.correctAnswers || [];
      const players = sessionScores.get(pin);

      s.votes.forEach((v: any) => {
        const hits = v.optionIds.filter((id: string) => correct.includes(id)).length;
        if (hits > 0 && players) {
          const p = players.get(v.playerId);
          if (p) {
            const pts = Math.round((hits / Math.max(1, correct.length)) * 10);
            p.score += pts;
          }
        }
      });

      io.to(pin).emit('results-revealed', { correctAnswers: correct });
      io.to(pin).emit('leaderboard-update', Array.from(players?.values() || []).sort((a, b) => b.score - a.score));
    }
  });

  // Tieša pārslēgšanās uz konkrētu ainu no Host paneļa
  socket.on('host:next-scene', (data: any) => {
    const s = sessions.get(data.pin);
    if (s) {
      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      io.to(data.pin).emit('state-update', s.currentScene);
    }
  });

  // Pievienošanās sesijai (Spēlētājs vai Ekrāns)
  socket.on('join-session', (data: any) => {
    const s = sessions.get(data.pin);
    if (s) {
      socket.join(data.pin);
      const players = sessionScores.get(data.pin)!;

      if (data.name !== 'EKRĀNS' && !players.has(data.playerId)) {
        players.set(data.playerId, { name: data.name, score: 0 });
      }

      io.to(data.pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      socket.emit('join-success', { 
        pin: data.pin, 
        currentScene: s.currentScene, 
        subState: s.subState 
      });
    }
  });

  // Atbilžu iesniegšana no spēlētāja
  socket.on('participant:submit-answer', (data: any) => {
    const s = sessions.get(data.pin);
    if (s?.subState === 'ACTIVE') {
      s.votes = s.votes.filter((v: any) => v.playerId !== data.playerId);
      
      const answerList = Array.isArray(data.answers) 
        ? data.answers 
        : (data.answer ? [data.answer] : []);

      s.votes.push({ optionIds: answerList, playerId: data.playerId });

      const summary: Record<string, number> = {};
      s.votes.forEach((v: any) => {
        v.optionIds.forEach((o: string) => {
          summary[o] = (summary[o] || 0) + 1;
        });
      });

      io.to(data.pin).emit('votes-updated', summary);
    }
  });
});

// Servera palaišana
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DZINĒJS GATAVS UN STRĀDĀ UZ PORTA: ${PORT}`);
});