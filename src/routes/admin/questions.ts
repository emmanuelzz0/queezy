// ============================================
// Admin Questions CRUD Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { createQuestionSchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';
import { Difficulty } from '@prisma/client';

export const questionsRouter = Router();

// ============================================
// GET /api/admin/questions - List questions with pagination
// ============================================

questionsRouter.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const categoryId = req.query.categoryId as string;
        const difficulty = req.query.difficulty as string;
        const search = req.query.search as string;

        const where: Record<string, unknown> = {};

        if (categoryId) where.categoryId = categoryId;
        if (difficulty) where.difficulty = difficulty;
        if (search) {
            where.text = { contains: search, mode: 'insensitive' };
        }

        const [questions, total] = await Promise.all([
            prisma.question.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    category: {
                        select: { id: true, name: true, icon: true },
                    },
                },
            }),
            prisma.question.count({ where }),
        ]);

        res.json({
            success: true,
            questions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch questions');
        res.status(500).json({ success: false, error: 'Failed to fetch questions' });
    }
});

// ============================================
// GET /api/admin/questions/:id - Get single question
// ============================================

questionsRouter.get('/:id', async (req, res) => {
    try {
        const question = await prisma.question.findUnique({
            where: { id: req.params.id },
            include: {
                category: {
                    select: { id: true, name: true, icon: true },
                },
            },
        });

        if (!question) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        res.json({ success: true, question });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch question');
        res.status(500).json({ success: false, error: 'Failed to fetch question' });
    }
});

// ============================================
// POST /api/admin/questions - Create question
// ============================================

questionsRouter.post('/', async (req, res) => {
    try {
        const validation = createQuestionSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: validation.error.issues.map(i => i.message).join(', '),
            });
        }

        const data = validation.data;

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: data.categoryId },
        });

        if (!category) {
            return res.status(400).json({ success: false, error: 'Category not found' });
        }

        const question = await prisma.question.create({
            data: {
                text: data.text,
                optionA: data.optionA,
                optionB: data.optionB,
                optionC: data.optionC,
                optionD: data.optionD,
                correctAnswer: data.correctAnswer,
                difficulty: data.difficulty as Difficulty,
                categoryId: data.categoryId,
                imageUrl: data.imageUrl,
                isAIGenerated: false,
            },
            include: {
                category: {
                    select: { id: true, name: true, icon: true },
                },
            },
        });

        logger.info({ questionId: question.id }, 'Question created');

        res.status(201).json({ success: true, question });
    } catch (error) {
        logger.error({ error }, 'Failed to create question');
        res.status(500).json({ success: false, error: 'Failed to create question' });
    }
});

// ============================================
// POST /api/admin/questions/bulk - Bulk create questions
// ============================================

questionsRouter.post('/bulk', async (req, res) => {
    try {
        const { questions, categoryId } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ success: false, error: 'Questions array required' });
        }

        // Verify category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            return res.status(400).json({ success: false, error: 'Category not found' });
        }

        const createdQuestions = await prisma.question.createMany({
            data: questions.map((q: Record<string, unknown>) => {
                const options = q.options as Record<string, string> | undefined;
                return {
                    text: q.text as string,
                    optionA: (q.optionA || options?.A) as string,
                    optionB: (q.optionB || options?.B) as string,
                    optionC: (q.optionC || options?.C) as string,
                    optionD: (q.optionD || options?.D) as string,
                    correctAnswer: q.correctAnswer as string,
                    difficulty: (q.difficulty as string || 'MEDIUM') as 'EASY' | 'MEDIUM' | 'HARD',
                    categoryId,
                    isAIGenerated: (q.isAIGenerated as boolean) || false,
                };
            }),
        });

        logger.info({ count: createdQuestions.count, categoryId }, 'Bulk questions created');

        res.status(201).json({
            success: true,
            count: createdQuestions.count,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to bulk create questions');
        res.status(500).json({ success: false, error: 'Failed to bulk create questions' });
    }
});

// ============================================
// PUT /api/admin/questions/:id - Update question
// ============================================

questionsRouter.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.question.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        const updateData: Record<string, unknown> = {};

        const allowedFields = ['text', 'optionA', 'optionB', 'optionC', 'optionD',
            'correctAnswer', 'categoryId', 'imageUrl', 'isActive'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Handle difficulty separately for proper enum typing
        if (req.body.difficulty !== undefined) {
            updateData.difficulty = req.body.difficulty as Difficulty;
        }

        const question = await prisma.question.update({
            where: { id },
            data: updateData,
            include: {
                category: {
                    select: { id: true, name: true, icon: true },
                },
            },
        });

        logger.info({ questionId: id }, 'Question updated');

        res.json({ success: true, question });
    } catch (error) {
        logger.error({ error }, 'Failed to update question');
        res.status(500).json({ success: false, error: 'Failed to update question' });
    }
});

// ============================================
// DELETE /api/admin/questions/:id - Delete question
// ============================================

questionsRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const question = await prisma.question.findUnique({ where: { id } });
        if (!question) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        await prisma.question.delete({ where: { id } });

        logger.info({ questionId: id }, 'Question deleted');

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to delete question');
        res.status(500).json({ success: false, error: 'Failed to delete question' });
    }
});

// ============================================
// DELETE /api/admin/questions/bulk - Bulk delete questions
// ============================================

questionsRouter.delete('/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, error: 'IDs array required' });
        }

        const result = await prisma.question.deleteMany({
            where: { id: { in: ids } },
        });

        logger.info({ count: result.count }, 'Bulk questions deleted');

        res.json({ success: true, count: result.count });
    } catch (error) {
        logger.error({ error }, 'Failed to bulk delete questions');
        res.status(500).json({ success: false, error: 'Failed to bulk delete questions' });
    }
});
