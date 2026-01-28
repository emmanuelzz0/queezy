// ============================================
// Quiz Service - Claude AI Quiz Generation
// ============================================

import { anthropic, QUIZ_SYSTEM_PROMPT, generateQuizPrompt, generateCustomTopicPrompt } from '../config/claude.js';
import { prisma } from '../config/database.js';
import { Question } from '../types/game.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

interface QuizGenerateOptions {
    category: string;
    questionCount: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

interface GeneratedQuestion {
    text: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    timeLimit?: number;
}

export class QuizService {
    // ============================================
    // Generate quiz using Claude AI
    // ============================================

    async generateQuiz(options: QuizGenerateOptions): Promise<Question[]> {
        const { category, questionCount, difficulty = 'mixed' } = options;

        try {
            logger.info({ category, questionCount, difficulty }, 'Generating quiz with Claude');

            const prompt = generateQuizPrompt(category, questionCount, difficulty);

            const response = await anthropic.messages.create({
                model: config.claude.model,
                max_tokens: config.claude.maxTokens,
                system: QUIZ_SYSTEM_PROMPT,
                messages: [
                    { role: 'user', content: prompt },
                ],
            });

            // Extract text content
            const textContent = response.content.find(c => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                throw new Error('No text content in response');
            }

            // Parse JSON response
            const parsed = this.parseQuizResponse(textContent.text);

            if (!parsed || parsed.length === 0) {
                throw new Error('Failed to parse quiz response');
            }

            logger.info(
                { category, generated: parsed.length },
                'Quiz generated successfully'
            );

            // Optionally save to database for future use
            await this.saveGeneratedQuestions(parsed, category);

            return parsed;
        } catch (error) {
            logger.error({ error, category }, 'Failed to generate quiz');

            // Fallback to database questions
            return this.getQuestionsFromDatabase(category, questionCount);
        }
    }

    // ============================================
    // Parse Claude's response
    // ============================================

    private parseQuizResponse(text: string): Question[] {
        try {
            // Try to extract JSON from the response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const questions: GeneratedQuestion[] = JSON.parse(jsonMatch[0]);

            return questions.map((q, index) => ({
                id: `gen_${Date.now()}_${index}`,
                text: q.text,
                options: q.options,
                correctAnswer: q.correctAnswer,
                timeLimit: q.timeLimit || 20,
                isAIGenerated: true,
            }));
        } catch (error) {
            logger.error({ error, text: text.substring(0, 500) }, 'Failed to parse quiz response');
            return [];
        }
    }

    // ============================================
    // Save generated questions to database
    // ============================================

    private async saveGeneratedQuestions(questions: Question[], category: string): Promise<void> {
        try {
            // Find category in database
            const dbCategory = await prisma.category.findFirst({
                where: {
                    OR: [
                        { slug: category.toLowerCase() },
                        { name: { contains: category, mode: 'insensitive' } },
                    ],
                },
            });

            if (!dbCategory) {
                logger.warn({ category }, 'Category not found in database, skipping save');
                return;
            }

            // Save each question
            for (const q of questions) {
                await prisma.question.create({
                    data: {
                        text: q.text,
                        optionA: q.options.A,
                        optionB: q.options.B,
                        optionC: q.options.C,
                        optionD: q.options.D,
                        correctAnswer: q.correctAnswer,
                        difficulty: 'MEDIUM',
                        categoryId: dbCategory.id,
                        isAIGenerated: true,
                    },
                }).catch(() => {
                    // Might be duplicate
                });
            }

            logger.info({ category, count: questions.length }, 'Questions saved to database');
        } catch (error) {
            logger.error({ error }, 'Failed to save generated questions');
        }
    }

    // ============================================
    // Get questions from database (fallback)
    // ============================================

    private async getQuestionsFromDatabase(category: string, count: number): Promise<Question[]> {
        try {
            const dbCategory = await prisma.category.findFirst({
                where: {
                    OR: [
                        { slug: category.toLowerCase() },
                        { name: { contains: category, mode: 'insensitive' } },
                    ],
                },
            });

            if (!dbCategory) {
                return [];
            }

            const questions = await prisma.question.findMany({
                where: {
                    categoryId: dbCategory.id,
                    isActive: true,
                },
                take: count,
                orderBy: {
                    timesAsked: 'asc', // Prioritize less-asked questions
                },
            });

            return questions.map(q => ({
                id: q.id,
                text: q.text,
                options: {
                    A: q.optionA,
                    B: q.optionB,
                    C: q.optionC,
                    D: q.optionD,
                },
                correctAnswer: q.correctAnswer as 'A' | 'B' | 'C' | 'D',
                timeLimit: 20,
                isAIGenerated: q.isAIGenerated,
            }));
        } catch (error) {
            logger.error({ error }, 'Failed to get questions from database');
            return [];
        }
    }

    // ============================================
    // Get questions for a custom topic
    // ============================================

    async getTopicQuestions(topicId: string): Promise<Question[]> {
        try {
            const topic = await prisma.userTopic.findUnique({
                where: { id: topicId },
                include: { questions: true },
            });

            if (!topic) {
                return [];
            }

            return topic.questions.map(q => ({
                id: q.id,
                text: q.text,
                options: {
                    A: q.optionA,
                    B: q.optionB,
                    C: q.optionC,
                    D: q.optionD,
                },
                correctAnswer: q.correctAnswer as 'A' | 'B' | 'C' | 'D',
            }));
        } catch (error) {
            logger.error({ error, topicId }, 'Failed to get topic questions');
            return [];
        }
    }

    // ============================================
    // Generate questions for a custom topic
    // ============================================

    async generateTopicQuestions(topicName: string, description: string, count: number): Promise<Question[]> {
        try {
            const prompt = generateCustomTopicPrompt(topicName, description, count);

            const response = await anthropic.messages.create({
                model: config.claude.model,
                max_tokens: config.claude.maxTokens,
                system: QUIZ_SYSTEM_PROMPT,
                messages: [
                    { role: 'user', content: prompt },
                ],
            });

            const textContent = response.content.find(c => c.type === 'text');
            if (!textContent || textContent.type !== 'text') {
                throw new Error('No text content in response');
            }

            return this.parseQuizResponse(textContent.text);
        } catch (error) {
            logger.error({ error, topicName }, 'Failed to generate topic questions');
            return [];
        }
    }
}

export const quizService = new QuizService();
