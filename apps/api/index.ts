import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mediju failu statiskā mape
const uploadsPath = path.resolve(process.cwd(), '../../public/uploads');
app.use('/uploads', express.static(uploadsPath));

console.log("📂 Mediju mape tiek meklēta šeit:", uploadsPath);

// --- REST API MARŠRUTI ---

// Iegūt visas spēles ar to versijām
app.get('/api/shows', async (req, res) => {
  try {
    const shows = await prisma.show.findMany({ 
      include: { versions: true } 
    });
    res.json(shows);
  } catch (err) {
    console.error("DB Kļūda:", err);
    res.status(500).json({ error: 'Kļūda datubāzē' });
  }
});

// Iegūt konkrētu spēli pēc ID
app.get('/api/shows/:id', async (req, res) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: { versions: true }
    });
    if (!show) {
      return res.status(404).json({ error: 'Spēle nav atrasta' });
    }
    res.json(show);
  } catch (err) {
    console.error("DB Kļūda:", err);
    res.status(500).json({ error: 'Kļūda datubāzē' });
  }
});

// --- SOCKET.IO REALTIME LOĢIKA ---

const sessionsState = new Map<string, { currentScene: any, votes: any[], showId: string, scenes: any[], isResultsVisible: boolean }>();
const sessionScores = new Map<string, Map<string, { name: string, score: number }>>();
const participants = new Map<string, Set<string>>();

// Palīgfunkcija līderu saraksta ieguvei un nosūtīšanai
const emitLeaderboard = (pin: string) => {
  const players = sessionScores.get(pin);
  if (players) {
    const leaderboard = Array.from(players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    io.to(pin).emit('leaderboard-update', leaderboard);
  }
};

io.on('connection', (socket) => {
  // 1. Sesijas izveide/atjaunošana
  socket.on('host:create-session', async (data: { showId: string, existingPin?: string }) => {
    let pin = data.existingPin || Math.floor(1000 + Math.random() * 9000).toString();
    if (!sessionsState.has(pin)) {
      const v = await prisma.showVersion.findFirst({ where: { showId: data.showId } });
      sessionsState.set(pin, { currentScene: null, votes: [], showId: data.showId, scenes: v?.scenes as any[] || [], isResultsVisible: false });
    }
    socket.join(pin);
    socket.emit('session-info', { pin, state: sessionsState.get(pin) });
  });

  // 2. Pievienošanās spēlei
  socket.on('join-session', (data: { pin: string, name: string, playerId: string }) => {
    const { pin, name, playerId } = data;
    if (sessionsState.has(pin)) {
      socket.join(pin);
      if (!sessionScores.has(pin)) sessionScores.set(pin, new Map());
      if (!participants.has(pin)) participants.set(pin, new Set());
      
      const players = sessionScores.get(pin)!;
      if (name !== 'EKRĀNS') {
        if (!players.has(playerId)) players.set(playerId, { name, score: 0 });
        participants.get(pin)!.add(socket.id);
      }
      io.to(pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      socket.emit('join-success', { pin, currentScene: sessionsState.get(pin)!.currentScene });

      // Pieslēdzoties nosūtām arī aktuālo līderu sarakstu
      emitLeaderboard(pin);
    }
  });

  // 3. Pārslēgt ainu (Sagatavošana)
  socket.on('host:next-scene', (data: { pin: string, scene: any }) => {
    const state = sessionsState.get(data.pin);
    if (state) {
      state.currentScene = { ...data.scene, endTime: null }; // Taimeris vēl nesākas
      state.votes = [];
      state.isResultsVisible = false;
      io.to(data.pin).emit('state-update', state.currentScene);
      
      // Ja jaunā aina ir LEADERBOARD, uzreiz nosūtām visjaunākos datus
      if (data.scene.type === 'LEADERBOARD') {
        emitLeaderboard(data.pin);
      }
    }
  });

  // 4. Palaist taimeri (Darbība)
  socket.on('host:start-timer', (pin: string) => {
    const state = sessionsState.get(pin);
    if (state && state.currentScene) {
      const duration = state.currentScene.config?.duration || 15;
      state.currentScene.endTime = Date.now() + (duration * 1000);
      io.to(pin).emit('state-update', state.currentScene);
    }
  });

  // 5. Vadītājs nospiež "Palaist Video"
  socket.on('host:trigger-video', (pin: string) => {
    console.log(`🎬 Saņemta komanda spēlēt video telpā: ${pin}`);
    io.to(pin).emit('video-command', 'play');
  });

  // 6. Atklāt rezultātus
  socket.on('host:reveal-results', (pin: string) => {
    const state = sessionsState.get(pin);
    if (state) {
      state.isResultsVisible = true;
      io.to(pin).emit('results-revealed');
      emitLeaderboard(pin);
    }
  });

  // 7. Atbilde no dalībnieka (atbalsts gan vienai, gan vairākām atbildēm)
  socket.on('participant:submit-answer', (data: { pin: string, answer?: string, answers?: string[], playerId: string }) => {
    const state = sessionsState.get(data.pin);
    const players = sessionScores.get(data.pin);

    if (state && state.currentScene?.endTime && Date.now() < state.currentScene.endTime) {
      // Pārbaudām, vai šis spēlētājs jau nav iesniedzis atbildi šajā ainā
      const alreadyVoted = state.votes.some((v: any) => v.playerId === data.playerId);

      if (!alreadyVoted) {
        // Normalizējam atbildes uz masīvu
        const userAnswers: string[] = data.answers || (data.answer ? [data.answer] : []);

        if (state.currentScene.type === 'QUIZ') {
          const config = state.currentScene.config || {};
          const correctOnes: string[] = config.correctAnswers || (config.correctAnswer ? [config.correctAnswer] : []);
          const totalPossible = correctOnes.length;

          if (totalPossible > 0) {
            // Saskaitām, cik spēlētājs atminēja pareizi
            const userCorrectCount = userAnswers.filter(a => correctOnes.includes(a)).length;

            // Aprēķinām punktus (daļēji vai pilni)
            const maxPoints = config.points || 100;
            const pointsToAward = Math.round((userCorrectCount / totalPossible) * maxPoints);

            const playerData = players?.get(data.playerId);
            if (playerData && pointsToAward > 0) {
              playerData.score += pointsToAward;
            }
          }
        }

        // Pievienojam katru izvēlēto opciju balsojumu masīvam
        userAnswers.forEach(ans => {
          state.votes.push({ optionId: ans, playerId: data.playerId });
        });

        socket.emit('answer-received');

        // Pārrēķinām un izsūtām kopējo balsu kopsavilkumu
        const summary = state.votes.reduce((acc: Record<string, number>, curr: any) => { 
          acc[curr.optionId] = (acc[curr.optionId] || 0) + 1; 
          return acc; 
        }, {});

        io.to(data.pin).emit('votes-updated', summary);

        // Atjaunojam kopējos punktus reāllaikā un nosūtām uz ekrānu
        emitLeaderboard(data.pin);
      }
    }
  });

  // 8. Atvienošanās
  socket.on('disconnect', () => {
    participants.forEach((socketsSet, pin) => {
      if (socketsSet.has(socket.id)) {
        socketsSet.delete(socket.id);
        const players = sessionScores.get(pin);
        if (players) {
          io.to(pin).emit('presence-update', { 
            count: players.size, 
            players: Array.from(players.values()) 
          });
        }
      }
    });
  });
});

httpServer.listen(PORT, () => console.log(`🚀 API un Socket serveris darbojas: http://localhost:${PORT}`));