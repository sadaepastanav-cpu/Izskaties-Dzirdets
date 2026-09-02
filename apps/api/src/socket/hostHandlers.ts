import { Server, Socket } from 'socket.io';
import { GameEngine } from '../../../api/src/engine/GameEngine';

export const registerHostHandlers = (io: Server, socket: Socket, sessions: Map<string, any>, scores: Map<string, any>) => {
  
  // Kad vadītājs spiež "Nākamā fāze" (tā pati Atstarpe)
  socket.on('host:advance', (pin: string) => {
    const state = sessions.get(pin);
    if (!state || !state.currentScene) return;

    if (state.subState === 'IDLE') {
      // Sākam taimeri
      const duration = state.currentScene.config.duration || 30;
      state.currentScene.endTime = Date.now() + (duration * 1000);
      state.subState = 'ACTIVE';
    } 
    else if (state.subState === 'ACTIVE') {
      state.subState = 'STATS';
      io.to(pin).emit('stats-revealed');
    }
    else if (state.subState === 'STATS') {
      state.subState = 'REVEAL';
      // Šeit dzinējs aprēķina punktus visiem
      // ... punktu piešķiršanas loģika ...
      io.to(pin).emit('results-revealed');
    }

    io.to(pin).emit('state-update', state.currentScene);
  });
};