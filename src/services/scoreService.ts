// ============================================
// Score Service - Scoring Logic
// ============================================

import { Question, Answer, Player } from '../types/game.js';
import { roomService } from './roomService.js';

// Scoring constants
const BASE_POINTS = 1000;
const STREAK_BONUS = 100;
const MAX_STREAK_BONUS = 500;
const TIME_BONUS_MULTIPLIER = 0.5;

interface QuestionResult {
    playerId: string;
    answer: 'A' | 'B' | 'C' | 'D' | null;
    isCorrect: boolean;
    pointsEarned: number;
    newScore: number;
    streak: number;
    timeElapsed: number;
}

export class ScoreService {
    // ============================================
    // Calculate points for a correct answer
    // ============================================

    calculatePoints(
        isCorrect: boolean,
        timeElapsed: number,
        timeLimit: number,
        streak: number
    ): number {
        if (!isCorrect) return 0;

        // Base points
        let points = BASE_POINTS;

        // Time bonus: faster answers get more points
        const timeRatio = Math.max(0, 1 - (timeElapsed / (timeLimit * 1000)));
        const timeBonus = Math.floor(BASE_POINTS * timeRatio * TIME_BONUS_MULTIPLIER);
        points += timeBonus;

        // Streak bonus
        const streakBonus = Math.min(streak * STREAK_BONUS, MAX_STREAK_BONUS);
        points += streakBonus;

        return points;
    }

    // ============================================
    // Calculate results for a question
    // ============================================

    async calculateQuestionResults(
        roomCode: string,
        question: Question,
        answers: Answer[]
    ): Promise<QuestionResult[]> {
        const room = await roomService.getRoom(roomCode);
        if (!room) throw new Error('Room not found');

        const results: QuestionResult[] = [];
        const timeLimit = question.timeLimit || room.settings.timeLimit;

        for (const player of room.players) {
            const answer = answers.find(a => a.playerId === player.id);

            const isCorrect = answer?.answer === question.correctAnswer;
            const currentStreak = isCorrect ? player.streak + 1 : 0;

            const points = this.calculatePoints(
                isCorrect,
                answer?.timeElapsed || timeLimit * 1000,
                timeLimit,
                player.streak // Use streak before this question
            );

            results.push({
                playerId: player.id,
                answer: answer?.answer ?? null,
                isCorrect,
                pointsEarned: points,
                newScore: player.score + points,
                streak: currentStreak,
                timeElapsed: answer?.timeElapsed || 0,
            });
        }

        // Sort by points earned (for this question)
        results.sort((a, b) => b.pointsEarned - a.pointsEarned);

        return results;
    }

    // ============================================
    // Get final rankings
    // ============================================

    calculateFinalRankings(players: Player[]): Array<{
        playerId: string;
        name: string;
        avatar: string;
        score: number;
        rank: number;
        isWinner: boolean;
    }> {
        const sorted = [...players].sort((a, b) => b.score - a.score);

        return sorted.map((player, index) => ({
            playerId: player.id,
            name: player.name,
            avatar: player.avatar,
            score: player.score,
            rank: index + 1,
            isWinner: index === 0,
        }));
    }

    // ============================================
    // Calculate statistics
    // ============================================

    calculateStatistics(
        players: Player[],
        answers: Answer[],
        questions: Question[]
    ): {
        totalAnswers: number;
        correctAnswers: number;
        averageScore: number;
        fastestAnswer: { playerId: string; time: number } | null;
        longestStreak: { playerId: string; streak: number } | null;
    } {
        const totalAnswers = answers.length;
        const correctAnswers = answers.filter((a, _idx) => {
            const question = questions[a.questionIndex];
            return question && a.answer === question.correctAnswer;
        }).length;

        const averageScore = players.length > 0
            ? players.reduce((sum, p) => sum + p.score, 0) / players.length
            : 0;

        // Find fastest correct answer
        let fastestAnswer: { playerId: string; time: number } | null = null;
        for (const answer of answers) {
            const question = questions[answer.questionIndex];
            if (question && answer.answer === question.correctAnswer) {
                if (!fastestAnswer || answer.timeElapsed < fastestAnswer.time) {
                    fastestAnswer = {
                        playerId: answer.playerId,
                        time: answer.timeElapsed,
                    };
                }
            }
        }

        // Find longest streak
        let longestStreak: { playerId: string; streak: number } | null = null;
        for (const player of players) {
            if (!longestStreak || player.streak > longestStreak.streak) {
                longestStreak = {
                    playerId: player.id,
                    streak: player.streak,
                };
            }
        }

        return {
            totalAnswers,
            correctAnswers,
            averageScore: Math.round(averageScore),
            fastestAnswer,
            longestStreak,
        };
    }
}

export const scoreService = new ScoreService();
