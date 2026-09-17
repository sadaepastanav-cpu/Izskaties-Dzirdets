import { io } from 'socket.io-client';
import { BACKEND_URL } from './config';

// Dinamiski nosakām pareizo backend adresi (lokālais LAN, localhost vai Cloudflare tunelis)
const getSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (origin.includes('trycloudflare.com') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return origin;
    }
  }
  return BACKEND_URL || 'http://localhost:3000';
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});