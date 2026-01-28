// ============================================
// Room Service - Redis-backed Room Management
// ============================================

import { redis, keys } from '../config/redis.js';
import { Room, RoomSettings, Player, GamePhase, Answer, Question } from '../types/game.js';
import { generateRoomCode } from '../utils/roomCode.js';
import { logger } from '../utils/logger.js';

const ROOM_TTL = 60 * 60 * 4; // 4 hours

export class RoomService {
    // ============================================
    // Create a new room
    // ============================================

    async createRoom(tvSocketId: string): Promise<Room> {
        let roomCode: string;
        let attempts = 0;

        // Generate unique room code
        do {
            roomCode = generateRoomCode();
            const exists = await redis.exists(keys.room(roomCode));
            if (!exists) break;
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            throw new Error('Failed to generate unique room code');
        }

        const room: Room = {
            code: roomCode,
            tvSocketId,
            phase: 'lobby',
            players: [],
            questions: [],
            currentQuestionIndex: 0,
            currentAnswers: [],
            settings: {
                questionCount: 10,
                timeLimit: 20,
                difficulty: 'mixed',
                category: '',
                categoryName: '',
                maxPlayers: 50,
                minPlayers: 2,
            },
            createdAt: new Date().toISOString(),
        };

        // Store room in Redis
        await redis.setex(keys.room(roomCode), ROOM_TTL, JSON.stringify(room));

        // Add to active rooms set
        await redis.sadd(keys.activeRooms, roomCode);

        logger.info({ roomCode }, 'Room created');

        return room;
    }

    // ============================================
    // Get room by code
    // ============================================

    async getRoom(roomCode: string): Promise<Room | null> {
        const data = await redis.get(keys.room(roomCode));
        if (!data) return null;
        return JSON.parse(data) as Room;
    }

    // ============================================
    // Update room
    // ============================================

    async updateRoom(roomCode: string, room: Room): Promise<void> {
        await redis.setex(keys.room(roomCode), ROOM_TTL, JSON.stringify(room));
    }

    // ============================================
    // Delete room
    // ============================================

    async deleteRoom(roomCode: string): Promise<void> {
        await redis.del(keys.room(roomCode));
        await redis.srem(keys.activeRooms, roomCode);
        logger.info({ roomCode }, 'Room deleted');
    }

    // ============================================
    // Add player to room
    // ============================================

    async addPlayer(roomCode: string, player: Player): Promise<Player> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        // Check for duplicate name
        const existingName = room.players.find(
            p => p.name.toLowerCase() === player.name.toLowerCase()
        );
        if (existingName) {
            throw new Error('Name already taken');
        }

        room.players.push(player);
        await this.updateRoom(roomCode, room);

        return player;
    }

    // ============================================
    // Remove player from room
    // ============================================

    async removePlayer(roomCode: string, playerId: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) return;

        room.players = room.players.filter(p => p.id !== playerId);
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Set player connection status
    // ============================================

    async setPlayerConnected(roomCode: string, playerId: string, isConnected: boolean): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.isConnected = isConnected;
            await this.updateRoom(roomCode, room);
        }
    }

    // ============================================
    // Update player socket ID (for reconnection)
    // ============================================

    async updatePlayerSocketId(roomCode: string, oldPlayerId: string, newPlayerId: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) return;

        const player = room.players.find(p => p.id === oldPlayerId);
        if (player) {
            player.id = newPlayerId;
            player.isConnected = true;
            await this.updateRoom(roomCode, room);
        }
    }

    // ============================================
    // Update player info (jingle, ready status, etc.)
    // ============================================

    async updatePlayer(roomCode: string, playerId: string, updates: Partial<Pick<Player, 'jingleId' | 'isReady'>>): Promise<Player | null> {
        const room = await this.getRoom(roomCode);
        if (!room) return null;

        const player = room.players.find(p => p.id === playerId);
        if (!player) return null;

        // Apply updates
        if (updates.jingleId !== undefined) {
            player.jingleId = updates.jingleId;
        }
        if (updates.isReady !== undefined) {
            player.isReady = updates.isReady;
        }

        await this.updateRoom(roomCode, room);
        return player;
    }

    // ============================================
    // Update room settings
    // ============================================

    async updateSettings(roomCode: string, settings: Partial<RoomSettings>): Promise<Room> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.settings = { ...room.settings, ...settings };
        await this.updateRoom(roomCode, room);

        return room;
    }

    // ============================================
    // Update category
    // ============================================

    async updateCategory(roomCode: string, categoryId: string, categoryName: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.settings.category = categoryId;
        room.settings.categoryName = categoryName;
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Set questions for the room
    // ============================================

    async setQuestions(roomCode: string, questions: Question[], category: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.questions = questions;
        room.settings.category = category;
        room.currentQuestionIndex = 0;
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Update game phase
    // ============================================

    async updatePhase(roomCode: string, phase: GamePhase): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.phase = phase;
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Record answer
    // ============================================

    async recordAnswer(roomCode: string, answer: Answer): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        if (!room.currentAnswers) {
            room.currentAnswers = [];
        }

        room.currentAnswers.push(answer);
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Update player score
    // ============================================

    async updatePlayerScore(
        roomCode: string,
        playerId: string,
        points: number,
        isCorrect: boolean
    ): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.score += points;
            if (isCorrect) {
                player.streak += 1;
            } else {
                player.streak = 0;
            }
            await this.updateRoom(roomCode, room);
        }
    }

    // ============================================
    // Get leaderboard
    // ============================================

    async getLeaderboard(roomCode: string): Promise<Array<{ playerId: string; name: string; avatar: string; score: number; rank: number }>> {
        const room = await this.getRoom(roomCode);
        if (!room) return [];

        return room.players
            .sort((a, b) => b.score - a.score)
            .map((p, index) => ({
                playerId: p.id,
                name: p.name,
                avatar: p.avatar,
                score: p.score,
                rank: index + 1,
            }));
    }

    // ============================================
    // Clear current answers (for new question)
    // ============================================

    async clearCurrentAnswers(roomCode: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.currentAnswers = [];
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Move to next question
    // ============================================

    async nextQuestion(roomCode: string): Promise<{ hasMore: boolean; index: number }> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.currentQuestionIndex += 1;
        room.currentAnswers = [];

        const hasMore = room.currentQuestionIndex < room.questions.length;

        await this.updateRoom(roomCode, room);

        return { hasMore, index: room.currentQuestionIndex };
    }

    // ============================================
    // Set question start time
    // ============================================

    async setQuestionStartTime(roomCode: string, startTime: number): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.questionStartTime = startTime;
        await this.updateRoom(roomCode, room);
    }

    // ============================================
    // Reset room for new game
    // ============================================

    async resetRoom(roomCode: string): Promise<void> {
        const room = await this.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        room.phase = 'lobby';
        room.questions = [];
        room.currentQuestionIndex = 0;
        room.currentAnswers = [];
        room.questionStartTime = undefined;

        // Reset player scores but keep players
        for (const player of room.players) {
            player.score = 0;
            player.streak = 0;
        }

        await this.updateRoom(roomCode, room);
    }
}

export const roomService = new RoomService();
