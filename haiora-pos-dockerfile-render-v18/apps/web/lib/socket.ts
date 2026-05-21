import { io, Socket } from 'socket.io-client';

function getSocketUrl() {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configured && configured !== 'auto') return configured;

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return 'http://localhost:4000';
}

let socketInstance: Socket | null = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), { autoConnect: true });
  }

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}

export const socket = getSocket;
