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
const uploadsPath = path.resolve(process.cwd(), '../../public/uploads');
app.use('/uploads', express.static(uploadsPath));

// Datu struktūras
const sessionsState = new Map<string, any>();
const sessionScores = new Map<string, Map<string, any>>();
const participants = new Map<string, Set<string>>();

// Funkcija Līderu saraksta nosūtīšanai
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

  // 1. SESIJAS IZVEIDE (Host)
  socket.on('host:create-session', async (data: { showId: string, existingPin?: string }) => {
    let pin = data.existingPin || Math.floor(1000 + Math.random() * 9000).toString();
    
    if (!sessionsState.has(pin)) {
      const v = await prisma.showVersion.findFirst({ where: { showId: data.showId } });
      const scenes = v?.scenes || [];

      sessionsState.set(pin, {
        showId: data.showId,
        scenes: scenes,
        currentSceneIndex: 0,
        currentScene: scenes.length > 0 ? scenes[0] : null,
        subState: 'IDLE', // Sākotnējais stāvoklis: IDLE | ACTIVE | STATS | REVEAL
        votes: []
      });
      
      sessionScores.set(pin, new Map());
    }
    
    socket.join(pin);
    socket.emit('session-info', { pin, state: sessionsState.get(pin) });
  });

  // 2. DALĪBNIEKU PIEVIENOŠANĀS
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
      
      const state = sessionsState.get(pin);
      io.to(pin).emit('presence-update', { count: players.size, players: Array.from(players.values()) });
      socket.emit('join-success', { pin, currentScene: state.currentScene, subState: state.subState });
      emitLeaderboard(pin);
    }
  });

  // 3. VIENOTĀ SKATU PĀRVALDĪBAS POGA (Space/Advance loģika)
  socket.on('host:advance', (pin: string) => {
    const state = sessionsState.get(pin);
    if (!state || !state.currentScene) return;

    switch (state.subState) {
      
      // STEP 1: No IDLE uz ACTIVE (Taimera un spēles sākums)
      case 'IDLE': {
        state.subState = 'ACTIVE';
        const duration = state.currentScene.config?.duration || 30;
        state.currentScene.endTime = Date.now() + (duration * 1000);
        
        io.to(pin).emit('state-update', { 
          ...state.currentScene, 
          subState: 'ACTIVE',
          endTime: state.currentScene.endTime 
        });
        break;
      }

      // STEP 2: No ACTIVE uz STATS (Statistikas un stabiņu atvēršana)
      case 'ACTIVE': {
        state.subState = 'STATS';
        io.to(pin).emit('stats-revealed', { subState: 'STATS' });
        break;
      }

      // STEP 3: No STATS uz REVEAL (Pareizo atbilžu un punktu parādīšana)
      case 'STATS': {
        state.subState = 'REVEAL';
        const players = sessionScores.get(pin);
        const correctAnswers = state.currentScene.config?.correctAnswers || [];
        const maxPoints = state.currentScene.config?.points || 10;

        if (players && state.type === 'QUIZ') {
          // Aprēķinām punktus visiem, kas nobalsoja
          state.votes.forEach((v: any) => {
            const userAnswers = Array.isArray(v.optionIds) ? v.optionIds : [v.optionIds];
            
            // Pārbaudām cik pareizas atbildes iesniegtas
            const correctCount = userAnswers.filter((a: string) => correctAnswers.includes(a)).length;
            const isFullyCorrect = correctCount === correctAnswers.length && userAnswers.length === correctAnswers.length;

            if (isFullyCorrect) {
              const p = players.get(v.playerId);
              if (p) p.score += maxPoints;
            }
          });
        }

        io.to(pin).emit('results-revealed', { 
          correctAnswers, 
          subState: 'REVEAL' 
        });
        emitLeaderboard(pin);
        break;
      }

      // STEP 4: Pāreja uz nākošo slaidu
      case 'REVEAL': {
        if (state.currentSceneIndex < state.scenes.length - 1) {
          state.currentSceneIndex += 1;
          state.currentScene = state.scenes[state.currentSceneIndex];
          state.subState = 'IDLE';
          state.votes = [];

          io.to(pin).emit('state-update', { 
            ...state.currentScene, 
            subState: 'IDLE',
            currentSceneIndex: state.currentSceneIndex
          });
        } else {
          // Ja šis bija pēdējais slaids
          io.to(pin).emit('show-ended');
        }
        break;
      }
    }
  });

  // 4. DALĪBNIEKU ATBILŽU IESNIEGŠANA
  socket.on('participant:submit-answer', (data: { pin: string, answers: string[], playerId: string }) => {
    const state = sessionsState.get(data.pin);

    // Pieņem atbildes tikai tad, ja slaids ir aktīvs un taimeris vēl nav beidzies
    if (state?.subState === 'ACTIVE' && state?.currentScene?.endTime && Date.now() < state.currentScene.endTime) {
      
      // Dzēšam iepriekšējo atbildi, ja spēlētājs to maina
      state.votes = state.votes.filter((v: any) => v.playerId !== data.playerId);
      state.votes.push({ optionIds: data.answers, playerId: data.playerId });

      // Saskaitām balsošanas rezultātus
      const summary: Record<string, number> = {};
      state.votes.forEach((v: any) => { 
        v.optionIds.forEach((opt: string) => { 
          summary[opt] = (summary[opt] || 0) + 1; 
        }); 
      });

      io.to(data.pin).emit('votes-updated', summary);
      socket.emit('answer-received');
    }
  });

  // Manuālas papildiespējas vadītāja pultij
  socket.on('host:trigger-video', (pin: string) => {
    io.to(pin).emit('video-command', 'play');
  });

});

httpServer.listen(PORT, () => console.log(`🚀 Serveris strādā uz portu ${PORT}!`));