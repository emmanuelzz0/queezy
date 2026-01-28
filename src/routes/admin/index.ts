// ============================================
// Admin Routes Index
// ============================================

import { Router } from 'express';
import { adminAuthRouter } from './auth.js';
import { jinglesRouter } from './jingles.js';
import { categoriesRouter } from './categories.js';
import { questionsRouter } from './questions.js';
import { usersRouter } from './users.js';
import { settingsRouter } from './settings.js';
import { statsRouter } from './stats.js';
import { verifyToken, requireAdmin } from '../../middleware/adminAuth.js';

export const adminRouter = Router();

// ============================================
// Public Routes (no auth)
// ============================================

adminRouter.use('/auth', adminAuthRouter);

// ============================================
// Protected Routes (require admin auth)
// ============================================

// All admin routes require valid JWT token
adminRouter.use('/jingles', verifyToken, jinglesRouter);
adminRouter.use('/categories', verifyToken, categoriesRouter);
adminRouter.use('/questions', verifyToken, questionsRouter);
adminRouter.use('/users', verifyToken, requireAdmin, usersRouter);
adminRouter.use('/settings', verifyToken, requireAdmin, settingsRouter);
adminRouter.use('/stats', verifyToken, statsRouter);
