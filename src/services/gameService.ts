// ============================================
// Game Service - Game Flow Management
// ============================================

import { TypedServer } from '../types/socket.js';
import { RoomService, roomService as defaultRoomService } from './roomService.js';
import { ScoreService, scoreService as defaultScoreService } from './scoreService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class GameService {
    private roomService: RoomService;
    private scoreService: ScoreService;
    private timers: Map<string, NodeJS.Timeout> = new Map();

    constructor(
        roomSvc: RoomService = defaultRoomService,
        scoreSvc: ScoreService = defaultScoreService
    ) {
        this.roomService = roomSvc;
        this.scoreService = scoreSvc;
    }

    // ============================================
    // Start the game
    // ============================================

    async startGame(roomCode: string): Promise<void> {
        const room = await this.roomService.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        // Update phase
        await this.roomService.updatePhase(roomCode, 'starting');

        // Create game session in database
        try {
            await prisma.gameSession.create({
                data: {
                    roomCode,
                    hostName: room.players.find(p => p.isHost)?.name || 'Host',
                    category: room.settings.category,
                    questionCount: room.questions.length,
                    playerCount: room.players.length,
                    startedAt: new Date(),
                },
            });
        } catch (error) {
            logger.error({ error }, 'Failed to create game session');
        }

        logger.info({ roomCode }, 'Game starting');
    }

    // ============================================
    // Show current question
    // ============================================

    async showQuestion(roomCode: string, io: TypedServer): Promise<void> {
        const room = await this.roomService.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const questionIndex = room.currentQuestionIndex;
        const question = room.questions[questionIndex];

        if (!question) {
            // No more questions - end game
            await this.endGame(roomCode, io);
            return;
        }

        // Clear previous answers
        await this.roomService.clearCurrentAnswers(roomCode);

        // Set question start time
        const startTime = Date.now();
        await this.roomService.setQuestionStartTime(roomCode, startTime);

        // Update phase to question
        await this.roomService.updatePhase(roomCode, 'question');

        // Emit question to room (without correct answer)
        io.to(roomCode).emit('game:question', {
            questionIndex,
            totalQuestions: room.questions.length,
            question: {
                text: question.text,
                options: question.options,
                timeLimit: room.settings.timeLimit,
                imageUrl: question.imageUrl,
            },
            timeLimit: room.settings.timeLimit,
        });

        // Set timer for question timeout
        this.clearTimer(roomCode);
        const timer = setTimeout(async () => {
            await this.questionTimeout(roomCode, io);
        }, (room.settings.timeLimit + 1) * 1000); // +1 for network latency

        this.timers.set(roomCode, timer);

        logger.info(
            { roomCode, questionIndex, timeLimit: room.settings.timeLimit },
            'Question shown'
        );
    }

    // ============================================
    // Handle question timeout
    // ============================================

    private async questionTimeout(roomCode: string, io: TypedServer): Promise<void> {
        const room = await this.roomService.getRoom(roomCode);
        if (!room || room.phase !== 'question') return;

        // Get current question and answers
        const question = room.questions[room.currentQuestionIndex];
        const answers = room.currentAnswers?.filter(
            a => a.questionIndex === room.currentQuestionIndex
        ) || [];

        // Calculate scores
        const results = await this.scoreService.calculateQuestionResults(
            roomCode,
            question,
            answers
        );

        // Update player scores
        for (const result of results) {
            await this.roomService.updatePlayerScore(
                roomCode,
                result.playerId,
                result.pointsEarned,
                result.isCorrect
            );
        }

        // Transition to reveal
        await this.roomService.updatePhase(roomCode, 'reveal');

        // Emit reveal
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
            standings: await this.roomService.getLeaderboard(roomCode),
        });

        logger.info({ roomCode, questionIndex: room.currentQuestionIndex }, 'Question timeout, revealing');

        // Auto-advance after reveal (or wait for TV to trigger)
        this.clearTimer(roomCode);
        const timer = setTimeout(async () => {
            await this.advanceToNextQuestion(roomCode, io);
        }, 5000);

        this.timers.set(roomCode, timer);
    }

    // ============================================
    // Advance to next question or leaderboard
    // ============================================

    async advanceToNextQuestion(roomCode: string, io: TypedServer): Promise<void> {
        const { hasMore, index } = await this.roomService.nextQuestion(roomCode);

        if (hasMore) {
            // Show leaderboard briefly
            await this.roomService.updatePhase(roomCode, 'leaderboard');

            io.to(roomCode).emit('game:leaderboard', {
                standings: await this.roomService.getLeaderboard(roomCode),
                questionIndex: index,
                totalQuestions: (await this.roomService.getRoom(roomCode))!.questions.length,
            });

            // Show next question after leaderboard
            this.clearTimer(roomCode);
            const timer = setTimeout(async () => {
                await this.showQuestion(roomCode, io);
            }, 4000);

            this.timers.set(roomCode, timer);
        } else {
            // Game over
            await this.endGame(roomCode, io);
        }
    }

    // ============================================
    // End the game
    // ============================================

    async endGame(roomCode: string, io: TypedServer): Promise<void> {
        this.clearTimer(roomCode);

        const room = await this.roomService.getRoom(roomCode);
        if (!room) return;

        await this.roomService.updatePhase(roomCode, 'final');

        const standings = await this.roomService.getLeaderboard(roomCode);
        const winner = standings[0];

        // Emit final results
        io.to(roomCode).emit('game:finished', {
            standings,
            winner: winner ? {
                playerId: winner.playerId,
                name: winner.name,
                avatar: winner.avatar,
                score: winner.score,
                jingleId: room.players.find(p => p.id === winner.playerId)?.jingleId,
            } : undefined,
        });

        // Update game session in database
        try {
            await prisma.gameSession.updateMany({
                where: { roomCode },
                data: {
                    endedAt: new Date(),
                },
            });

            // Save player histories
            for (const player of standings) {
                const roomPlayer = room.players.find(p => p.id === player.playerId);
                if (roomPlayer) {
                    // Try to find user by socket ID or create history
                    const session = await prisma.gameSession.findFirst({ where: { roomCode } });
                    if (session) {
                        await prisma.gameHistory.create({
                            data: {
                                sessionId: session.id,
                                finalScore: player.score,
                                finalRank: player.rank,
                                playerName: player.name,
                                correctAnswers: 0, // TODO: Track correct answers
                                totalQuestions: room.questions.length,
                            },
                        }).catch(() => {
                            // User might not exist in DB
                        });
                    }
                }
            }
        } catch (error) {
            logger.error({ error }, 'Failed to update game session');
        }

        logger.info({ roomCode, winner: winner?.name }, 'Game ended');
    }

    // ============================================
    // Pause the game
    // ============================================

    async pauseGame(roomCode: string): Promise<void> {
        this.clearTimer(roomCode);
        await this.roomService.updatePhase(roomCode, 'lobby'); // Or a 'paused' state
        logger.info({ roomCode }, 'Game paused');
    }

    // ============================================
    // Resume the game
    // ============================================

    async resumeGame(roomCode: string): Promise<void> {
        // Resume would need to restore the timer state
        // For now, just log
        logger.info({ roomCode }, 'Game resumed');
    }

    // ============================================
    // Restart game with same players
    // ============================================

    async restartGame(roomCode: string): Promise<void> {
        this.clearTimer(roomCode);
        await this.roomService.resetRoom(roomCode);
        logger.info({ roomCode }, 'Game restarted');
    }

    // ============================================
    // Helper: Clear room timer
    // ============================================

    private clearTimer(roomCode: string): void {
        const timer = this.timers.get(roomCode);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(roomCode);
        }
    }
}

export const gameService = new GameService();
