// ============================================
// Admin Users Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export const usersRouter = Router();

// ============================================
// GET /api/admin/users - List users with pagination
// ============================================

usersRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = req.query.search as string;

        const where: Record<string, unknown> = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    authProvider: true,
                    gamesPlayed: true,
                    totalScore: true,
                    wins: true,
                    createdAt: true,
                    _count: {
                        select: { topics: true },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            users: users.map(u => ({
                ...u,
                topicCount: u._count.topics,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch users');
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// ============================================
// GET /api/admin/users/:id - Get single user
// ============================================

usersRouter.get('/:id', async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                topics: {
                    include: {
                        _count: {
                            select: { questions: true },
                        },
                    },
                },
                gameHistories: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        session: {
                            select: { category: true, roomCode: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, user });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch user');
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
});

// ============================================
// PUT /api/admin/users/:id - Update user
// ============================================

usersRouter.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const updateData: Record<string, unknown> = {};

        if (req.body.name) updateData.name = req.body.name;
        if (req.body.avatar) updateData.avatar = req.body.avatar;

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        logger.info({ userId: id }, 'User updated');

        res.json({ success: true, user });
    } catch (error) {
        logger.error({ error }, 'Failed to update user');
        res.status(500).json({ success: false, error: 'Failed to update user' });
    }
});

// ============================================
// DELETE /api/admin/users/:id - Delete user
// ============================================

usersRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        await prisma.user.delete({ where: { id } });

        logger.info({ userId: id }, 'User deleted');

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to delete user');
        res.status(500).json({ success: false, error: 'Failed to delete user' });
    }
});

// ============================================
// GET /api/admin/users/:id/topics - Get user's topics
// ============================================

usersRouter.get('/:id/topics', async (req, res) => {
    try {
        const topics = await prisma.userTopic.findMany({
            where: { userId: req.params.id },
            include: {
                questions: true,
            },
        });

        res.json({ success: true, topics });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch user topics');
        res.status(500).json({ success: false, error: 'Failed to fetch user topics' });
    }
});
