// ============================================
// Input Validation Schemas (Zod)
// ============================================

import { z } from 'zod';
import { AVATAR_EMOJIS } from './avatars.js';
import { DEFAULT_JINGLES, DEFAULT_CATEGORIES } from './constants.js';

// ============================================
// Common Validators
// ============================================

export const roomCodeSchema = z.string()
    .length(6)
    .regex(/^[A-Z0-9]+$/, 'Invalid room code format');

export const playerNameSchema = z.string()
    .min(1, 'Name is required')
    .max(20, 'Name too long')
    .regex(/^[a-zA-Z0-9\s]+$/, 'Name contains invalid characters');

export const avatarSchema = z.string()
    .refine((val) => AVATAR_EMOJIS.includes(val as typeof AVATAR_EMOJIS[number]), {
        message: 'Invalid avatar',
    });

export const jingleIdSchema = z.string()
    .refine((val) => DEFAULT_JINGLES.some(j => j.id === val), {
        message: 'Invalid jingle',
    });

export const categoryIdSchema = z.string()
    .refine((val) => DEFAULT_CATEGORIES.some(c => c.id === val), {
        message: 'Invalid category',
    });

export const answerSchema = z.enum(['A', 'B', 'C', 'D']);

export const difficultySchema = z.enum(['easy', 'medium', 'hard', 'mixed']);

// ============================================
// Room Schemas
// ============================================

export const roomCreateSchema = z.object({
    hostName: playerNameSchema,
    deviceId: z.string().min(1),
});

export const roomJoinSchema = z.object({
    roomCode: roomCodeSchema,
    type: z.enum(['tv', 'player']),
    player: z.object({
        name: playerNameSchema,
        avatar: avatarSchema,
        jingleId: jingleIdSchema.optional(),
    }).optional(),
});

// ============================================
// Game Schemas
// ============================================

export const gameStartSchema = z.object({
    roomCode: roomCodeSchema,
});

export const answerSubmitSchema = z.object({
    roomCode: roomCodeSchema,
    answer: answerSchema,
    timestamp: z.number(),
});

// ============================================
// Quiz Schemas
// ============================================

export const quizGenerateSchema = z.object({
    roomCode: roomCodeSchema,
    category: z.string().min(1),
    questionCount: z.number().min(5).max(30),
    difficulty: difficultySchema.optional().default('mixed'),
    isCustomTopic: z.boolean().optional().default(false),
    topicId: z.string().optional(),
});

// ============================================
// Topic Schemas
// ============================================

export const topicCreateSchema = z.object({
    roomCode: roomCodeSchema,
    name: z.string().min(1).max(50),
    description: z.string().max(200),
    icon: z.string().emoji(),
    questions: z.array(z.object({
        text: z.string().min(1),
        options: z.object({
            A: z.string().min(1),
            B: z.string().min(1),
            C: z.string().min(1),
            D: z.string().min(1),
        }),
        correctAnswer: answerSchema,
        timeLimit: z.number().min(5).max(60).optional().default(20),
    })).min(5).max(30),
});

// ============================================
// Auth Schemas
// ============================================

export const tvLoginSchema = z.object({
    loginToken: z.string().min(1),
    deviceId: z.string().min(1),
});

export const mobileLoginSchema = z.object({
    token: z.string().min(1),
    user: z.object({
        id: z.string().min(1),
        name: playerNameSchema,
        avatar: avatarSchema,
        email: z.string().email().optional(),
    }),
});

// ============================================
// Admin Schemas
// ============================================

export const adminLoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

export const createJingleSchema = z.object({
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    thumbnail: z.string().emoji(),
    duration: z.coerce.number().min(1000).max(60000),
});

export const createCategorySchema = z.object({
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
    description: z.string().max(200),
    icon: z.string().emoji(),
    color: z.string(),
    bgGradient: z.string(),
});

export const createQuestionSchema = z.object({
    text: z.string().min(1),
    optionA: z.string().min(1),
    optionB: z.string().min(1),
    optionC: z.string().min(1),
    optionD: z.string().min(1),
    correctAnswer: answerSchema,
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    categoryId: z.string().min(1),
    imageUrl: z.string().url().optional(),
});

// ============================================
// Validation Helper
// ============================================

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessage = result.error.issues.map(i => i.message).join(', ');
    return { success: false, error: errorMessage };
}
