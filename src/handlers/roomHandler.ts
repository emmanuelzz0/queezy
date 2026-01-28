// ============================================
// Room Handler - Socket Events for Room Management
// ============================================

import { TypedSocket, TypedServer } from '../types/socket.js';
import { RoomService } from '../services/roomService.js';
import { logger } from '../utils/logger.js';
import { playerNameSchema, avatarSchema } from '../utils/validation.js';

export function registerRoomHandlers(
    socket: TypedSocket,
    io: TypedServer,
    roomService: RoomService
): void {
    // ============================================
    // room:create - Create a new room (TV client)
    // ============================================

    socket.on('room:create', async (data, callback) => {
        try {
            logger.info({ socketId: socket.id }, 'Creating room');

            const room = await roomService.createRoom(socket.id);

            // Join the socket to the room channel
            socket.join(room.code);
            socket.data.roomCode = room.code;
            socket.data.role = 'tv';

            callback({
                success: true,
                roomCode: room.code,
                room,
            });

            logger.info({ roomCode: room.code, socketId: socket.id }, 'Room created');
        } catch (error) {
            logger.error({ error }, 'Failed to create room');
            callback({ success: false, error: 'Failed to create room' });
        }
    });

    // ============================================
    // room:join - Join an existing room (Player)
    // ============================================

    socket.on('room:join', async (data, callback) => {
        // Handle case where callback is not provided (e.g., from TV joining for topics)
        const safeCallback = typeof callback === 'function'
            ? callback
            : (response: { success: boolean; error?: string }) => {
                if (!response.success) {
                    logger.warn({ error: response.error }, 'room:join failed (no callback)');
                }
            };

        try {
            const { roomCode, player, type } = data;

            // If this is a TV joining just to subscribe to topics, just join the socket room
            if (type === 'tv' && !player) {
                if (roomCode) {
                    socket.join(roomCode);
                    socket.data.roomCode = roomCode;
                    logger.info({ roomCode, socketId: socket.id }, 'TV subscribed to room');
                }
                return safeCallback({ success: true });
            }

            // Validate input for player join
            if (!roomCode || !player) {
                return safeCallback({ success: false, error: 'Room code and player info required' });
            }

            const nameResult = playerNameSchema.safeParse(player.name);
            if (!nameResult.success) {
                return safeCallback({ success: false, error: 'Invalid player name' });
            }

            const avatarResult = avatarSchema.safeParse(player.avatar);
            if (!avatarResult.success) {
                return safeCallback({ success: false, error: 'Invalid avatar' });
            }

            // Check if room exists
            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return safeCallback({ success: false, error: 'Room not found' });
            }

            // Check if game already started
            if (room.phase !== 'lobby') {
                return safeCallback({ success: false, error: 'Game already in progress' });
            }

            // Check if room is full
            if (room.players.length >= room.settings.maxPlayers) {
                return safeCallback({ success: false, error: 'Room is full' });
            }

            // Add player to room
            const newPlayer = await roomService.addPlayer(roomCode, {
                id: socket.id,
                name: player.name,
                avatar: player.avatar,
                jingleId: player.jingleId,
                score: 0,
                streak: 0,
                isHost: false,
                isConnected: true,
            });

            // Join socket to room
            socket.join(roomCode);
            socket.data.roomCode = roomCode;
            socket.data.playerId = socket.id;
            socket.data.role = 'player';

            // Notify TV and other players
            io.to(roomCode).emit('room:player-joined', {
                player: newPlayer,
                playerCount: room.players.length + 1,
            });

            safeCallback({
                success: true,
                player: newPlayer,
                room: (await roomService.getRoom(roomCode)) ?? undefined,
            });

            logger.info(
                { roomCode, playerId: socket.id, playerName: player.name },
                'Player joined room'
            );
        } catch (error) {
            logger.error({ error }, 'Failed to join room');
            safeCallback({ success: false, error: 'Failed to join room' });
        }
    });

    // ============================================
    // room:rejoin - Rejoin a room after disconnect/refresh
    // ============================================

    socket.on('room:rejoin', async (data, callback) => {
        const safeCallback = typeof callback === 'function'
            ? callback
            : (response: { success: boolean; error?: string }) => {
                if (!response.success) {
                    logger.warn({ error: response.error }, 'room:rejoin failed (no callback)');
                }
            };

        try {
            const { roomCode, playerName, playerAvatar, playerJingleId } = data;

            if (!roomCode || !playerName) {
                return safeCallback({ success: false, error: 'Room code and player name required' });
            }

            // Check if room exists
            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return safeCallback({ success: false, error: 'Room not found' });
            }

            // Find player by name (they might have a different socket id now)
            const existingPlayer = room.players.find(
                p => p.name.toLowerCase() === playerName.toLowerCase()
            );

            if (existingPlayer) {
                const oldPlayerId = existingPlayer.id;

                // Update the existing player's socket id and connection status
                await roomService.updatePlayerSocketId(roomCode, existingPlayer.id, socket.id);
                await roomService.setPlayerConnected(roomCode, socket.id, true);

                // Join socket to room
                socket.join(roomCode);
                socket.data.roomCode = roomCode;
                socket.data.playerId = socket.id;
                socket.data.role = 'player';

                const updatedRoom = await roomService.getRoom(roomCode);
                const updatedPlayer = updatedRoom?.players.find(p => p.id === socket.id);

                // Notify room that player rejoined (and their ID changed)
                io.to(roomCode).emit('room:player-rejoined', {
                    oldPlayerId,
                    player: updatedPlayer
                });

                safeCallback({
                    success: true,
                    player: updatedPlayer,
                    room: updatedRoom ?? undefined,
                });

                logger.info(
                    { roomCode, oldPlayerId, newPlayerId: socket.id, playerName },
                    'Player rejoined room'
                );
            } else {
                // Player doesn't exist, try to join as new player if in lobby
                if (room.phase !== 'lobby') {
                    return safeCallback({ success: false, error: 'Game already in progress' });
                }

                if (room.players.length >= room.settings.maxPlayers) {
                    return safeCallback({ success: false, error: 'Room is full' });
                }

                // Add as new player
                const newPlayer = await roomService.addPlayer(roomCode, {
                    id: socket.id,
                    name: playerName,
                    avatar: playerAvatar || '🦊',
                    jingleId: playerJingleId,
                    score: 0,
                    streak: 0,
                    isHost: false,
                    isConnected: true,
                });

                socket.join(roomCode);
                socket.data.roomCode = roomCode;
                socket.data.playerId = socket.id;
                socket.data.role = 'player';

                io.to(roomCode).emit('room:player-joined', {
                    player: newPlayer,
                    playerCount: room.players.length + 1,
                });

                safeCallback({
                    success: true,
                    player: newPlayer,
                    room: (await roomService.getRoom(roomCode)) ?? undefined,
                });

                logger.info(
                    { roomCode, playerId: socket.id, playerName },
                    'Player joined room via rejoin'
                );
            }
        } catch (error) {
            logger.error({ error }, 'Failed to rejoin room');
            safeCallback({ success: false, error: 'Failed to rejoin room' });
        }
    });

    // ============================================
    // room:leave - Leave the room
    // ============================================

    socket.on('room:leave', async (data, callback) => {
        const safeCallback = typeof callback === 'function'
            ? callback
            : () => { };

        try {
            const roomCode = data?.roomCode || socket.data.roomCode;

            if (!roomCode) {
                return safeCallback({ success: false, error: 'Not in a room' });
            }

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return safeCallback({ success: false, error: 'Room not found' });
            }

            // Remove player from room
            await roomService.removePlayer(roomCode, socket.id);

            // Leave socket room
            socket.leave(roomCode);
            socket.data.roomCode = undefined;
            socket.data.playerId = undefined;

            // Notify others
            io.to(roomCode).emit('room:player-left', {
                playerId: socket.id,
                playerCount: room.players.length - 1,
            });

            safeCallback({ success: true });

            logger.info({ roomCode, playerId: socket.id }, 'Player left room');
        } catch (error) {
            logger.error({ error }, 'Failed to leave room');
            safeCallback({ success: false, error: 'Failed to leave room' });
        }
    });

    // ============================================
    // room:kick - Kick a player (host only)
    // ============================================

    socket.on('room:kick', async (data, callback) => {
        try {
            const { roomCode, playerId } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if requester is TV/host
            if (socket.data.role !== 'tv' && room.tvSocketId !== socket.id) {
                return callback({ success: false, error: 'Only host can kick players' });
            }

            // Remove the player
            await roomService.removePlayer(roomCode, playerId);

            // Notify kicked player
            io.to(playerId).emit('room:kicked', { reason: 'Kicked by host' });

            // Notify room
            io.to(roomCode).emit('room:player-left', {
                playerId,
                playerCount: room.players.length - 1,
            });

            callback({ success: true });

            logger.info({ roomCode, kickedPlayerId: playerId }, 'Player kicked');
        } catch (error) {
            logger.error({ error }, 'Failed to kick player');
            callback({ success: false, error: 'Failed to kick player' });
        }
    });

    // ============================================
    // room:update-settings - Update room settings
    // ============================================

    socket.on('room:update-settings', async (data, callback) => {
        try {
            const { roomCode, settings } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if requester is TV/host
            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can update settings' });
            }

            // Update settings
            const updatedRoom = await roomService.updateSettings(roomCode, settings);

            // Notify room
            io.to(roomCode).emit('room:settings-updated', { settings: updatedRoom.settings });

            callback({ success: true, settings: updatedRoom.settings });

            logger.info({ roomCode, settings }, 'Room settings updated');
        } catch (error) {
            logger.error({ error }, 'Failed to update settings');
            callback({ success: false, error: 'Failed to update settings' });
        }
    });

    // ============================================
    // player:update - Update player info (jingle, ready status)
    // ============================================

    socket.on('player:update', async (data, callback) => {
        const safeCallback = typeof callback === 'function'
            ? callback
            : () => { };

        try {
            const roomCode = data?.roomCode || socket.data.roomCode;
            const { jingleId, isReady } = data;

            if (!roomCode) {
                return safeCallback({ success: false, error: 'Not in a room' });
            }

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return safeCallback({ success: false, error: 'Room not found' });
            }

            // Update player
            const updatedPlayer = await roomService.updatePlayer(roomCode, socket.id, {
                jingleId,
                isReady,
            });

            if (!updatedPlayer) {
                return safeCallback({ success: false, error: 'Player not found' });
            }

            // Notify room about player update
            io.to(roomCode).emit('room:player-updated', {
                playerId: socket.id,
                jingleId: updatedPlayer.jingleId,
                isReady: updatedPlayer.isReady,
            });

            // Check if all connected players are ready
            if (isReady) {
                const updatedRoom = await roomService.getRoom(roomCode);
                if (updatedRoom && updatedRoom.phase === 'lobby') {
                    const connectedPlayers = updatedRoom.players.filter(p => p.isConnected !== false);
                    const allReady = connectedPlayers.length >= updatedRoom.settings.minPlayers &&
                        connectedPlayers.every(p => p.isReady === true);
                    
                    if (allReady) {
                        logger.info({ roomCode, playerCount: connectedPlayers.length }, 'All players ready');
                        io.to(roomCode).emit('room:all-players-ready', {
                            playerCount: connectedPlayers.length,
                        });
                    }
                }
            }

            safeCallback({ success: true, player: updatedPlayer });

            logger.info({ roomCode, playerId: socket.id, jingleId, isReady }, 'Player updated');
        } catch (error) {
            logger.error({ error }, 'Failed to update player');
            safeCallback({ success: false, error: 'Failed to update player' });
        }
    });

    // ============================================
    // Handle disconnect
    // ============================================

    socket.on('disconnect', async () => {
        try {
            const roomCode = socket.data.roomCode;
            if (!roomCode) return;

            const room = await roomService.getRoom(roomCode);
            if (!room) return;

            if (socket.data.role === 'tv') {
                // TV disconnected - pause game or notify players
                io.to(roomCode).emit('room:tv-disconnected', {});
                logger.info({ roomCode }, 'TV disconnected');
            } else if (socket.data.playerId) {
                // Player disconnected
                await roomService.setPlayerConnected(roomCode, socket.data.playerId, false);

                io.to(roomCode).emit('room:player-disconnected', {
                    playerId: socket.data.playerId,
                });

                logger.info({ roomCode, playerId: socket.data.playerId }, 'Player disconnected');
            }
        } catch (error) {
            logger.error({ error }, 'Error handling disconnect');
        }
    });
}
