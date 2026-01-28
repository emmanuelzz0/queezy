// ============================================
// Express App Setup
// ============================================

import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';

// Routes
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin/index.js';

// ============================================
// Create Express App
// ============================================

export const app = express();

// ============================================
// Middleware
// ============================================

// CORS
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// JSON body parser
app.use(express.json());

// URL-encoded body parser
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.debug({
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
        });
    });
    next();
});

// ============================================
// Routes
// ============================================

// Health check
app.use('/health', healthRouter);

// Auth routes (for mobile QR login)
app.use('/auth', authRouter);

// Admin dashboard API
app.use('/api/admin', adminRouter);

// Static files for uploads (jingles GIFs/MP3s)
app.use('/uploads', express.static('uploads'));

// ============================================
// Error Handler
// ============================================

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err, url: req.url }, 'Unhandled error');
    res.status(500).json({
        success: false,
        error: config.isDev ? err.message : 'Internal server error',
    });
});

// ============================================
// 404 Handler
// ============================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
    });
});
