// ============================================
// Game Handler - Socket Events for Game Flow
// ============================================

import { TypedSocket, TypedServer } from '../types/socket.js';
import { RoomService } from '../services/roomService.js';
import { GameService } from '../services/gameService.js';
import { logger } from '../utils/logger.js';

export function registerGameHandlers(
    socket: TypedSocket,
    io: TypedServer,
    roomService: RoomService,
    gameService: GameService
): void {
    // ============================================
    // game:start - Start the game (host only)
    // ============================================

    socket.on('game:start', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if requester is TV/host
            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can start game' });
            }

            // Check minimum players
            if (room.players.length < room.settings.minPlayers) {
                return callback({
                    success: false,
                    error: `Need at least ${room.settings.minPlayers} players to start`,
                });
            }

            // Check if questions are ready
            if (!room.questions || room.questions.length === 0) {
                return callback({ success: false, error: 'No questions loaded' });
            }

            // Start the game
            await gameService.startGame(roomCode);

            // Notify all clients
            io.to(roomCode).emit('game:started', {
                phase: 'question',
                questionCount: room.questions.length,
                currentQuestion: 0,
            });

            callback({ success: true });

            logger.info({ roomCode, playerCount: room.players.length }, 'Game started');

            // Start first question after short delay
            setTimeout(() => {
                gameService.showQuestion(roomCode, io);
            }, 2000);
        } catch (error) {
            logger.error({ error }, 'Failed to start game');
            callback({ success: false, error: 'Failed to start game' });
        }
    });

    // ============================================
    // game:next-question - Move to next question
    // ============================================

    socket.on('game:next-question', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if requester is TV/host
            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can control game' });
            }

            // Show next question
            await gameService.showQuestion(roomCode, io);

            callback({ success: true });
        } catch (error) {
            logger.error({ error }, 'Failed to show next question');
            callback({ success: false, error: 'Failed to show next question' });
        }
    });

    // ============================================
    // game:pause - Pause the game
    // ============================================

    socket.on('game:pause', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can pause' });
            }

            await gameService.pauseGame(roomCode);
            io.to(roomCode).emit('game:paused', {});

            callback({ success: true });
            logger.info({ roomCode }, 'Game paused');
        } catch (error) {
            logger.error({ error }, 'Failed to pause game');
            callback({ success: false, error: 'Failed to pause game' });
        }
    });

    // ============================================
    // game:resume - Resume the game
    // ============================================

    socket.on('game:resume', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can resume' });
            }

            await gameService.resumeGame(roomCode);
            io.to(roomCode).emit('game:resumed', {});

            callback({ success: true });
            logger.info({ roomCode }, 'Game resumed');
        } catch (error) {
            logger.error({ error }, 'Failed to resume game');
            callback({ success: false, error: 'Failed to resume game' });
        }
    });

    // ============================================
    // game:end - End the game early
    // ============================================

    socket.on('game:end', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can end game' });
            }

            // End game and show final results
            await gameService.endGame(roomCode, io);

            callback({ success: true });
            logger.info({ roomCode }, 'Game ended early');
        } catch (error) {
            logger.error({ error }, 'Failed to end game');
            callback({ success: false, error: 'Failed to end game' });
        }
    });

    // ============================================
    // game:restart - Restart with same players
    // ============================================

    socket.on('game:restart', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can restart' });
            }

            // Reset game state but keep players
            await gameService.restartGame(roomCode);

            io.to(roomCode).emit('game:restarted', {
                phase: 'lobby',
            });

            callback({ success: true });
            logger.info({ roomCode }, 'Game restarted');
        } catch (error) {
            logger.error({ error }, 'Failed to restart game');
            callback({ success: false, error: 'Failed to restart game' });
        }
    });
}
