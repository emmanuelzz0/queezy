// ============================================
// Game Types - Synced with TV App
// ============================================

export type GamePhase =
    | 'lobby'
    | 'starting'
    | 'question'
    | 'answering'
    | 'reveal'
    | 'winner-jingle'
    | 'leaderboard'
    | 'final'
    | 'final-results';

export type AnswerOption = 'A' | 'B' | 'C' | 'D';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

export interface Player {
    id: string;
    name: string;
    avatar: string;
    score: number;
    streak: number;
    jingleId?: string;
    isConnected: boolean;
    isHost?: boolean;
    isReady?: boolean;
}

export interface Question {
    id: string;
    text: string;
    options: {
        A: string;
        B: string;
        C: string;
        D: string;
    };
    correctAnswer: AnswerOption;
    timeLimit?: number;
    category?: string;
    difficulty?: Difficulty;
    imageUrl?: string;
    isAIGenerated?: boolean;
}

// Question without correct answer (sent to mobile)
export type QuestionForPlayer = Omit<Question, 'correctAnswer'>;

export interface Answer {
    playerId: string;
    questionIndex: number;
    answer: AnswerOption;
    timestamp: number;
    timeElapsed: number;
}

export interface RoomSettings {
    questionCount: number;
    timeLimit: number;
    difficulty: Difficulty;
    category: string;
    categoryName?: string;
    maxPlayers: number;
    minPlayers: number;
}

export interface Room {
    code: string;
    tvSocketId: string;
    phase: GamePhase;
    players: Player[];
    questions: Question[];
    currentQuestionIndex: number;
    currentAnswers?: Answer[];
    questionStartTime?: number;
    settings: RoomSettings;
    createdAt: string;
}

export interface GameState {
    roomCode: string;
    phase: GamePhase;
    players: Player[];
    currentQuestion: Question | null;
    currentQuestionIndex: number;
    totalQuestions: number;
    timeRemaining: number;
    answerDistribution: Record<AnswerOption, number>;
    hostName: string;
}

// Game state for players (without correct answer)
export interface GameStateForPlayer extends Omit<GameState, 'currentQuestion'> {
    currentQuestion: QuestionForPlayer | null;
}

export interface LeaderboardEntry {
    playerId: string;
    name: string;
    avatar: string;
    score: number;
    rank: number;
}

export interface PlayerAnswer {
    playerId: string;
    answer: AnswerOption;
    timestamp: number;
    serverTimestamp: number;
    answerTime: number;
}
