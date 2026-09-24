/**
 * EVENT STUDIO - 500 VIRTUAL PLAYERS LOAD TEST
 * Šis skripts pieslēdz 500 reālus WebSocket klientus, 
 * izveido komandas un vienlaicīgi nobalso.
 */
const { io } = require('socket.io-client');

const SERVER_URL = process.env.TARGET_URL || 'http://localhost:3000';
const PIN = process.argv[2] || '1234'; // Norādi savu aktīvo PIN kā argumentu: node simulate_500.js 4821
const TOTAL_PLAYERS = 500;

console.log(`\n======================================================`);
console.log(`🚀 SĀKAM 500 SPĒLĒTĀJU SLODZES TESTU SESIJAI: PIN ${PIN}`);
console.log(`🌐 Mērķa serveris: ${SERVER_URL}`);
console.log(`======================================================\n`);

const sockets = [];
const teams = ['1. Galdiņš', '2. Galdiņš', '3. Galdiņš', '4. Galdiņš', 'VIP Galdiņš', 'Čempioni', 'Ātrie Prāti'];
let connectedCount = 0;
let votedCount = 0;

for (let i = 0; i < TOTAL_PLAYERS; i++) {
  const playerId = `sim_p_${i}_${Date.now()}`;
  const teamName = teams[i % teams.length];
  const isCaptain = i < teams.length;

  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: false
  });

  socket.on('connect', () => {
    connectedCount++;
    socket.emit('join-session', {
      pin: PIN,
      name: `Spēlētājs #${i + 1}`,
      playerId,
      teamName,
      isCaptain
    });

    if (connectedCount % 50 === 0 || connectedCount === TOTAL_PLAYERS) {
      console.log(`👥 Pieslēgti un reģistrēti: ${connectedCount} / ${TOTAL_PLAYERS} spēlētāji`);
    }
  });

  socket.on('state-update', (scene) => {
    if (scene && scene.subState === 'ACTIVE') {
      const options = ['A', 'B', 'C', 'D'];
      const chosenOption = options[Math.floor(Math.random() * options.length)];
      
      // Nejauša aizture 0.1s - 3.5s robežās, imitējot reālu cilvēku reakciju
      const delayMs = Math.random() * 3400 + 100;
      
      setTimeout(() => {
        socket.emit('participant:submit-answer', {
          pin: PIN,
          playerId,
          answer: chosenOption,
          answers: [chosenOption]
        });
        votedCount++;
        if (votedCount % 100 === 0 || votedCount === TOTAL_PLAYERS) {
          console.log(`⚡ Saņemtas balsis no slodzes testa: ${votedCount} / ${TOTAL_PLAYERS}`);
        }
      }, delayMs);
    }
  });

  socket.on('error-message', (err) => {
    console.error(`❌ Kļūda spēlētājam #${i + 1}:`, err);
  });

  sockets.push(socket);
}

process.on('SIGINT', () => {
  console.log('\n🛑 Izslēdzam virtuālos spēlētājus...');
  sockets.forEach((s) => s.disconnect());
  process.exit();
});