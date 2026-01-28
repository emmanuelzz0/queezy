// ============================================
// Admin Stats/Analytics Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { redis, keys } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

export const statsRouter = Router();

// ============================================
// GET /api/admin/stats/overview - Dashboard overview stats
// ============================================

statsRouter.get('/overview', async (req, res) => {
    try {
        const [
            totalUsers,
            totalQuestions,
            totalCategories,
            totalJingles,
            totalGames,
            activeRooms,
            recentUsers,
            recentGames,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.question.count(),
            prisma.category.count(),
            prisma.jingle.count(),
            prisma.gameSession.count(),
            redis.scard(keys.activeRooms),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
                    },
                },
            }),
            prisma.gameSession.count({
                where: {
                    startedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalQuestions,
                totalCategories,
                totalJingles,
                totalGames,
                activeRooms,
                recentUsers,
                recentGames,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch overview stats');
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ============================================
// GET /api/admin/stats/games - Game statistics
// ============================================

statsRouter.get('/games', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const games = await prisma.gameSession.findMany({
            where: {
                startedAt: { gte: startDate },
            },
            orderBy: { startedAt: 'desc' },
            take: 100,
            select: {
                id: true,
                roomCode: true,
                category: true,
                playerCount: true,
                questionCount: true,
                startedAt: true,
                endedAt: true,
            },
        });

        // Games per day
        const gamesPerDay: Record<string, number> = {};
        for (const game of games) {
            const day = game.startedAt.toISOString().split('T')[0];
            gamesPerDay[day] = (gamesPerDay[day] || 0) + 1;
        }

        // Category breakdown
        const categoryBreakdown = await prisma.gameSession.groupBy({
            by: ['category'],
            where: { startedAt: { gte: startDate } },
            _count: true,
        });

        // Average players per game
        const avgPlayers = games.length > 0
            ? games.reduce((sum, g) => sum + g.playerCount, 0) / games.length
            : 0;

        res.json({
            success: true,
            stats: {
                totalGames: games.length,
                gamesPerDay,
                categoryBreakdown: categoryBreakdown.map(c => ({
                    category: c.category,
                    count: c._count,
                })),
                avgPlayersPerGame: Math.round(avgPlayers * 10) / 10,
            },
            recentGames: games.slice(0, 20),
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch game stats');
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ============================================
// GET /api/admin/stats/questions - Question statistics
// ============================================

statsRouter.get('/questions', async (req, res) => {
    try {
        const [
            totalQuestions,
            aiGenerated,
            byDifficulty,
            byCategory,
            mostAsked,
            leastAccurate,
        ] = await Promise.all([
            prisma.question.count(),
            prisma.question.count({ where: { isAIGenerated: true } }),
            prisma.question.groupBy({
                by: ['difficulty'],
                _count: true,
            }),
            prisma.question.groupBy({
                by: ['categoryId'],
                _count: true,
            }),
            prisma.question.findMany({
                orderBy: { timesAsked: 'desc' },
                take: 10,
                select: {
                    id: true,
                    text: true,
                    timesAsked: true,
                    timesCorrect: true,
                    category: { select: { name: true } },
                },
            }),
            prisma.question.findMany({
                where: { timesAsked: { gte: 10 } },
                orderBy: {
                    timesCorrect: 'asc',
                },
                take: 10,
                select: {
                    id: true,
                    text: true,
                    timesAsked: true,
                    timesCorrect: true,
                    category: { select: { name: true } },
                },
            }),
        ]);

        // Get category names for the breakdown
        const categories = await prisma.category.findMany({
            select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));

        res.json({
            success: true,
            stats: {
                totalQuestions,
                aiGenerated,
                manuallyCreated: totalQuestions - aiGenerated,
                byDifficulty: byDifficulty.map(d => ({
                    difficulty: d.difficulty,
                    count: d._count,
                })),
                byCategory: byCategory.map(c => ({
                    category: categoryMap.get(c.categoryId) || 'Unknown',
                    count: c._count,
                })),
                mostAsked: mostAsked.map(q => ({
                    ...q,
                    accuracy: q.timesAsked > 0
                        ? Math.round((q.timesCorrect / q.timesAsked) * 100)
                        : 0,
                })),
                leastAccurate: leastAccurate.map(q => ({
                    ...q,
                    accuracy: q.timesAsked > 0
                        ? Math.round((q.timesCorrect / q.timesAsked) * 100)
                        : 0,
                })),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch question stats');
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// ============================================
// GET /api/admin/stats/users - User statistics
// ============================================

statsRouter.get('/users', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            newUsers,
            topPlayers,
            authProviderBreakdown,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.findMany({
                where: { createdAt: { gte: startDate } },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    createdAt: true,
                },
            }),
            prisma.user.findMany({
                orderBy: { totalScore: 'desc' },
                take: 10,
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    totalScore: true,
                    gamesPlayed: true,
                    wins: true,
                },
            }),
            prisma.user.groupBy({
                by: ['authProvider'],
                _count: true,
            }),
        ]);

        // Users per day
        const usersPerDay: Record<string, number> = {};
        for (const user of newUsers) {
            const day = user.createdAt.toISOString().split('T')[0];
            usersPerDay[day] = (usersPerDay[day] || 0) + 1;
        }

        res.json({
            success: true,
            stats: {
                totalUsers,
                newUsersCount: newUsers.length,
                usersPerDay,
                topPlayers,
                authProviderBreakdown: authProviderBreakdown.map(a => ({
                    provider: a.authProvider || 'anonymous',
                    count: a._count,
                })),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch user stats');
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});
