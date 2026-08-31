import { io } from 'socket.io-client';

// Šī rinda savieno lapu ar Tavu serveri, kas darbojas uz 3000 porta
export const socket = io('http://localhost:3000');