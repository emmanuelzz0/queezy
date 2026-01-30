// ============================================
// Jingle Event Broadcaster
// ============================================

import { Server } from 'socket.io';
import { logger } from './logger.js';

let io: Server | null = null;

/**
 * Set the Socket.io server instance for broadcasting
 */
export function setSocketServer(server: Server): void {
    io = server;
}

/**
 * Broadcast jingle update event to all subscribed clients
 * Called after create, update, delete, or toggle operations
 */
export function broadcastJingleUpdate(): void {
    if (!io) {
        logger.warn('Cannot broadcast jingle update: Socket.io server not set');
        return;
    }

    io.to('jingles-subscribers').emit('jingles:updated');
    logger.info('📢 Broadcasted jingles:updated event');
}
