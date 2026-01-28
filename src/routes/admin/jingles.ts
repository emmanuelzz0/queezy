// ============================================
// Admin Jingles CRUD Routes
// ============================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { prisma } from '../../config/database.js';
import { config } from '../../config/index.js';
import { createJingleSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export const jinglesRouter = Router();

// ============================================
// Multer Setup for File Uploads
// ============================================

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(config.UPLOAD_DIR, 'jingles');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        cb(null, name);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: config.maxFileSizeBytes },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/gif', 'audio/mpeg', 'audio/mp3'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only GIF and MP3 allowed.'));
        }
    },
});

// ============================================
// GET /api/admin/jingles - List all jingles
// ============================================

jinglesRouter.get('/', async (req, res) => {
    try {
        const jingles = await prisma.jingle.findMany({
            orderBy: { sortOrder: 'asc' },
        });

        res.json({
            success: true,
            jingles,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch jingles');
        res.status(500).json({ success: false, error: 'Failed to fetch jingles' });
    }
});

// ============================================
// GET /api/admin/jingles/:id - Get single jingle
// ============================================

jinglesRouter.get('/:id', async (req, res) => {
    try {
        const jingle = await prisma.jingle.findUnique({
            where: { id: req.params.id },
        });

        if (!jingle) {
            return res.status(404).json({ success: false, error: 'Jingle not found' });
        }

        res.json({ success: true, jingle });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch jingle');
        res.status(500).json({ success: false, error: 'Failed to fetch jingle' });
    }
});

// ============================================
// POST /api/admin/jingles - Create jingle
// ============================================

jinglesRouter.post('/',
    upload.fields([
        { name: 'gif', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const validation = createJingleSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: validation.error.issues.map(i => i.message).join(', '),
                });
            }

            const files = req.files as { gif?: Express.Multer.File[]; audio?: Express.Multer.File[] };

            if (!files.gif?.[0] || !files.audio?.[0]) {
                return res.status(400).json({
                    success: false,
                    error: 'Both GIF and audio files are required',
                });
            }

            const { name, slug, thumbnail, duration } = validation.data;

            // Check slug uniqueness
            const existing = await prisma.jingle.findUnique({ where: { slug } });
            if (existing) {
                return res.status(400).json({ success: false, error: 'Slug already exists' });
            }

            const jingle = await prisma.jingle.create({
                data: {
                    name,
                    slug,
                    thumbnail,
                    duration,
                    gifUrl: `/uploads/jingles/${files.gif[0].filename}`,
                    audioUrl: `/uploads/jingles/${files.audio[0].filename}`,
                },
            });

            logger.info({ jingleId: jingle.id, name }, 'Jingle created');

            res.status(201).json({ success: true, jingle });
        } catch (error) {
            logger.error({ error }, 'Failed to create jingle');
            res.status(500).json({ success: false, error: 'Failed to create jingle' });
        }
    }
);

// ============================================
// PUT /api/admin/jingles/:id - Update jingle
// ============================================

jinglesRouter.put('/:id',
    upload.fields([
        { name: 'gif', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const { id } = req.params;
            const existing = await prisma.jingle.findUnique({ where: { id } });

            if (!existing) {
                return res.status(404).json({ success: false, error: 'Jingle not found' });
            }

            const files = req.files as { gif?: Express.Multer.File[]; audio?: Express.Multer.File[] };

            const updateData: Record<string, unknown> = {};

            if (req.body.name) updateData.name = req.body.name;
            if (req.body.slug) updateData.slug = req.body.slug;
            if (req.body.thumbnail) updateData.thumbnail = req.body.thumbnail;
            if (req.body.duration) updateData.duration = parseInt(req.body.duration);
            if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive === 'true';
            if (req.body.sortOrder !== undefined) updateData.sortOrder = parseInt(req.body.sortOrder);

            if (files.gif?.[0]) {
                updateData.gifUrl = `/uploads/jingles/${files.gif[0].filename}`;
            }
            if (files.audio?.[0]) {
                updateData.audioUrl = `/uploads/jingles/${files.audio[0].filename}`;
            }

            const jingle = await prisma.jingle.update({
                where: { id },
                data: updateData,
            });

            logger.info({ jingleId: id }, 'Jingle updated');

            res.json({ success: true, jingle });
        } catch (error) {
            logger.error({ error }, 'Failed to update jingle');
            res.status(500).json({ success: false, error: 'Failed to update jingle' });
        }
    }
);

// ============================================
// DELETE /api/admin/jingles/:id - Delete jingle
// ============================================

jinglesRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const jingle = await prisma.jingle.findUnique({ where: { id } });
        if (!jingle) {
            return res.status(404).json({ success: false, error: 'Jingle not found' });
        }

        // Delete files
        try {
            await fs.unlink(path.join('.', jingle.gifUrl));
            await fs.unlink(path.join('.', jingle.audioUrl));
        } catch {
            // Files may not exist, continue
        }

        await prisma.jingle.delete({ where: { id } });

        logger.info({ jingleId: id }, 'Jingle deleted');

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to delete jingle');
        res.status(500).json({ success: false, error: 'Failed to delete jingle' });
    }
});
