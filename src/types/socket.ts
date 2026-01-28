// ============================================
// Socket Event Types
// ============================================

import type { Server, Socket } from 'socket.io';
import type { GameState, Player, Question, LeaderboardEntry, AnswerOption } from './game.js';
import type { Room, RoomSettings } from './room.js';
import type { CustomTopic, UserTopic, AuthUser } from './auth.js';

// ============================================
// Callback Types
// ============================================

export interface SocketCallback<T = object> {
    (response: { success: boolean; error?: string } & T): void;
}

// ============================================
// Client -> Server Events (with callbacks)
// ============================================

export interface ClientToServerEvents {
    // Room events
    'room:create': (
        data: { hostName?: string; deviceId?: string },
        callback: SocketCallback<{ roomCode?: string; room?: Room }>
    ) => void;

    'room:join': (
        data: {
            roomCode: string;
            type?: 'tv' | 'player';
            player?: { name: string; avatar: string; jingleId?: string };
        },
        callback: SocketCallback<{ player?: Player; room?: Room }>
    ) => void;

    'room:leave': (
        data: { roomCode?: string },
        callback: SocketCallback
    ) => void;

    'room:kick': (
        data: { roomCode: string; playerId: string },
        callback: SocketCallback
    ) => void;

    'room:rejoin': (
        data: { roomCode: string; playerName: string; playerAvatar?: string; playerJingleId?: string },
        callback: SocketCallback<{ player?: Player; room?: Room }>
    ) => void;

    'room:update-settings': (
        data: { roomCode: string; settings: Partial<RoomSettings> },
        callback: SocketCallback<{ settings?: RoomSettings }>
    ) => void;

    // Player events
    'player:update': (
        data: { roomCode?: string; jingleId?: string; isReady?: boolean },
        callback: SocketCallback<{ player?: Player }>
    ) => void;

    // Game events
    'game:start': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    'game:next-question': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    'game:pause': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    'game:resume': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    'game:end': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    'game:restart': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    // Answer events
    'answer:submit': (
        data: { roomCode: string; answer: AnswerOption; timestamp: number },
        callback: SocketCallback<{ accepted?: boolean }>
    ) => void;

    'answer:timeout': (
        data: { roomCode: string },
        callback: SocketCallback
    ) => void;

    // Quiz events
    'quiz:generate': (
        data: {
            roomCode: string;
            category: string;
            questionCount: number;
            difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
            isCustomTopic?: boolean;
            topicId?: string;
        },
        callback: SocketCallback<{ questions?: number }>
    ) => void;

    'quiz:select-category': (
        data: { roomCode: string; categoryId: string; categoryName: string },
        callback: SocketCallback
    ) => void;

    'quiz:set-options': (
        data: { roomCode: string; questionCount?: number; difficulty?: string; timeLimit?: number },
        callback: SocketCallback<{ settings?: RoomSettings }>
    ) => void;

    // Topic events
    'topic:subscribe': (data: { roomCode: string }) => void;
    'topic:unsubscribe': (data: { roomCode: string }) => void;
    'topic:create': (data: {
        roomCode: string;
        name: string;
        description: string;
        icon: string;
        questions: Question[];
    }) => void;
    'topic:delete': (data: { roomCode: string; topicId: string }) => void;

    // Auth events
    'auth:register-tv': (data: { loginToken: string; deviceId: string }) => void;
    'auth:unregister-tv': (data: { loginToken: string }) => void;
    'user:subscribe-topics': (data: { userId: string }) => void;
    'user:unsubscribe-topics': (data: { userId: string }) => void;
}

// ============================================
// Server -> Client Events
// ============================================

export interface ServerToClientEvents {
    // Room events
    'room:created': (data: { roomCode: string; room: Room }) => void;
    'room:joined': (data: { room: Room; players: Player[]; gameState?: GameState }) => void;
    'room:player-joined': (data: { player: Player; playerCount: number }) => void;
    'room:player-rejoined': (data: { oldPlayerId: string; player: Player | undefined }) => void;
    'room:player-left': (data: { playerId: string; playerCount: number }) => void;
    'room:player-disconnected': (data: { playerId: string }) => void;
    'room:tv-disconnected': (data: Record<string, never>) => void;
    'room:kicked': (data: { reason: string }) => void;
    'room:settings-updated': (data: { settings: RoomSettings }) => void;
    'room:player-updated': (data: { playerId: string; jingleId?: string; isReady?: boolean }) => void;
    'player:joined': (data: { player: Player; playerCount: number }) => void;
    'player:left': (data: { playerId: string; playerCount: number }) => void;

    // Game events
    'game:starting': (data: { countdown: number }) => void;
    'game:countdown': (data: { count: number }) => void;
    'game:started': (data: { phase: string; questionCount: number; currentQuestion: number }) => void;
    'game:state': (data: { gameState: GameState }) => void;
    'game:phase': (data: {
        phase: string;
        data?: {
            question?: Question;
            correctAnswer?: AnswerOption;
            distribution?: Record<AnswerOption, number>;
            winner?: Player;
            leaderboard?: LeaderboardEntry[];
            finalResults?: LeaderboardEntry[];
        };
    }) => void;
    'game:question': (data: {
        questionIndex: number;
        totalQuestions: number;
        question: {
            text: string;
            options: { A: string; B: string; C: string; D: string };
            timeLimit: number;
            imageUrl?: string;
        };
        timeLimit: number;
    }) => void;
    'game:reveal': (data: {
        correctAnswer: AnswerOption;
        results: Array<{
            playerId: string;
            answer: AnswerOption | null;
            isCorrect: boolean;
            pointsEarned: number;
            newScore: number;
            streak: number;
        }>;
        standings: LeaderboardEntry[];
    }) => void;
    'game:leaderboard': (data: {
        standings: LeaderboardEntry[];
        questionIndex: number;
        totalQuestions: number;
    }) => void;
    'game:finished': (data: {
        standings: LeaderboardEntry[];
        winner?: {
            playerId: string;
            name: string;
            avatar: string;
            score: number;
            jingleId?: string;
        };
    }) => void;
    'game:paused': (data: Record<string, never>) => void;
    'game:resumed': (data: Record<string, never>) => void;
    'game:restarted': (data: { phase: string }) => void;
    'game:ended': (data: { results: LeaderboardEntry[] }) => void;

    // Question events
    'question:show': (data: {
        question: Question;
        questionIndex: number;
        totalQuestions: number;
        timeLimit: number;
    }) => void;

    // Timer events
    'timer:tick': (data: { timeRemaining: number }) => void;
    'timer:end': () => void;

    // Answer events
    'answer:received': (data: { playerId: string; answerCount: number; totalPlayers: number }) => void;
    'answer:all-received': (data: Record<string, never>) => void;
    'player:answered': (data: {
        playerId: string;
        answeredCount: number;
        totalPlayers: number;
    }) => void;
    'answers:reveal': (data: {
        correctAnswer: AnswerOption;
        distribution: Record<AnswerOption, number>;
        players: Player[];
        winner: Player | null;
    }) => void;

    // Quiz events
    'quiz:generating': (data: { category: string; questionCount: number }) => void;
    'quiz:generated': (data: { category: string; questionCount: number }) => void;
    'quiz:ready': (data: { questionCount: number; category: string }) => void;
    'quiz:category-selected': (data: { categoryId: string; categoryName: string }) => void;
    'quiz:error': (data: { error: string }) => void;

    // Topic events
    'topic:created': (data: { topic: CustomTopic }) => void;
    'topic:deleted': (data: { topicId: string }) => void;
    'topic:list': (data: { topics: CustomTopic[] }) => void;

    // Auth events
    'auth:logged-in': (data: { user: AuthUser; topics: UserTopic[] }) => void;
    'auth:error': (data: { message: string; code: string }) => void;
    'user:topic:created': (data: { topic: UserTopic }) => void;
    'user:topic:deleted': (data: { topicId: string }) => void;
    'user:topics': (data: { topics: UserTopic[] }) => void;

    // Error events
    'error': (data: { message: string; code: string }) => void;
}

// ============================================
// Inter-Server Events (for scaling)
// ============================================

export interface InterServerEvents {
    ping: () => void;
}

// ============================================
// Socket Data (attached to socket)
// ============================================

export interface SocketData {
    deviceId?: string;
    userId?: string;
    type?: 'tv' | 'player' | 'tv-auth';
    role?: 'tv' | 'player';
    roomCode?: string;
    playerId?: string;
}

// ============================================
// Typed Socket.io Server & Socket
// ============================================

export type TypedServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export type TypedSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;
