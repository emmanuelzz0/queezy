// ============================================
// Socket.io Server Setup
// ============================================

import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import type { TypedServer, TypedSocket } from './types/socket.js';

// Handlers
import { registerRoomHandlers } from './handlers/roomHandler.js';
import { registerGameHandlers } from './handlers/gameHandler.js';
import { registerQuizHandlers } from './handlers/quizHandler.js';
import { registerAnswerHandlers } from './handlers/answerHandler.js';

// Services
import { roomService } from './services/roomService.js';
import { gameService } from './services/gameService.js';
import { quizService } from './services/quizService.js';
import { scoreService } from './services/scoreService.js';

// ============================================
// Create Socket.io Server
// ============================================

export function createSocketServer(httpServer: HttpServer): TypedServer {
    const io: TypedServer = new Server(httpServer, {
        cors: {
            origin: config.corsOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // ============================================
    // Connection Handler
    // ============================================

    io.on('connection', (socket: TypedSocket) => {
        const { deviceId, type } = socket.handshake.query;

        logger.info({
            socketId: socket.id,
            deviceId,
            type,
        }, '🔌 Client connected');

        // Store connection data
        socket.data.deviceId = deviceId as string;
        socket.data.type = (type as 'tv' | 'player' | 'tv-auth') || 'player';

        // Register all handlers with dependencies
        registerRoomHandlers(socket, io, roomService);
        registerGameHandlers(socket, io, roomService, gameService);
        registerQuizHandlers(socket, io, roomService, quizService);
        registerAnswerHandlers(socket, io, roomService, scoreService);

        // Handle disconnection
        socket.on('disconnect', (reason) => {
            logger.info({
                socketId: socket.id,
                deviceId: socket.data.deviceId,
                reason,
            }, '🔌 Client disconnected');

            // TODO: Handle player disconnect (mark as disconnected, pause game if TV)
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error({
                socketId: socket.id,
                error,
            }, '❌ Socket error');
        });
    });

    return io;
}
