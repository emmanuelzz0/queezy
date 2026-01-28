// ============================================
// Available Avatars (synced with TV app)
// ============================================

export const AVATAR_EMOJIS = [
    '🦊', '🐼', '🦁', '🐯', '🐸', '🦄', '🐙', '🦋',
    '🐢', '🦈', '🦅', '🐲', '🦩', '🐳', '🦜', '🐨',
] as const;

export type AvatarEmoji = typeof AVATAR_EMOJIS[number];

/**
 * Check if avatar is valid
 */
export function isValidAvatar(avatar: string): boolean {
    return AVATAR_EMOJIS.includes(avatar as AvatarEmoji);
}

/**
 * Get a random avatar
 */
export function getRandomAvatar(seed?: string): AvatarEmoji {
    if (seed) {
        // Use seed to generate consistent avatar for same user
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const index = Math.abs(hash) % AVATAR_EMOJIS.length;
        return AVATAR_EMOJIS[index];
    }
    const index = Math.floor(Math.random() * AVATAR_EMOJIS.length);
    return AVATAR_EMOJIS[index];
}

/**
 * Avatar pool for unique avatars in a room
 */
export class AvatarPool {
    private usedAvatars: Set<AvatarEmoji> = new Set();
    private availableAvatars: AvatarEmoji[];

    constructor() {
        this.availableAvatars = [...AVATAR_EMOJIS];
        this.shuffle();
    }

    private shuffle(): void {
        for (let i = this.availableAvatars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.availableAvatars[i], this.availableAvatars[j]] =
                [this.availableAvatars[j], this.availableAvatars[i]];
        }
    }

    getUniqueAvatar(): AvatarEmoji {
        const avatar = this.availableAvatars.find(a => !this.usedAvatars.has(a));
        if (avatar) {
            this.usedAvatars.add(avatar);
            return avatar;
        }
        // If all used, return random
        return AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    }

    releaseAvatar(avatar: AvatarEmoji): void {
        this.usedAvatars.delete(avatar);
    }

    reset(): void {
        this.usedAvatars.clear();
        this.shuffle();
    }

    get availableCount(): number {
        return AVATAR_EMOJIS.length - this.usedAvatars.size;
    }
}
