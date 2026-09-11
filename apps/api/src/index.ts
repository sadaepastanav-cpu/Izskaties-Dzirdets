import * as dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import * as path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

let currentProjectPath = path.resolve(process.cwd(), '../../public/uploads');
if (!fs.existsSync(currentProjectPath)) {
  fs.mkdirSync(currentProjectPath, { recursive: true });
}

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
const upload = multer({ storage });

app.use('/project-media', (req, res, next) => {
  if (!currentProjectPath || !fs.existsSync(currentProjectPath)) {
    return res.status(404).send('Mape nav iestatīta vai neeksistē');
  }
  express.static(currentProjectPath)(req, res, next);
});

const sessions = new Map<string, any>();
const sessionScores = new Map<string, Map<string, any>>();
const participants = new Map<string, Set<string>>();

const saveSnapshot = (pin: string) => {
  try {
    const state = sessions.get(pin);
    const scores = sessionScores.get(pin);
    if (!state) return;

    const payload = {
      timestamp: new Date().toISOString(),
      pin,
      state,
      scores: Array.from(scores?.entries() || [])
    };

    fs.writeFileSync(path.join(currentProjectPath, 'active_session.json'), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(currentProjectPath, 'last_session_snapshot.json'), JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error(`Kļūda saglabājot snapshot:`, err);
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
  } catch (err) {
    console.error(`Kļūda dzēšot snapshot:`, err);
  }
};

const handleVote = (pin: string, answers: string[], playerId: string) => {
  const s = sessions.get(pin);
  const activeParticipantsCount = participants.get(pin)?.size || 0;

  if (s?.subState === 'ACTIVE') {
    const now = Date.now();
    const timeSpentMs = Math.max(0, now - (s.questionStartTime || now));

    s.votes = s.votes.filter((v: any) => v.playerId !== playerId);
    s.votes.push({
      optionIds: answers,
      playerId,
      timeReceived: now,
      timeSpentMs
    });

    const summary: Record<string, number> = {};
    s.votes.forEach((v: any) => {
      if (Array.isArray(v.optionIds)) {
        v.optionIds.forEach((o: string) => (summary[o] = (summary[o] || 0) + 1));
      }
    });

    io.to(pin).emit('votes-updated', { summary, votedCount: s.votes.length });

    if (activeParticipantsCount > 0 && s.votes.length >= activeParticipantsCount) {
      s.subState = 'STATS';
      if (s.currentScene) s.currentScene.endTime = Date.now();
      io.to(pin).emit('stats-revealed', { summary, votedCount: s.votes.length });
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin);
    }
  }
};

// REST API
app.get('/api/current-path', (_req, res) => res.json({ currentPath: currentProjectPath }));

app.post('/api/set-path', (req, res) => {
  try {
    if (req.body.path?.trim()) currentProjectPath = path.resolve(req.body.path.trim());
    if (!fs.existsSync(currentProjectPath)) fs.mkdirSync(currentProjectPath, { recursive: true });
    const projects = fs.readdirSync(currentProjectPath).filter((f) => f.endsWith('.json') && !f.includes('snapshot'));
    const media = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    res.json({ success: true, currentPath: currentProjectPath, projects, media });
  } catch {
    res.status(500).json({ error: 'Kļūda piekļūstot mapei' });
  }
});

app.get('/api/media-list', (_req, res) => {
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

app.post('/api/upload-media', upload.single('mediaFile'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nav faila' });
    const files = fs.readdirSync(currentProjectPath).filter((f) =>
      /\.(jpg|jpeg|png|gif|webp|svg|mp4|mov|webm|mp3|wav|ogg)$/i.test(f)
    );
    io.emit('media-list', files);
    res.json({ success: true, fileName: req.file.filename, files });
  } catch {
    res.status(500).json({ error: 'Kļūda saglabājot failu' });
  }
});

app.get('/api/list-projects', (_req, res) => {
  try {
    if (!currentProjectPath || !fs.existsSync(currentProjectPath)) return res.json([]);
    const files = fs.readdirSync(currentProjectPath).filter((f) => f.endsWith('.json') && !f.includes('snapshot'));
    res.json(files);
  } catch {
    res.status(500).json({ error: 'Kļūda nolasot projektus' });
  }
});

app.get('/api/load-project/:name', (req, res) => {
  try {
    const rawName = path.basename(req.params.name);
    const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = path.join(currentProjectPath, fileName);
    if (fs.existsSync(filePath)) res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    else res.status(404).json({ error: 'Fails nav atrasts' });
  } catch {
    res.status(500).json({ error: 'Kļūda nolasot failu' });
  }
});

app.post('/api/save-to-file', (req, res) => {
  try {
    const rawName = path.basename(req.body.fileName || 'project');
    const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;
    const filePath = path.join(currentProjectPath, fileName);
    fs.writeFileSync(filePath, JSON.stringify(req.body.data, null, 2));
    res.json({ success: true, fileName, fullPath: filePath });
  } catch {
    res.status(500).json({ error: 'Neizdevās saglabāt' });
  }
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
  } catch {
    res.json({ canRecover: false });
  }
});

app.post('/api/recover-session', (_req, res) => {
  try {
    const p1 = path.join(currentProjectPath, 'active_session.json');
    if (fs.existsSync(p1)) {
      const data = JSON.parse(fs.readFileSync(p1, 'utf-8'));
      sessions.set(data.pin, data.state);
      sessionScores.set(data.pin, new Map(data.scores));
      if (!participants.has(data.pin)) participants.set(data.pin, new Set());
      res.json({ success: true, pin: data.pin, state: data.state });
    } else res.status(404).json({ error: 'Nav faila' });
  } catch {
    res.status(500).json({ error: 'Kļūda atjaunojot' });
  }
});

// SOCKET.IO
io.on('connection', (socket) => {
  socket.on('host:create-session', (data: any) => {
    const pin = data.existingPin || Math.floor(1000 + Math.random() * 9000).toString();
    const sessionData = {
      currentSceneIdx: -1,
      scenes: data.projectData?.scenes || [],
      branding: data.projectData?.branding || {},
      subState: 'IDLE',
      votes: [],
      currentScene: null,
      isRevealed: false,
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

  // 1. PUNKTS: IESPĒJA NOLASĪT ŠOVA DIZAINU VĒL PIRMS IELOGOŠANĀS
  socket.on('get-branding', (data: { pin: string }) => {
    const cleanPin = String(data?.pin || '').trim();
    const s = sessions.get(cleanPin);
    if (s && s.branding) {
      socket.emit('session-branding', s.branding);
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
    return Array.from(playersMap.values()).sort((a, b) => {
      const scoreA = isRound ? (a.roundScore || 0) : (a.score || 0);
      const scoreB = isRound ? (b.roundScore || 0) : (b.score || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      const timeA = isRound ? (a.roundTimeMs || 0) : (a.totalTimeMs || 0);
      const timeB = isRound ? (b.roundTimeMs || 0) : (b.totalTimeMs || 0);
      return timeA - timeB;
    });
  };

  socket.on('host:advance', (pin: string) => {
    const s = sessions.get(pin);
    const playersMap = sessionScores.get(pin);
    if (!s) return;

    // FINĀLA APBALVOŠANA
    if (s.currentScene?.type === 'LEADERBOARD' && s.currentScene?.config?.lbType === 'FINAL') {
      const totalPlayers = playersMap?.size || 0;
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

    // LEADERBOARD LAPOŠANA
    if (s.currentScene && s.currentScene.type === 'LEADERBOARD') {
      const totalPlayers = playersMap?.size || 0;
      const maxPages = Math.ceil(totalPlayers / 10);
      if (s.currentPaging < maxPages - 1) {
        s.currentPaging++;
        io.to(pin).emit('leaderboard-page-change', s.currentPaging);
        return;
      }
      if (s.currentScene.config?.lbType === 'ROUND') {
        playersMap?.forEach((p) => {
          p.roundScore = 0;
          p.roundTimeMs = 0;
        });
      }
    }

    // PĀREJA AR SPACE
    if (s.subState === 'REVEAL') {
      const shouldShowStats = s.currentScene?.config?.showStatsAfterReveal;
      if (shouldShowStats && !s.statsShownAfterReveal) {
        s.statsShownAfterReveal = true;
        io.to(pin).emit('toggle-audience-chart', true);
        saveSnapshot(pin);
        return;
      }
    }

    if (
      s.subState === 'IDLE' ||
      s.subState === 'REVEAL' ||
      (s.currentScene && (s.currentScene.type === 'BILLBOARD' || s.currentScene.type === 'LEADERBOARD'))
    ) {
      s.currentSceneIdx++;
      if (s.currentSceneIdx >= s.scenes.length) {
        clearSnapshot(pin);
        return io.to(pin).emit('game-over');
      }

      s.currentScene = s.scenes[s.currentSceneIdx];
      s.votes = [];
      s.isRevealed = false;
      s.statsShownAfterReveal = false;
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

      const options = s.currentScene?.config?.options || [];
      playersMap?.forEach((p, id) => {
        if (p.isBot) {
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
      io.to(pin).emit('stats-revealed');
      io.to(pin).emit('video-command', 'pause');
      saveSnapshot(pin);
    } else if (s.subState === 'STATS') {
      s.subState = 'REVEAL';
      s.isRevealed = true;
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

      const sortedVotes = [...s.votes].sort((a, b) => a.timeReceived - b.timeReceived);
      let correctCounter = 0;

      sortedVotes.forEach((v: any) => {
        let earnedPercentage = 0;
        if (Array.isArray(v.optionIds)) {
          v.optionIds.forEach((opt: string) => {
            if (correct.includes(opt)) {
              const pct = correctnessMap[opt] !== undefined ? correctnessMap[opt] : Math.round(100 / Math.max(1, correct.length));
              earnedPercentage += pct;
            }
          });
        }

        earnedPercentage = Math.min(100, earnedPercentage);

        if (playersMap) {
          const p = playersMap.get(v.playerId);
          if (p) {
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
      s.currentScene = { ...data.scene, endTime: null };
      s.subState = 'IDLE';
      s.votes = [];
      s.isRevealed = false;
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
            isBot: false
          };
          players.set(data.playerId, playerObj);
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
  console.log(`🚀 EVENT STUDIO SERVERIS PALASTS UZ PORTA: ${PORT}`);
});