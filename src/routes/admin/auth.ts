// ============================================
// Admin Auth Routes
// ============================================

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { adminLoginSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import type { AdminJWTPayload } from '../../types/auth.js';

export const adminAuthRouter = Router();

// ============================================
// POST /api/admin/auth/login
// ============================================

adminAuthRouter.post('/login', async (req, res) => {
    try {
        // Validate input
        const validation = adminLoginSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: validation.error.issues.map(i => i.message).join(', '),
            });
        }

        const { email, password } = validation.data;

        // Find admin
        const admin = await prisma.admin.findUnique({
            where: { email },
        });

        if (!admin || !admin.isActive) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, admin.passwordHash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
            });
        }

        // Generate JWT
        const payload: Omit<AdminJWTPayload, 'iat' | 'exp'> = {
            adminId: admin.id,
            email: admin.email,
            role: admin.role,
        };

        const token = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        });

        // Log action
        await prisma.adminAction.create({
            data: {
                adminId: admin.id,
                action: 'login',
                details: { ip: req.ip },
            },
        });

        logger.info({ adminId: admin.id, email: admin.email }, 'Admin logged in');

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Admin login error');
        res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});

// ============================================
// POST /api/admin/auth/verify
// ============================================

adminAuthRouter.post('/verify', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ valid: false });
        }

        const token = authHeader.slice(7);
        const payload = jwt.verify(token, config.JWT_SECRET) as AdminJWTPayload;

        const admin = await prisma.admin.findUnique({
            where: { id: payload.adminId },
            select: { id: true, email: true, name: true, role: true },
        });

        if (!admin) {
            return res.status(401).json({ valid: false });
        }

        res.json({
            valid: true,
            admin,
        });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});
