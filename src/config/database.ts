// ============================================
// Prisma Database Client
// ============================================

import { PrismaClient } from '@prisma/client';
import { config } from './index.js';

// ============================================
// Prisma Client Singleton
// ============================================

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
});

if (!config.isProd) {
    globalForPrisma.prisma = prisma;
}

// ============================================
// Connection Helpers
// ============================================

export async function connectDatabase(): Promise<void> {
    await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
}
