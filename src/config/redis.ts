// ============================================
// Redis Configuration
// ============================================

import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

// ============================================
// Redis Client
// ============================================

export const redis = new Redis.default(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    lazyConnect: true,
});

// ============================================
// Connection Events
// ============================================

redis.on('connect', () => {
    logger.info('📦 Redis connecting...');
});

redis.on('ready', () => {
    logger.info('✅ Redis connected and ready');
});

redis.on('error', (err: Error) => {
    logger.error({ err }, '❌ Redis error');
});

redis.on('close', () => {
    logger.warn('⚠️ Redis connection closed');
});

redis.on('reconnecting', () => {
    logger.info('🔄 Redis reconnecting...');
});

// ============================================
// Redis Key Helpers
// ============================================

export const keys = {
    // Room keys
    room: (code: string) => `room:${code}`,
    roomPlayers: (code: string) => `room:${code}:players`,
    roomGame: (code: string) => `room:${code}:game`,
    roomQuestions: (code: string) => `room:${code}:questions`,
    roomAnswers: (code: string) => `room:${code}:answers`,
    roomTopics: (code: string) => `room:${code}:topics`,

    // Session keys
    session: (deviceId: string) => `session:${deviceId}`,
    socketSession: (socketId: string) => `socket:${socketId}`,

    // Auth keys
    tvLogin: (token: string) => `auth:tv-login:${token}`,

    // Active games tracking
    activeRooms: 'active:rooms',
} as const;

// ============================================
// TTL Constants (in seconds)
// ============================================

export const ttl = {
    room: config.ROOM_EXPIRY_HOURS * 60 * 60,
    tvLogin: config.QR_TOKEN_EXPIRY_MINUTES * 60,
    session: 24 * 60 * 60, // 24 hours
} as const;

// ============================================
// Connect to Redis
// ============================================

export async function connectRedis(): Promise<void> {
    try {
        await redis.connect();
    } catch (err) {
        // Already connected (ioredis auto-connects)
        if ((err as Error).message?.includes('already connecting')) {
            return;
        }
        throw err;
    }
}

// ============================================
// Disconnect from Redis
// ============================================

export async function disconnectRedis(): Promise<void> {
    await redis.quit();
}
