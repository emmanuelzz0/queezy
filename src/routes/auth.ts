// ============================================
// Auth Routes (Mobile -> TV Login)
// ============================================

import { Router } from 'express';
import { redis, keys } from '../config/redis.js';
import { mobileLoginSchema } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

// ============================================
// POST /auth/tv-login
// Called by mobile app after scanning QR code
// ============================================

authRouter.post('/tv-login', async (req, res) => {
    try {
        // Validate input
        const validation = mobileLoginSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: validation.error.issues.map(i => i.message).join(', '),
            });
        }

        const { token, user } = validation.data;

        // Get TV login token data from Redis
        const tokenData = await redis.hgetall(keys.tvLogin(token));

        if (!tokenData || !tokenData.socketId) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or expired login token',
                code: 'INVALID_TOKEN',
            });
        }

        // Store user data for the socket handler to emit
        await redis.hset(keys.tvLogin(token), {
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            userEmail: user.email || '',
            authenticated: 'true',
        });

        // Set expiry to clean up after emission
        await redis.expire(keys.tvLogin(token), 60); // 1 minute to emit

        logger.info({
            token,
            userId: user.id,
            userName: user.name,
        }, '✅ TV login authenticated');

        res.json({
            success: true,
            message: 'Login successful, TV will be notified',
        });
    } catch (error) {
        logger.error({ error }, 'TV login error');
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ============================================
// GET /auth/verify-token/:token
// Check if a login token exists and is valid
// ============================================

authRouter.get('/verify-token/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const exists = await redis.exists(keys.tvLogin(token));

        res.json({
            valid: exists === 1,
        });
    } catch {
        res.status(500).json({
            valid: false,
            error: 'Internal server error',
        });
    }
});
