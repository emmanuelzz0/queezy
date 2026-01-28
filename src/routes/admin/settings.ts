// ============================================
// Admin Settings Routes
// ============================================

import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

export const settingsRouter = Router();

// Default settings
const DEFAULT_SETTINGS: Record<string, { value: string; description: string }> = {
    'claude.model': { value: 'claude-sonnet-4-20250514', description: 'Claude AI model for question generation' },
    'claude.maxTokens': { value: '4096', description: 'Maximum tokens for Claude responses' },
    'game.defaultTimeLimit': { value: '20', description: 'Default time limit per question (seconds)' },
    'game.defaultQuestionCount': { value: '10', description: 'Default number of questions per game' },
    'game.maxPlayers': { value: '50', description: 'Maximum players per room' },
    'game.minPlayers': { value: '2', description: 'Minimum players to start' },
    'scoring.basePoints': { value: '1000', description: 'Base points for correct answer' },
    'scoring.streakBonus': { value: '100', description: 'Bonus points per streak level' },
    'scoring.maxStreakBonus': { value: '500', description: 'Maximum streak bonus' },
    'scoring.timeBonusMultiplier': { value: '0.5', description: 'Time bonus multiplier' },
};

// ============================================
// GET /api/admin/settings - Get all settings
// ============================================

settingsRouter.get('/', async (req, res) => {
    try {
        const dbSettings = await prisma.setting.findMany();

        // Merge with defaults
        const settings: Record<string, { value: string; description: string; isDefault: boolean }> = {};

        for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
            const dbSetting = dbSettings.find(s => s.key === key);
            settings[key] = {
                value: dbSetting?.value ?? defaultValue.value,
                description: dbSetting?.description ?? defaultValue.description,
                isDefault: !dbSetting,
            };
        }

        // Add any custom settings from DB
        for (const s of dbSettings) {
            if (!settings[s.key]) {
                settings[s.key] = {
                    value: s.value,
                    description: s.description ?? '',
                    isDefault: false,
                };
            }
        }

        res.json({ success: true, settings });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch settings');
        res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
});

// ============================================
// GET /api/admin/settings/:key - Get single setting
// ============================================

settingsRouter.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        const setting = await prisma.setting.findUnique({
            where: { key },
        });

        if (!setting) {
            const defaultSetting = DEFAULT_SETTINGS[key];
            if (defaultSetting) {
                return res.json({
                    success: true,
                    setting: { key, ...defaultSetting, isDefault: true },
                });
            }
            return res.status(404).json({ success: false, error: 'Setting not found' });
        }

        res.json({
            success: true,
            setting: { ...setting, isDefault: false },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to fetch setting');
        res.status(500).json({ success: false, error: 'Failed to fetch setting' });
    }
});

// ============================================
// PUT /api/admin/settings/:key - Update setting
// ============================================

settingsRouter.put('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;

        if (value === undefined) {
            return res.status(400).json({ success: false, error: 'Value is required' });
        }

        const setting = await prisma.setting.upsert({
            where: { key },
            create: {
                key,
                value: String(value),
                description: description ?? DEFAULT_SETTINGS[key]?.description ?? '',
            },
            update: {
                value: String(value),
                ...(description && { description }),
            },
        });

        logger.info({ key, value }, 'Setting updated');

        res.json({ success: true, setting });
    } catch (error) {
        logger.error({ error }, 'Failed to update setting');
        res.status(500).json({ success: false, error: 'Failed to update setting' });
    }
});

// ============================================
// DELETE /api/admin/settings/:key - Reset setting to default
// ============================================

settingsRouter.delete('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        await prisma.setting.delete({
            where: { key },
        }).catch(() => {
            // Setting doesn't exist, that's fine
        });

        logger.info({ key }, 'Setting reset to default');

        const defaultValue = DEFAULT_SETTINGS[key];
        res.json({
            success: true,
            setting: defaultValue
                ? { key, ...defaultValue, isDefault: true }
                : null,
        });
    } catch (error) {
        logger.error({ error }, 'Failed to reset setting');
        res.status(500).json({ success: false, error: 'Failed to reset setting' });
    }
});

// ============================================
// POST /api/admin/settings/bulk - Bulk update settings
// ============================================

settingsRouter.post('/bulk', async (req, res) => {
    try {
        const { settings } = req.body;

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: 'Settings object required' });
        }

        const updates = Object.entries(settings).map(([key, value]) =>
            prisma.setting.upsert({
                where: { key },
                create: {
                    key,
                    value: String(value),
                    description: DEFAULT_SETTINGS[key]?.description ?? '',
                },
                update: {
                    value: String(value),
                },
            })
        );

        await prisma.$transaction(updates);

        logger.info({ count: updates.length }, 'Bulk settings updated');

        res.json({ success: true, count: updates.length });
    } catch (error) {
        logger.error({ error }, 'Failed to bulk update settings');
        res.status(500).json({ success: false, error: 'Failed to bulk update settings' });
    }
});
