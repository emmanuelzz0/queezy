// ============================================
// Auth Types
// ============================================

export interface AuthUser {
    id: string;
    name: string;
    avatar: string;
    email?: string;
}

export interface UserTopic {
    id: string;
    name: string;
    description: string;
    icon: string;
    questionCount: number;
    createdAt: string;
}

export interface CustomTopic {
    id: string;
    name: string;
    description: string;
    icon: string;
    createdBy: {
        id: string;
        name: string;
        avatar: string;
    };
    questionCount: number;
    createdAt: string;
    roomCode: string;
}

export interface TVLoginToken {
    token: string;
    deviceId: string;
    socketId: string;
    createdAt: string;
    expiresAt: string;
}

export interface JWTPayload {
    userId: string;
    deviceId?: string;
    type: 'user' | 'tv' | 'admin';
    iat: number;
    exp: number;
}

export interface AdminJWTPayload {
    adminId: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
    iat: number;
    exp: number;
}
