// ============================================
// Database Seeder - Initial Data
// ============================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ============================================
// Default Categories (matching TV app)
// ============================================

const CATEGORIES = [
    {
        name: 'Science & Technology',
        slug: 'science-tech',
        description: 'Explore the wonders of science and technology',
        icon: '🔬',
        color: 'from-blue-600 to-cyan-500',
        bgGradient: 'bg-gradient-to-br from-blue-600 to-cyan-500',
        sortOrder: 1,
    },
    {
        name: 'History',
        slug: 'history',
        description: 'Journey through time and historical events',
        icon: '📜',
        color: 'from-amber-600 to-orange-500',
        bgGradient: 'bg-gradient-to-br from-amber-600 to-orange-500',
        sortOrder: 2,
    },
    {
        name: 'Geography',
        slug: 'geography',
        description: 'Discover our world and its landscapes',
        icon: '🌍',
        color: 'from-green-600 to-emerald-500',
        bgGradient: 'bg-gradient-to-br from-green-600 to-emerald-500',
        sortOrder: 3,
    },
    {
        name: 'Entertainment',
        slug: 'entertainment',
        description: 'Movies, music, TV shows, and pop culture',
        icon: '🎬',
        color: 'from-pink-600 to-rose-500',
        bgGradient: 'bg-gradient-to-br from-pink-600 to-rose-500',
        sortOrder: 4,
    },
    {
        name: 'Sports',
        slug: 'sports',
        description: 'Test your sports knowledge',
        icon: '⚽',
        color: 'from-red-600 to-orange-500',
        bgGradient: 'bg-gradient-to-br from-red-600 to-orange-500',
        sortOrder: 5,
    },
    {
        name: 'Arts & Literature',
        slug: 'arts-literature',
        description: 'Art, books, and creative expression',
        icon: '🎨',
        color: 'from-purple-600 to-violet-500',
        bgGradient: 'bg-gradient-to-br from-purple-600 to-violet-500',
        sortOrder: 6,
    },
    {
        name: 'Food & Drink',
        slug: 'food-drink',
        description: 'Culinary knowledge from around the world',
        icon: '🍕',
        color: 'from-yellow-600 to-amber-500',
        bgGradient: 'bg-gradient-to-br from-yellow-600 to-amber-500',
        sortOrder: 7,
    },
    {
        name: 'Nature & Animals',
        slug: 'nature-animals',
        description: 'The natural world and wildlife',
        icon: '🦁',
        color: 'from-teal-600 to-green-500',
        bgGradient: 'bg-gradient-to-br from-teal-600 to-green-500',
        sortOrder: 8,
    },
];

// ============================================
// Default Jingles (matching TV app)
// ============================================

const JINGLES = [
    {
        name: 'Celebration',
        slug: 'celebration',
        thumbnail: '🎉',
        duration: 3000,
        gifUrl: '/jingles/celebration.gif',
        audioUrl: '/jingles/celebration.mp3',
        sortOrder: 1,
    },
    {
        name: 'Victory Dance',
        slug: 'victory-dance',
        thumbnail: '💃',
        duration: 4000,
        gifUrl: '/jingles/victory-dance.gif',
        audioUrl: '/jingles/victory-dance.mp3',
        sortOrder: 2,
    },
    {
        name: 'Fireworks',
        slug: 'fireworks',
        thumbnail: '🎆',
        duration: 3500,
        gifUrl: '/jingles/fireworks.gif',
        audioUrl: '/jingles/fireworks.mp3',
        sortOrder: 3,
    },
    {
        name: 'Champion',
        slug: 'champion',
        thumbnail: '🏆',
        duration: 4000,
        gifUrl: '/jingles/champion.gif',
        audioUrl: '/jingles/champion.mp3',
        sortOrder: 4,
    },
    {
        name: 'Confetti',
        slug: 'confetti',
        thumbnail: '🎊',
        duration: 3000,
        gifUrl: '/jingles/confetti.gif',
        audioUrl: '/jingles/confetti.mp3',
        sortOrder: 5,
    },
    {
        name: 'Applause',
        slug: 'applause',
        thumbnail: '👏',
        duration: 2500,
        gifUrl: '/jingles/applause.gif',
        audioUrl: '/jingles/applause.mp3',
        sortOrder: 6,
    },
];

// ============================================
// Default Settings
// ============================================

const SETTINGS = [
    { key: 'claude.model', value: 'claude-sonnet-4-20250514', description: 'Claude AI model for question generation' },
    { key: 'claude.maxTokens', value: '4096', description: 'Maximum tokens for Claude responses' },
    { key: 'game.defaultTimeLimit', value: '20', description: 'Default time limit per question (seconds)' },
    { key: 'game.defaultQuestionCount', value: '10', description: 'Default number of questions per game' },
    { key: 'game.maxPlayers', value: '50', description: 'Maximum players per room' },
    { key: 'game.minPlayers', value: '2', description: 'Minimum players to start' },
    { key: 'scoring.basePoints', value: '1000', description: 'Base points for correct answer' },
    { key: 'scoring.streakBonus', value: '100', description: 'Bonus points per streak level' },
    { key: 'scoring.maxStreakBonus', value: '500', description: 'Maximum streak bonus' },
];

// ============================================
// Seed Function
// ============================================

async function seed() {
    console.log('🌱 Starting database seed...\n');

    // Create super admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@queezy.app';
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

    const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });

    if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        await prisma.admin.create({
            data: {
                email: adminEmail,
                passwordHash: hashedPassword,
                name: 'Super Admin',
                role: 'SUPER_ADMIN',
            },
        });
        console.log('✅ Super admin created:', adminEmail);
    } else {
        console.log('⏭️  Super admin already exists');
    }

    // Create categories
    console.log('\n📁 Creating categories...');
    for (const category of CATEGORIES) {
        await prisma.category.upsert({
            where: { slug: category.slug },
            create: category,
            update: category,
        });
        console.log(`   ✅ ${category.name}`);
    }

    // Create jingles
    console.log('\n🎵 Creating jingles...');
    for (const jingle of JINGLES) {
        await prisma.jingle.upsert({
            where: { slug: jingle.slug },
            create: jingle,
            update: jingle,
        });
        console.log(`   ✅ ${jingle.name}`);
    }

    // Create settings
    console.log('\n⚙️  Creating settings...');
    for (const setting of SETTINGS) {
        await prisma.setting.upsert({
            where: { key: setting.key },
            create: setting,
            update: setting,
        });
        console.log(`   ✅ ${setting.key}`);
    }

    // Create sample questions for testing
    console.log('\n❓ Creating sample questions...');
    const scienceCategory = await prisma.category.findUnique({ where: { slug: 'science-tech' } });

    if (scienceCategory) {
        const sampleQuestions = [
            {
                text: 'What is the chemical symbol for gold?',
                optionA: 'Go',
                optionB: 'Au',
                optionC: 'Gd',
                optionD: 'Ag',
                correctAnswer: 'B',
                difficulty: 'EASY',
                categoryId: scienceCategory.id,
            },
            {
                text: 'How many planets are in our solar system?',
                optionA: '7',
                optionB: '8',
                optionC: '9',
                optionD: '10',
                correctAnswer: 'B',
                difficulty: 'EASY',
                categoryId: scienceCategory.id,
            },
            {
                text: 'What is the hardest natural substance on Earth?',
                optionA: 'Steel',
                optionB: 'Titanium',
                optionC: 'Diamond',
                optionD: 'Graphene',
                correctAnswer: 'C',
                difficulty: 'MEDIUM',
                categoryId: scienceCategory.id,
            },
        ];

        for (const question of sampleQuestions) {
            await prisma.question.upsert({
                where: {
                    text_categoryId: {
                        text: question.text,
                        categoryId: question.categoryId
                    }
                },
                create: question,
                update: question,
            });
        }
        console.log(`   ✅ ${sampleQuestions.length} sample questions created`);
    }

    console.log('\n✨ Database seed completed!\n');
}

// Run seed
seed()
    .catch((error) => {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
