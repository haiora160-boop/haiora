import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('joinBranch', ({ tenantId, branchId }) => {
      if (tenantId) socket.join(`tenant:${tenantId}`);
      if (branchId) socket.join(`branch:${branchId}`);
      if (branchId) socket.join(`kitchen:${branchId}`);
    });

    socket.on('joinUser', ({ userId }) => {
      if (userId) socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => undefined);
  });

  return io;
}

export function emitToBranch(branchId: string, event: string, payload: unknown) {
  io?.to(`branch:${branchId}`).emit(event, payload);
}

export function emitToKitchen(branchId: string, event: string, payload: unknown) {
  io?.to(`kitchen:${branchId}`).emit(event, payload);
}


export function emitToTenant(tenantId: string, event: string, payload: unknown) {
  io?.to(`tenant:${tenantId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
