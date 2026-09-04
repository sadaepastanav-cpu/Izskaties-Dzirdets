import { io } from 'socket.io-client';
// Automātiski pielāgojas IP adresei
const SERVER_URL = `http://${window.location.hostname}:3000`;
export const socket = io(SERVER_URL);