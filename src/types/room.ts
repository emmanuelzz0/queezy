// ============================================
// Room Types
// ============================================

// Re-export from game.ts for convenience
export { Room, RoomSettings, GamePhase, Player, Question, Answer } from './game.js';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export interface RoomCreateInput {
    hostName?: string;
    deviceId?: string;
}

export interface RoomJoinInput {
    roomCode: string;
    type?: 'tv' | 'player';
    player?: {
        name: string;
        avatar: string;
        jingleId?: string;
    };
}
