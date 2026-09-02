import { Server, Socket } from 'socket.io';
import { GameEngine } from '../../../api/src/engine/GameEngine';

export const registerPlayerHandlers = (io: Server, socket: Socket, sessions: Map<string, any>, scores: Map<string, any>) => {
  
  socket.on('join-session', (data: { pin: string, name: string, playerId: string }) => {
    const { pin, name, playerId } = data;
    const state = sessions.get(pin);

    if (state) {
      socket.join(pin);
      if (!scores.has(pin)) scores.set(pin, new Map());
      const players = scores.get(pin)!;

      if (name !== 'EKRĀNS') {
        if (!players.has(playerId)) {
          players.set(playerId, { name, score: 0 });
        }
      }

      io.to(pin).emit('presence-update', { 
        count: players.size, 
        players: Array.from(players.values()) 
      });

      socket.emit('join-success', { pin, currentScene: state.currentScene });
    } else {
      socket.emit('error', 'Sesija nav aktīva!');
    }
  });

  socket.on('participant:submit-answer', (data: { pin: string, answers: string[], playerId: string }) => {
    const state = sessions.get(data.pin);
    if (state?.currentScene?.endTime && Date.now() < state.currentScene.endTime) {
      // Reģistrējam izvēli (punktus vēl neskaitām, to darīs Host:Reveal fāze)
      state.votes = state.votes.filter((v: any) => v.playerId !== data.playerId);
      state.votes.push({ optionIds: data.answers, playerId: data.playerId, timestamp: Date.now() });

      const summary: any = {};
      state.votes.forEach((v: any) => {
        v.optionIds.forEach((opt: string) => { summary[opt] = (summary[opt] || 0) + 1; });
      });

      io.to(data.pin).emit('votes-updated', summary);
      socket.emit('answer-received');
    }
  });
};