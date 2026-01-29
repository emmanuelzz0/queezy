// ============================================
// Admin Authentication Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Extended request with admin user
export interface AdminRequest extends Request {
    admin?: {
        id: string;
        email: string;
        role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
    };
}

// Token payload type
interface TokenPayload {
    adminId: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

// ============================================
// Verify JWT Token Middleware
// ============================================

export const verifyToken = async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ success: false, error: 'No token provided' });
            return;
        }

        const token = authHeader.substring(7);

        // Verify token
        const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

        // Check if admin still exists and is active
        const admin = await prisma.admin.findUnique({
            where: { id: decoded.adminId },
            select: { id: true, email: true, role: true, isActive: true },
        });

        if (!admin || !admin.isActive) {
            res.status(401).json({ success: false, error: 'Admin not found or inactive' });
            return;
        }

        // Attach admin to request
        req.admin = {
            id: admin.id,
            email: admin.email,
            role: admin.role as 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR',
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ success: false, error: 'Token expired' });
            return;
        }
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ success: false, error: 'Invalid token' });
            return;
        }

        logger.error({ error }, 'Token verification failed');
        res.status(500).json({ success: false, error: 'Authentication failed' });
    }
};

// ============================================
// Role-based Access Control Middleware
// ============================================

export const requireRole = (...allowedRoles: string[]) => {
    return (req: AdminRequest, res: Response, next: NextFunction): void => {
        if (!req.admin) {
            res.status(401).json({ success: false, error: 'Not authenticated' });
            return;
        }

        if (!allowedRoles.includes(req.admin.role)) {
            logger.warn(
                { adminId: req.admin.id, role: req.admin.role, required: allowedRoles },
                'Insufficient permissions'
            );
            res.status(403).json({ success: false, error: 'Insufficient permissions' });
            return;
        }

        next();
    };
};

// Convenience middleware for specific roles
export const requireAdmin = requireRole('SUPER_ADMIN', 'ADMIN');
export const requireSuperAdmin = requireRole('SUPER_ADMIN');
export const requireModerator = requireRole('SUPER_ADMIN', 'ADMIN', 'MODERATOR');
