// ============================================
// Public Jingles Routes (for TV app)
// ============================================

import { Router } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export const jinglesRouter = Router();

// ============================================
// GET /api/jingles - Get active jingles (public)
// ============================================

jinglesRouter.get('/', async (req, res) => {
    try {
        const jingles = await prisma.jingle.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });

        res.json({
            success: true,
            jingles,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch public jingles');
        res.status(500).json({ success: false, error: 'Failed to fetch jingles' });
    }
});

// ============================================
// GET /api/jingles/:slug - Get jingle by slug (public)
// ============================================

jinglesRouter.get('/:slug', async (req, res) => {
    try {
        const jingle = await prisma.jingle.findFirst({
            where: { 
                slug: req.params.slug,
                isActive: true 
            },
        });

        if (!jingle) {
            return res.status(404).json({ success: false, error: 'Jingle not found' });
        }

        res.json({ success: true, jingle });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch jingle by slug');
        res.status(500).json({ success: false, error: 'Failed to fetch jingle' });
    }
});
