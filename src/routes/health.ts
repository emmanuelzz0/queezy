// ============================================
// Health Check Route
// ============================================

import { Router } from 'express';
import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
    try {
        // Check Redis
        const redisOk = redis.status === 'ready';

        // Check Database
        let dbOk = false;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbOk = true;
        } catch {
            dbOk = false;
        }

        const healthy = redisOk && dbOk;

        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                redis: redisOk ? 'ok' : 'error',
                database: dbOk ? 'ok' : 'error',
            },
        });
    } catch (error) {
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
        });
    }
});
