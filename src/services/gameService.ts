// ============================================
// Game Service - Game Flow Management
// ============================================

import { TypedServer } from '../types/socket.js';
import { RoomService, roomService as defaultRoomService } from './roomService.js';
import { ScoreService, scoreService as defaultScoreService } from './scoreService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { COUNTDOWN_DURATION, WINNER_JINGLE_DURATION } from '../utils/constants.js';

export class GameService {
    private roomService: RoomService;
    private scoreService: ScoreService;
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private timerIntervals: Map<string, NodeJS.Timeout> = new Map();

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
    // Start countdown before first question
    // ============================================

    async startCountdown(roomCode: string, io: TypedServer): Promise<void> {
        const room = await this.roomService.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        // Update phase to starting
        await this.roomService.updatePhase(roomCode, 'starting');

        // Emit starting phase with countdown duration
        io.to(roomCode).emit('game:starting', {
            countdown: COUNTDOWN_DURATION,
        });

        logger.info({ roomCode, countdown: COUNTDOWN_DURATION }, 'Countdown started');

        // Emit countdown ticks
        let count = COUNTDOWN_DURATION;
        const countdownInterval = setInterval(() => {
            count--;
            io.to(roomCode).emit('game:countdown', { count });
            
            if (count <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);

        // Start first question after countdown
        this.clearTimer(roomCode);
        const timer = setTimeout(async () => {
            // Notify that game has started
            io.to(roomCode).emit('game:started', {
                phase: 'question',
                questionCount: room.questions.length,
                currentQuestion: 0,
            });
            
            // Show first question
            await this.showQuestion(roomCode, io);
        }, COUNTDOWN_DURATION * 1000);

        this.timers.set(roomCode, timer);
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

        const timeLimit = room.settings.timeLimit;

        // Emit question to room (without correct answer)
        io.to(roomCode).emit('game:question', {
            questionIndex,
            totalQuestions: room.questions.length,
            question: {
                text: question.text,
                options: question.options,
                timeLimit: timeLimit,
                imageUrl: question.imageUrl,
            },
            timeLimit: timeLimit,
        });

        // Clear any existing timers/intervals
        this.clearTimer(roomCode);

        // Start timer ticks for synced countdown
        let timeRemaining = timeLimit;
        const timerInterval = setInterval(() => {
            timeRemaining--;
            io.to(roomCode).emit('timer:tick', { timeRemaining });
            
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                this.timerIntervals.delete(roomCode);
                io.to(roomCode).emit('timer:end');
            }
        }, 1000);

        // Store the interval so we can clear it
        this.timerIntervals.set(roomCode, timerInterval);
        
        // Set timer for question timeout
        const timer = setTimeout(async () => {
            this.clearTimerInterval(roomCode);
            await this.questionTimeout(roomCode, io);
        }, (timeLimit + 1) * 1000); // +1 for network latency

        this.timers.set(roomCode, timer);

        logger.info(
            { roomCode, questionIndex, timeLimit },
            'Question shown with timer'
        );
    }

    // ============================================
    // Clear timer interval
    // ============================================

    private clearTimerInterval(roomCode: string): void {
        const interval = this.timerIntervals.get(roomCode);
        if (interval) {
            clearInterval(interval);
            this.timerIntervals.delete(roomCode);
        }
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

        logger.info({ 
            roomCode, 
            questionIndex: room.currentQuestionIndex,
            correctAnswer: question.correctAnswer,
            answersReceived: answers.length,
            answers: answers.map(a => ({ playerId: a.playerId, answer: a.answer })),
            players: room.players.map(p => ({ id: p.id, name: p.name })),
        }, 'Processing question timeout');

        // Calculate scores
        const results = await this.scoreService.calculateQuestionResults(
            roomCode,
            question,
            answers
        );

        logger.info({ 
            roomCode,
            results: results.map(r => ({ playerId: r.playerId, answer: r.answer, isCorrect: r.isCorrect })),
        }, 'Calculated results');

        // Update player scores
        for (const result of results) {
            await this.roomService.updatePlayerScore(
                roomCode,
                result.playerId,
                result.pointsEarned,
                result.isCorrect
            );
        }

        // Get updated standings and find the question winner (highest points earned this round)
        const standings = await this.roomService.getLeaderboard(roomCode);
        const questionWinner = results
            .filter(r => r.isCorrect && r.pointsEarned > 0)
            .sort((a, b) => b.pointsEarned - a.pointsEarned)[0];
        
        // Get the winner player info
        const winnerPlayer = questionWinner
            ? room.players.find(p => p.id === questionWinner.playerId)
            : null;

        // Transition to reveal
        await this.roomService.updatePhase(roomCode, 'reveal');

        // Emit reveal with winner info for jingle
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
            standings,
            // Winner of this question (for jingle)
            questionWinner: winnerPlayer ? {
                playerId: winnerPlayer.id,
                name: winnerPlayer.name,
                avatar: winnerPlayer.avatar,
                pointsEarned: questionWinner.pointsEarned,
                jingleId: winnerPlayer.jingleId,
            } : null,
        });

        logger.info({ 
            roomCode, 
            questionIndex: room.currentQuestionIndex,
            questionWinner: winnerPlayer?.name || 'none',
        }, 'Question timeout, revealing');

        // Auto-advance after reveal + winner jingle time
        // If there's a winner, add extra time for jingle
        const revealDuration = winnerPlayer ? 5000 + WINNER_JINGLE_DURATION : 5000;
        
        this.clearTimer(roomCode);
        const timer = setTimeout(async () => {
            await this.advanceToNextQuestion(roomCode, io);
        }, revealDuration);

        this.timers.set(roomCode, timer);
    }

    // ============================================
    // Advance to next question (no leaderboard between questions)
    // ============================================

    async advanceToNextQuestion(roomCode: string, io: TypedServer): Promise<void> {
        const { hasMore } = await this.roomService.nextQuestion(roomCode);

        if (hasMore) {
            // Go directly to next question (no leaderboard)
            await this.showQuestion(roomCode, io);
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
        // Also clear any interval
        this.clearTimerInterval(roomCode);
    }
}

export const gameService = new GameService();
