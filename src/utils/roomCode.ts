// ============================================
// Room Code Generator
// ============================================

import { customAlphabet } from 'nanoid';

// Use uppercase letters and numbers, excluding confusing characters (0, O, I, 1, L)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const generateCode = customAlphabet(ALPHABET, CODE_LENGTH);

/**
 * Generate a unique room code
 * Format: 6 characters, uppercase alphanumeric
 * Example: "QUIZ4X", "K7MN2P"
 */
export function generateRoomCode(): string {
    return generateCode();
}

/**
 * Validate room code format
 */
export function isValidRoomCode(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    if (code.length !== CODE_LENGTH) return false;
    return /^[A-Z0-9]+$/.test(code);
}
