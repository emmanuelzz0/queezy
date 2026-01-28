// ============================================
// Game Constants (synced with TV app)
// ============================================

// Timing
export const DEFAULT_TIME_LIMIT = 20;
export const COUNTDOWN_DURATION = 3;
export const REVEAL_DURATION = 5000;
export const LEADERBOARD_DURATION = 8000;
export const WINNER_JINGLE_DURATION = 3000;

// Players
export const MAX_PLAYERS = 50;
export const MIN_PLAYERS = 2;

// Scoring
export const BASE_POINTS = 1000;
export const STREAK_BONUS = 100;
export const MAX_STREAK_BONUS = 500;
export const TIME_BONUS_MULTIPLIER = 0.5;

// Default jingles (synced with TV app)
export const DEFAULT_JINGLES = [
    { id: 'confetti-explosion', name: 'Confetti Explosion', thumbnail: '🎊', duration: 3000 },
    { id: 'fireworks', name: 'Fireworks', thumbnail: '🎆', duration: 3000 },
    { id: 'trophy-spin', name: 'Trophy Spin', thumbnail: '🏆', duration: 3000 },
    { id: 'star-burst', name: 'Star Burst', thumbnail: '⭐', duration: 3000 },
    { id: 'party-popper', name: 'Party Popper', thumbnail: '🎉', duration: 3000 },
    { id: 'crown-gold', name: 'Golden Crown', thumbnail: '👑', duration: 3000 },
    { id: 'celebration-dance', name: 'Celebration Dance', thumbnail: '💃', duration: 3000 },
    { id: 'lightning-bolt', name: 'Lightning Fast', thumbnail: '⚡', duration: 3000 },
] as const;

// Default categories (synced with TV app)
export const DEFAULT_CATEGORIES = [
    { id: 'general', name: 'General Knowledge', icon: '🧠', color: 'text-purple-400' },
    { id: 'science', name: 'Science', icon: '🔬', color: 'text-cyan-400' },
    { id: 'history', name: 'History', icon: '🏛️', color: 'text-amber-400' },
    { id: 'geography', name: 'Geography', icon: '🌍', color: 'text-green-400' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎭', color: 'text-pink-400' },
    { id: 'sports', name: 'Sports', icon: '⚽', color: 'text-orange-400' },
    { id: 'art', name: 'Art & Design', icon: '🎨', color: 'text-fuchsia-400' },
    { id: 'technology', name: 'Technology', icon: '💻', color: 'text-blue-400' },
    { id: 'nature', name: 'Nature & Animals', icon: '🦁', color: 'text-lime-400' },
    { id: 'food', name: 'Food & Drinks', icon: '🍕', color: 'text-red-400' },
    { id: 'music', name: 'Music', icon: '🎵', color: 'text-violet-400' },
    { id: 'movies', name: 'Movies & TV', icon: '🎬', color: 'text-yellow-400' },
    { id: 'literature', name: 'Literature', icon: '📚', color: 'text-teal-400' },
    { id: 'gaming', name: 'Gaming', icon: '🎮', color: 'text-emerald-400' },
    { id: 'trivia-mix', name: 'Trivia Mix', icon: '🎲', color: 'text-rose-400' },
] as const;

export type CategoryId = typeof DEFAULT_CATEGORIES[number]['id'];
export type JingleId = typeof DEFAULT_JINGLES[number]['id'];
