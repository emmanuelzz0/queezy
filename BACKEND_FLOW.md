# Queezy Backend - Architecture & API Flow

This document describes the backend architecture and the real-time API it provides to the TV app.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Connection Flow](#connection-flow)
4. [Socket Events Reference](#socket-events-reference)
5. [Game Flow](#game-flow)
6. [Data Types](#data-types)
7. [Admin API](#admin-api)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     TV App      │────▶│  Socket.io      │────▶│     Redis       │
│   (Next.js)     │     │    Server       │     │  (State Cache)  │
└─────────────────┘     │   Port 3001     │     └─────────────────┘
                        │                 │
┌─────────────────┐     │                 │     ┌─────────────────┐
│   Mobile App    │────▶│                 │────▶│   PostgreSQL    │
│   (Players)     │     └─────────────────┘     │   (Persistence) │
└─────────────────┘                             └─────────────────┘
                                │
                        ┌───────┴───────┐
                        │  Claude AI    │
                        │  (Questions)  │
                        └───────────────┘
```

### Core Components

| Component | Purpose |
|-----------|---------|
| **Socket.io Server** | Real-time bidirectional communication |
| **Redis** | Room state, player data, game session cache |
| **PostgreSQL** | Persistent storage (users, game history, custom topics) |
| **Claude AI** | Dynamic quiz question generation |

---

## Technology Stack

- **Runtime**: Node.js with TypeScript (ES Modules)
- **Framework**: Express.js + Socket.io
- **Database**: PostgreSQL via Prisma ORM
- **Cache**: Redis (ioredis)
- **AI**: Anthropic Claude API
- **Validation**: Zod

---

## Connection Flow

### 1. TV App Connection

```typescript
// TV connects with device identification
socket = io('ws://localhost:3001', {
  query: {
    deviceId: 'tv-unique-id',
    type: 'tv'
  }
});
```

### 2. Player Connection (Mobile)

```typescript
// Player connects after scanning QR code
socket = io('ws://localhost:3001', {
  query: {
    deviceId: 'player-device-id',
    type: 'player'
  }
});
```

---

## Socket Events Reference

### Client → Server Events

#### Room Management

| Event | Payload | Callback Response | Description |
|-------|---------|-------------------|-------------|
| `room:create` | `{ hostName?, deviceId? }` | `{ success, roomCode?, room? }` | TV creates a new game room |
| `room:join` | `{ roomCode, player: { name, avatar, jingleId? } }` | `{ success, player?, room? }` | Player joins a room |
| `room:leave` | `{ roomCode? }` | `{ success }` | Leave current room |
| `room:kick` | `{ roomCode, playerId }` | `{ success }` | TV kicks a player |
| `room:update-settings` | `{ roomCode, settings }` | `{ success, settings? }` | Update room settings |

#### Quiz Management

| Event | Payload | Callback Response | Description |
|-------|---------|-------------------|-------------|
| `quiz:generate` | `{ roomCode, category, questionCount, difficulty?, isCustomTopic?, topicId? }` | `{ success, questions? }` | Generate questions with Claude AI |
| `quiz:select-category` | `{ roomCode, categoryId, categoryName }` | `{ success }` | Select quiz category |
| `quiz:set-options` | `{ roomCode, questionCount?, difficulty?, timeLimit? }` | `{ success, settings? }` | Configure quiz options |

#### Game Control

| Event | Payload | Callback Response | Description |
|-------|---------|-------------------|-------------|
| `game:start` | `{ roomCode }` | `{ success }` | Start the game |
| `game:next-question` | `{ roomCode }` | `{ success }` | Manually advance to next question |
| `game:pause` | `{ roomCode }` | `{ success }` | Pause the game |
| `game:resume` | `{ roomCode }` | `{ success }` | Resume the game |
| `game:end` | `{ roomCode }` | `{ success }` | End the game early |
| `game:restart` | `{ roomCode }` | `{ success }` | Restart with same players |

#### Answer Submission

| Event | Payload | Callback Response | Description |
|-------|---------|-------------------|-------------|
| `answer:submit` | `{ roomCode, answer: 'A'|'B'|'C'|'D', timestamp }` | `{ success, accepted? }` | Player submits answer |
| `answer:timeout` | `{ roomCode }` | `{ success }` | TV signals time is up |

---

### Server → Client Events (What TV App Receives)

#### Room Events

| Event | Payload | Description |
|-------|---------|-------------|
| `room:created` | `{ roomCode, room }` | Room was created |
| `room:player-joined` | `{ player, playerCount }` | New player joined |
| `room:player-left` | `{ playerId, playerCount }` | Player left room |
| `room:player-disconnected` | `{ playerId }` | Player disconnected |
| `room:settings-updated` | `{ settings }` | Room settings changed |
| `room:kicked` | `{ reason }` | Player was kicked |

#### Quiz Events

| Event | Payload | Description |
|-------|---------|-------------|
| `quiz:generating` | `{ category, questionCount }` | Quiz generation started |
| `quiz:generated` | `{ category, questionCount }` | Quiz generation complete |
| `quiz:ready` | `{ questionCount, category }` | Quiz is ready to start |
| `quiz:category-selected` | `{ categoryId, categoryName }` | Category was selected |
| `quiz:error` | `{ error }` | Quiz generation failed |

#### Game Events

| Event | Payload | Description |
|-------|---------|-------------|
| `game:starting` | `{ countdown }` | Game is starting with countdown |
| `game:countdown` | `{ count }` | Countdown tick |
| `game:started` | `{ phase, questionCount, currentQuestion }` | Game has started |
| `game:question` | `{ questionIndex, totalQuestions, question, timeLimit }` | Show question |
| `game:reveal` | `{ correctAnswer, results[], standings[] }` | Reveal correct answer |
| `game:leaderboard` | `{ standings[], questionIndex, totalQuestions }` | Show leaderboard |
| `game:finished` | `{ standings[], winner? }` | Game is complete |
| `game:paused` | `{}` | Game was paused |
| `game:resumed` | `{}` | Game was resumed |

#### Answer Events

| Event | Payload | Description |
|-------|---------|-------------|
| `answer:received` | `{ playerId, answerCount, totalPlayers }` | Answer was received |
| `answer:all-received` | `{}` | All players have answered |
| `player:answered` | `{ playerId, answeredCount, totalPlayers }` | Player submitted answer |

#### Timer Events

| Event | Payload | Description |
|-------|---------|-------------|
| `timer:tick` | `{ timeRemaining }` | Timer countdown |
| `timer:end` | - | Timer has ended |

---

## Game Flow

### Complete Game Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GAME PHASES                                │
└─────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  LOBBY   │───▶│ STARTING │───▶│ QUESTION │───▶│  REVEAL  │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │                               │               │
       │                               │               ▼
       │                               │         ┌────────────┐
       │                               │         │WINNER JINGLE│ (if first correct)
       │                               │         └────────────┘
       │                               │               │
       │                               │               ▼
       │                               │         ┌────────────┐
       │                               └────────│ LEADERBOARD │
       │                               (loop)   └────────────┘
       │                                               │
       │                                               ▼
       │                                        ┌────────────┐
       │                                        │   FINAL    │
       │                                        └────────────┘
       │                                               │
       │                                               ▼
       │                                      ┌───────────────┐
       └─────────────────────────────────────│ FINAL RESULTS │
              (restart)                       └───────────────┘
```

### Phase Details

| Phase | Description | Duration |
|-------|-------------|----------|
| `lobby` | Players join, TV sets up quiz | Until TV starts |
| `starting` | Countdown before first question | ~3 seconds |
| `question` | Question displayed, accepting answers | `timeLimit` seconds |
| `reveal` | Show correct answer and who got it right | ~5 seconds |
| `winner-jingle` | Play winner's jingle (if applicable) | Jingle duration |
| `leaderboard` | Show current standings | ~4 seconds |
| `final` | Final standings with winner | Until restart |
| `final-results` | Extended final results view | Until restart |

### Typical Event Sequence

```
TV                          Server                      Players
 │                            │                            │
 │─── room:create ──────────▶│                            │
 │◀── room:created ──────────│                            │
 │                            │                            │
 │                            │◀── room:join ──────────────│
 │◀── room:player-joined ────│─── room:player-joined ────▶│
 │                            │                            │
 │─── quiz:generate ─────────▶│                            │
 │◀── quiz:generating ───────│                            │
 │◀── quiz:generated ────────│                            │
 │                            │                            │
 │─── game:start ────────────▶│                            │
 │◀── game:started ──────────│─── game:started ──────────▶│
 │                            │                            │
 │◀── game:question ─────────│─── game:question ─────────▶│
 │                            │                            │
 │                            │◀── answer:submit ─────────│
 │◀── answer:received ───────│                            │
 │                            │                            │
 │─── answer:timeout ────────▶│                            │
 │◀── game:reveal ───────────│─── game:reveal ───────────▶│
 │                            │                            │
 │◀── game:leaderboard ──────│                            │
 │                            │                            │
 │◀── game:question ─────────│     (repeat for each Q)    │
 │          ...               │                            │
 │                            │                            │
 │◀── game:finished ─────────│─── game:finished ─────────▶│
```

---

## Data Types

### Player

```typescript
interface Player {
  id: string;          // Socket ID
  name: string;        // Display name (2-20 chars)
  avatar: string;      // Avatar identifier
  score: number;       // Current score
  streak: number;      // Consecutive correct answers
  jingleId?: string;   // Victory jingle ID
  isConnected: boolean;
  isHost?: boolean;
}
```

### Question

```typescript
interface Question {
  id: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  timeLimit?: number;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  imageUrl?: string;
  isAIGenerated?: boolean;
}
```

### Room

```typescript
interface Room {
  code: string;              // 6-char room code
  tvSocketId: string;        // TV's socket ID
  phase: GamePhase;
  players: Player[];
  questions: Question[];
  currentQuestionIndex: number;
  currentAnswers?: Answer[];
  questionStartTime?: number;
  settings: RoomSettings;
  createdAt: string;
}
```

### RoomSettings

```typescript
interface RoomSettings {
  questionCount: number;     // Default: 10
  timeLimit: number;         // Seconds per question (default: 30)
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  category: string;          // Category ID
  categoryName?: string;     // Display name
  maxPlayers: number;        // Default: 20
  minPlayers: number;        // Default: 1
}
```

### LeaderboardEntry

```typescript
interface LeaderboardEntry {
  playerId: string;
  name: string;
  avatar: string;
  score: number;
  streak: number;
  rank: number;
  correctAnswers?: number;
}
```

### Game Reveal Result

```typescript
interface RevealResult {
  playerId: string;
  answer: 'A' | 'B' | 'C' | 'D' | null;
  isCorrect: boolean;
  pointsEarned: number;
  newScore: number;
  streak: number;
}
```

---

## Admin API

REST API for administration (requires JWT authentication).

### Base URL

```
http://localhost:3001/api/admin
```

### Authentication

```
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/me
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/categories` | GET, POST, PUT, DELETE | Manage quiz categories |
| `/questions` | GET, POST, PUT, DELETE | Manage custom questions |
| `/jingles` | GET, POST, DELETE | Manage winner jingles |
| `/users` | GET, POST, PUT, DELETE | Manage admin users |
| `/stats` | GET | View game statistics |
| `/settings` | GET, PUT | System settings |

---

## Scoring System

### Point Calculation

```typescript
basePoints = 1000
timeBonus = Math.round((timeRemaining / timeLimit) * 500)  // Up to 500 bonus
streakBonus = streak * 100  // 100 per consecutive correct

totalPoints = basePoints + timeBonus + streakBonus
```

### Scoring Rules

- **Base Points**: 1000 points for correct answer
- **Time Bonus**: Up to 500 points based on answer speed
- **Streak Bonus**: +100 points per consecutive correct answer
- **Wrong Answer**: 0 points, streak resets to 0

---

## Error Handling

All socket callbacks include error information:

```typescript
callback({
  success: false,
  error: 'Human-readable error message'
});
```

### Common Errors

| Error | Cause |
|-------|-------|
| `Room not found` | Invalid room code |
| `Game already in progress` | Cannot join after game started |
| `Room is full` | Max players reached |
| `Only host can start game` | Non-TV tried to control game |
| `Need at least X players` | Not enough players to start |
| `No questions loaded` | Tried to start without quiz |
| `Not accepting answers` | Answered outside question phase |
| `Already answered` | Duplicate answer submission |

---

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/queezy

# Redis
REDIS_URL=redis://localhost:6379

# Claude AI
CLAUDE_API_KEY=sk-ant-xxxxx

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3002

# JWT
JWT_SECRET=your-secret-key
```

---

## Quick Start for TV App Integration

### 1. Connect to Server

```typescript
import { io, Socket } from 'socket.io-client';

const socket = io('ws://localhost:3001', {
  query: { deviceId: 'tv-123', type: 'tv' },
  transports: ['websocket', 'polling'],
});
```

### 2. Create Room

```typescript
socket.emit('room:create', {}, (response) => {
  if (response.success) {
    console.log('Room created:', response.roomCode);
  }
});
```

### 3. Listen for Events

```typescript
socket.on('room:player-joined', ({ player, playerCount }) => {
  console.log(`${player.name} joined! (${playerCount} players)`);
});

socket.on('game:question', ({ question, timeLimit }) => {
  // Display question to players
});

socket.on('game:reveal', ({ correctAnswer, results }) => {
  // Show who got it right
});
```

### 4. Generate Quiz & Start

```typescript
socket.emit('quiz:generate', {
  roomCode: 'ABC123',
  category: 'science',
  questionCount: 10,
  difficulty: 'medium'
}, (response) => {
  if (response.success) {
    socket.emit('game:start', { roomCode: 'ABC123' }, () => {});
  }
});
```
