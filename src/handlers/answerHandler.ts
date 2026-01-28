// ============================================
// Answer Handler - Socket Events for Answer Submission
// ============================================

import { TypedSocket, TypedServer } from '../types/socket.js';
import { RoomService } from '../services/roomService.js';
import { ScoreService } from '../services/scoreService.js';
import { logger } from '../utils/logger.js';
import { answerSchema } from '../utils/validation.js';

export function registerAnswerHandlers(
    socket: TypedSocket,
    io: TypedServer,
    roomService: RoomService,
    scoreService: ScoreService
): void {
    // ============================================
    // answer:submit - Submit an answer
    // ============================================

    socket.on('answer:submit', async (data, callback) => {
        try {
            const { roomCode, answer, timestamp } = data;
            const playerId = socket.data.playerId || socket.id;

            // Validate answer
            const answerResult = answerSchema.safeParse(answer);
            if (!answerResult.success) {
                return callback({ success: false, error: 'Invalid answer' });
            }

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            // Check if in question phase
            if (room.phase !== 'question') {
                return callback({ success: false, error: 'Not accepting answers' });
            }

            // Check if player already answered this question
            const existingAnswer = room.currentAnswers?.find(
                a => a.playerId === playerId && a.questionIndex === room.currentQuestionIndex
            );
            if (existingAnswer) {
                return callback({ success: false, error: 'Already answered' });
            }

            // Record the answer
            const answerRecord = {
                playerId,
                questionIndex: room.currentQuestionIndex,
                answer: answerResult.data,
                timestamp: timestamp || Date.now(),
                timeElapsed: Date.now() - (room.questionStartTime || Date.now()),
            };

            await roomService.recordAnswer(roomCode, answerRecord);

            // Notify TV that player answered (don't reveal answer yet)
            io.to(roomCode).emit('answer:received', {
                playerId,
                answerCount: (room.currentAnswers?.length || 0) + 1,
                totalPlayers: room.players.filter(p => p.isConnected).length,
            });

            callback({ success: true, accepted: true });

            logger.debug(
                { roomCode, playerId, questionIndex: room.currentQuestionIndex },
                'Answer submitted'
            );

            // Check if all players answered
            const updatedRoom = await roomService.getRoom(roomCode);
            const connectedPlayers = updatedRoom!.players.filter(p => p.isConnected).length;
            const answerCount = updatedRoom!.currentAnswers?.filter(
                a => a.questionIndex === room.currentQuestionIndex
            ).length || 0;

            if (answerCount >= connectedPlayers) {
                // All players answered - trigger reveal early
                io.to(roomCode).emit('answer:all-received', {});
                logger.info({ roomCode }, 'All players answered');
            }
        } catch (error) {
            logger.error({ error }, 'Failed to submit answer');
            callback({ success: false, error: 'Failed to submit answer' });
        }
    });

    // ============================================
    // answer:timeout - Handle answer timeout (from TV)
    // ============================================

    socket.on('answer:timeout', async (data, callback) => {
        try {
            const { roomCode } = data;

            const room = await roomService.getRoom(roomCode);
            if (!room) {
                return callback({ success: false, error: 'Room not found' });
            }

            if (socket.data.role !== 'tv') {
                return callback({ success: false, error: 'Only TV can trigger timeout' });
            }

            // Calculate scores for this question
            const question = room.questions[room.currentQuestionIndex];
            const answers = room.currentAnswers?.filter(
                a => a.questionIndex === room.currentQuestionIndex
            ) || [];

            const results = await scoreService.calculateQuestionResults(
                roomCode,
                question,
                answers
            );

            // Update player scores
            for (const result of results) {
                await roomService.updatePlayerScore(
                    roomCode,
                    result.playerId,
                    result.pointsEarned,
                    result.isCorrect
                );
            }

            // Transition to reveal phase
            await roomService.updatePhase(roomCode, 'reveal');

            // Emit reveal event with results
            io.to(roomCode).emit('game:reveal', {
                correctAnswer: question.correctAnswer,
                results: results.map(r => ({
                    playerId: r.playerId,
                    answer: r.answer,
                    isCorrect: r.isCorrect,
                    pointsEarned: r.pointsEarned,
                    newScore: r.newScore,
                    streak: r.streak,
                })),
                standings: await roomService.getLeaderboard(roomCode),
            });

            callback({ success: true });

            logger.info(
                { roomCode, questionIndex: room.currentQuestionIndex, answerCount: answers.length },
                'Question revealed'
            );
        } catch (error) {
            logger.error({ error }, 'Failed to handle timeout');
            callback({ success: false, error: 'Failed to handle timeout' });
        }
    });
}
