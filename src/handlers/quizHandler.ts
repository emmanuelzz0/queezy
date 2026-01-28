// ============================================
// Quiz Handler - Socket Events for Quiz Generation
// ============================================

import { TypedSocket, TypedServer } from '../types/socket.js';
import { RoomService } from '../services/roomService.js';
import { QuizService } from '../services/quizService.js';
import { logger } from '../utils/logger.js';
import { quizGenerateSchema } from '../utils/validation.js';

export function registerQuizHandlers(
    socket: TypedSocket,
    io: TypedServer,
    roomService: RoomService,
    quizService: QuizService
): void {
    // ============================================
    // quiz:generate - Generate quiz questions with Claude
    // ============================================

    socket.on('quiz:generate', async (data, callback) => {
        try {
            // Validate input
            const validation = quizGenerateSchema.safeParse(data);
            if (!validation.success) {
                return callback({
                    success: false,
                    error: validation.error.issues.map(i => i.message).join(', '),
                });
            }

            const { roomCode, category, questionCount, difficulty, isCustomTopic, topicId } = validation.data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if requester is TV/host
            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can generate quiz' });
            }

            // Notify room that generation is starting
            io.to(roomCode).emit('quiz:generating', {
                category,
                questionCount,
            });

            logger.info({ roomCode, category, questionCount, difficulty }, 'Generating quiz');

            let questions;

            if (isCustomTopic && topicId) {
                // Use pre-made topic questions
                questions = await quizService.getTopicQuestions(topicId);
            } else {
                // Generate with Claude AI
                questions = await quizService.generateQuiz({
                    category,
                    questionCount,
                    difficulty,
                });
            }

            if (!questions || questions.length === 0) {
                return callback({ success: false, error: 'Failed to generate questions' });
            }

            // Store questions in room
            await roomService.setQuestions(roomCode, questions, category);

            // Notify room
            io.to(roomCode).emit('quiz:generated', {
                category,
                questionCount: questions.length,
            });

            callback({
                success: true,
                questions: questions.length,
            });

            logger.info(
                { roomCode, category, generated: questions.length },
                'Quiz generated'
            );
        } catch (error) {
            logger.error({ error }, 'Failed to generate quiz');

            // Notify room of error
            const roomCode = (data as { roomCode?: string })?.roomCode;
            if (roomCode) {
                io.to(roomCode).emit('quiz:error', {
                    error: 'Failed to generate quiz. Please try again.',
                });
            }

            callback({ success: false, error: 'Failed to generate quiz' });
        }
    });

    // ============================================
    // quiz:select-category - Select a quiz category
    // ============================================

    socket.on('quiz:select-category', async (data, callback) => {
        try {
            const { roomCode, categoryId, categoryName } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can select category' });
            }

            // Update room with selected category
            await roomService.updateCategory(roomCode, categoryId, categoryName);

            // Notify room
            io.to(roomCode).emit('quiz:category-selected', {
                categoryId,
                categoryName,
            });

            callback({ success: true });

            logger.info({ roomCode, categoryId }, 'Category selected');
        } catch (error) {
            logger.error({ error }, 'Failed to select category');
            callback({ success: false, error: 'Failed to select category' });
        }
    });

    // ============================================
    // quiz:set-options - Set quiz options (difficulty, count)
    // ============================================

    socket.on('quiz:set-options', async (data, callback) => {
        try {
            const { roomCode, questionCount, difficulty, timeLimit } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only host can set options' });
            }

            // Update settings
            const newSettings = {
                ...room.settings,
                ...(questionCount && { questionCount }),
                ...(difficulty && { difficulty: difficulty as 'easy' | 'medium' | 'hard' | 'mixed' }),
                ...(timeLimit && { timeLimit }),
            };

            await roomService.updateSettings(roomCode, newSettings);

            callback({ success: true, settings: newSettings });

            logger.info({ roomCode, options: { questionCount, difficulty, timeLimit } }, 'Quiz options set');
        } catch (error) {
            logger.error({ error }, 'Failed to set options');
            callback({ success: false, error: 'Failed to set options' });
        }
    });
}
