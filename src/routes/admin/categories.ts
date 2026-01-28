// ============================================
// Admin Categories CRUD Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { createCategorySchema } from '../../utils/validation.js';
import { logger } from '../../utils/logger.js';

export const categoriesRouter = Router();

// ============================================
// GET /api/admin/categories - List all categories
// ============================================

categoriesRouter.get('/', async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: {
                    select: { questions: true },
                },
            },
        });

        res.json({
            success: true,
            categories: categories.map(c => ({
                ...c,
                questionCount: c._count.questions,
            })),
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch categories');
        res.status(500).json({ success: false, error: 'Failed to fetch categories' });
    }
});

// ============================================
// GET /api/admin/categories/:id - Get single category
// ============================================

categoriesRouter.get('/:id', async (req, res) => {
    try {
        const category = await prisma.category.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: { questions: true },
                },
            },
        });

        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        res.json({
            success: true,
            category: {
                ...category,
                questionCount: category._count.questions,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch category');
        res.status(500).json({ success: false, error: 'Failed to fetch category' });
    }
});

// ============================================
// POST /api/admin/categories - Create category
// ============================================

categoriesRouter.post('/', async (req, res) => {
    try {
        const validation = createCategorySchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: validation.error.issues.map(i => i.message).join(', '),
            });
        }

        const { name, slug, description, icon, color, bgGradient } = validation.data;

        // Check slug uniqueness
        const existing = await prisma.category.findUnique({ where: { slug } });
        if (existing) {
            return res.status(400).json({ success: false, error: 'Slug already exists' });
        }

        const category = await prisma.category.create({
            data: { name, slug, description, icon, color, bgGradient },
        });

        logger.info({ categoryId: category.id, name }, 'Category created');

        res.status(201).json({ success: true, category });
    } catch (error) {
        logger.error({ error }, 'Failed to create category');
        res.status(500).json({ success: false, error: 'Failed to create category' });
    }
});

// ============================================
// PUT /api/admin/categories/:id - Update category
// ============================================

categoriesRouter.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.category.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        const updateData: Record<string, unknown> = {};

        if (req.body.name) updateData.name = req.body.name;
        if (req.body.slug) updateData.slug = req.body.slug;
        if (req.body.description) updateData.description = req.body.description;
        if (req.body.icon) updateData.icon = req.body.icon;
        if (req.body.color) updateData.color = req.body.color;
        if (req.body.bgGradient) updateData.bgGradient = req.body.bgGradient;
        if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
        if (req.body.sortOrder !== undefined) updateData.sortOrder = req.body.sortOrder;

        const category = await prisma.category.update({
            where: { id },
            data: updateData,
        });

        logger.info({ categoryId: id }, 'Category updated');

        res.json({ success: true, category });
    } catch (error) {
        logger.error({ error }, 'Failed to update category');
        res.status(500).json({ success: false, error: 'Failed to update category' });
    }
});

// ============================================
// DELETE /api/admin/categories/:id - Delete category
// ============================================

categoriesRouter.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.category.findUnique({
            where: { id },
            include: { _count: { select: { questions: true } } },
        });

        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        if (category._count.questions > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete category with ${category._count.questions} questions. Delete or reassign questions first.`,
            });
        }

        await prisma.category.delete({ where: { id } });

        logger.info({ categoryId: id }, 'Category deleted');

        res.json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Failed to delete category');
        res.status(500).json({ success: false, error: 'Failed to delete category' });
    }
});
