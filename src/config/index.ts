// ============================================
// Configuration
// ============================================

import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// ============================================
// Environment Schema
// ============================================

const envSchema = z.object({
    // Server
    PORT: z.string().default('3001').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    DATABASE_URL: z.string(),

    // Redis
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Auth
    JWT_SECRET: z.string().min(32),
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),

    // Claude AI (Anthropic)
    ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),

    // CORS
    CORS_ORIGINS: z.string().default('http://localhost:3000'),

    // Game Settings
    MAX_PLAYERS: z.string().default('50').transform(Number),
    ROOM_EXPIRY_HOURS: z.string().default('2').transform(Number),
    QR_TOKEN_EXPIRY_MINUTES: z.string().default('5').transform(Number),
    DEFAULT_TIME_LIMIT: z.string().default('20').transform(Number),
    DEFAULT_QUESTION_COUNT: z.string().default('10').transform(Number),

    // Admin Dashboard
    UPLOAD_DIR: z.string().default('./uploads'),
    MAX_FILE_SIZE_MB: z.string().default('10').transform(Number),
});

// ============================================
// Parse and Export Config
// ============================================

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid environment variables:', parseResult.error.format());
    process.exit(1);
}

export const config = {
    ...parseResult.data,

    // Derived values
    isDev: parseResult.data.NODE_ENV === 'development',
    isProd: parseResult.data.NODE_ENV === 'production',
    corsOrigins: parseResult.data.CORS_ORIGINS.split(',').map(s => s.trim()),
    maxFileSizeBytes: parseResult.data.MAX_FILE_SIZE_MB * 1024 * 1024,

    // Game constants (from TV app)
    game: {
        basePoints: 1000,
        streakBonus: 100,
        maxStreakBonus: 500,
        timeBonusMultiplier: 0.5,
        countdownDuration: 3,
        revealDuration: 5000,
        leaderboardDuration: 8000,
        winnerJingleDuration: 3000,
        minPlayers: 2,
    },

    // Claude AI settings
    claude: {
        model: 'claude-sonnet-4-20250514',
        maxTokens: 4096,
    },

    // JWT settings
    jwt: {
        secret: parseResult.data.JWT_SECRET,
        expiresIn: '24h',
    },
} as const;

export type Config = typeof config;
