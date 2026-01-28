// ============================================
// Queezy Backend - Main Entry Point
// ============================================

import { createServer } from 'http';
import { app } from './app.js';
import { createSocketServer } from './socket.js';
import { config } from './config/index.js';
import { connectRedis } from './config/redis.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

// ============================================
// Startup
// ============================================

async function main() {
    try {
        logger.info('🚀 Starting Queezy Backend...');

        // Connect to database
        logger.info('📊 Connecting to database...');
        await connectDatabase();
        logger.info('✅ Database connected');

        // Connect to Redis
        logger.info('📦 Connecting to Redis...');
        await connectRedis();
        logger.info('✅ Redis connected');

        // Create HTTP server
        const httpServer = createServer(app);

        // Create Socket.io server
        const io = createSocketServer(httpServer);
        logger.info('🔌 Socket.io server created');

        // Start listening
        httpServer.listen(config.PORT, () => {
            logger.info(`✅ Server running on port ${config.PORT}`);
            logger.info(`📺 TV App can connect to: ws://localhost:${config.PORT}`);
            logger.info(`🔧 Admin API available at: http://localhost:${config.PORT}/api/admin`);

            if (config.isDev) {
                logger.info('🔥 Running in development mode');
            }
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            logger.info(`\n📴 ${signal} received, shutting down gracefully...`);

            httpServer.close(() => {
                logger.info('✅ HTTP server closed');
            });

            io.close(() => {
                logger.info('✅ Socket.io server closed');
            });

            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error({ error }, '❌ Failed to start server');
        process.exit(1);
    }
}

main();
