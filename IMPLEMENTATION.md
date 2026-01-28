# Queezy Backend Implementation Guide

> **Last Updated:** January 27, 2026  
> **Status:** � In Progress (70% Complete)  
> **Target:** Socket.io + Redis + PostgreSQL Backend for TV Quiz Game

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [TV App Analysis](#tv-app-analysis)
4. [Data Structures](#data-structures)
5. [Socket Events Specification](#socket-events-specification)
6. [API Endpoints](#api-endpoints)
7. [Admin Dashboard API](#admin-dashboard-api)
8. [Game Flow State Machine](#game-flow-state-machine)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Implementation Progress](#implementation-progress)
11. [File Structure](#file-structure)

---

## Overview

### What We're Building

A real-time multiplayer quiz game backend that connects:
- **TV App** (Next.js) - Displays game on big screen
- **Mobile App** (React Native) - Players join and answer
- **Admin Dashboard** - Manage jingles, categories, questions, users
- **Backend** (Node.js + Socket.io) - Game orchestration

### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Express.js |
| Real-time | Socket.io |
| Database | PostgreSQL + Prisma ORM |
| Cache/Sessions | Redis (ioredis) |
| AI | **Anthropic Claude API** (claude-sonnet-4-20250514) |
| Auth | JWT + bcrypt + QR Code flow |
| Validation | Zod |
| File Uploads | Multer |
| Logging | Pino |
| Deployment | Railway |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│    │   TV App     │         │  Mobile App  │         │   Admin      │   │
│    │   (Host)     │         │  (Players)   │         │  Dashboard   │   │
│    └──────┬───────┘         └──────┬───────┘         └──────┬───────┘   │
│           │                        │                        │            │
│           │    WebSocket           │    WebSocket           │ REST API   │
│           │                        │                        │            │
└───────────┼────────────────────────┼────────────────────────┼────────────┘
            │                        │                        │
            ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Railway)                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌────────────────────────────────────────────────────────────────┐   │
│    │                      Socket.io Server                          │   │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│    │  │  Room    │  │   Game   │  │  Answer  │  │    Quiz      │   │   │
│    │  │ Handler  │  │  Handler │  │  Handler │  │   Handler    │   │   │
│    │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │   │
│    └────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│    ┌────────────────────────────────────────────────────────────────┐   │
│    │                       REST API (Admin)                          │   │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│    │  │ Jingles  │  │Categories│  │Questions │  │  Users/Stats │   │   │
│    │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │   │
│    └────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│    ┌────────────────────────────────────────────────────────────────┐   │
│    │                         Services                                │   │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│    │  │  Room    │  │  Game    │  │  Score   │  │   Claude AI  │   │   │
│    │  │ Service  │  │ Service  │  │ Service  │  │   Service    │   │   │
│    │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │   │
│    └────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                    ┌───────────────┴───────────────┐                     │
│                    ▼                               ▼                     │
│    ┌──────────────────────────┐    ┌──────────────────────────────┐     │
│    │      Redis (Cache)       │    │    PostgreSQL (Persistent)   │     │
│    │  • Active Rooms          │    │  • Users, Admins             │     │
│    │  • Game State            │    │  • Categories, Questions     │     │
│    │  • Auth Tokens           │    │  • Jingles, Settings         │     │
│    └──────────────────────────┘    │  • Game History              │     │
│                                    └──────────────────────────────┘     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## TV App Analysis

### Extracted from TV App Source Code

#### Game Phases (State Machine)

```typescript
type GamePhase =
    | 'lobby'           // Waiting for players to join
    | 'starting'        // 3-2-1 countdown
    | 'question'        // Question displayed, timer running
    | 'answering'       // Same as question (players submitting)
    | 'reveal'          // Show correct answer + distribution
    | 'winner-jingle'   // Play winner's jingle animation
    | 'leaderboard'     // Show current standings
    | 'final-results';  // Game over, show podium
```

#### Player Structure (from TV types)

```typescript
interface Player {
    id: string;
    name: string;
    avatar: string;           // Emoji: 🦊, 🐼, 🦁, etc.
    score: number;
    streak: number;           // Consecutive correct answers
    lastAnswerCorrect: boolean | null;
    hasAnswered: boolean;
    answerTime?: number;      // Seconds to answer
    jingleId?: string;        // Selected celebration jingle
}
```

#### Question Structure (from TV types)

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
    timeLimit: number;        // Seconds (15-30)
    category?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    imageUrl?: string;        // Optional question image
}
```

#### Game State (from TV types)

```typescript
interface GameState {
    roomCode: string;
    phase: GamePhase;
    players: Player[];
    currentQuestion: Question | null;
    currentQuestionIndex: number;   // 1-based for display
    totalQuestions: number;
    timeRemaining: number;
    answerDistribution: Record<'A' | 'B' | 'C' | 'D', number>;
    hostName: string;
}
```

#### Quiz Categories (15 built-in)

| ID | Name | Icon |
|----|------|------|
| `general` | General Knowledge | 🧠 |
| `science` | Science | 🔬 |
| `history` | History | 🏛️ |
| `geography` | Geography | 🌍 |
| `entertainment` | Entertainment | 🎭 |
| `sports` | Sports | ⚽ |
| `art` | Art & Design | 🎨 |
| `technology` | Technology | 💻 |
| `nature` | Nature & Animals | 🦁 |
| `food` | Food & Drinks | 🍕 |
| `music` | Music | 🎵 |
| `movies` | Movies & TV | 🎬 |
| `literature` | Literature | 📚 |
| `gaming` | Gaming | 🎮 |
| `trivia-mix` | Trivia Mix | 🎲 |

#### Available Avatars (16 emojis)

```
🦊 🐼 🦁 🐯 🐸 🦄 🐙 🦋 🐢 🦈 🦅 🐲 🦩 🐳 🦜 🐨
```

#### Winner Jingles (8 options)

| ID | Name | Thumbnail |
|----|------|-----------|
| `confetti-explosion` | Confetti Explosion | 🎊 |
| `fireworks` | Fireworks | 🎆 |
| `trophy-spin` | Trophy Spin | 🏆 |
| `star-burst` | Star Burst | ⭐ |
| `party-popper` | Party Popper | 🎉 |
| `crown-gold` | Golden Crown | 👑 |
| `celebration-dance` | Celebration Dance | 💃 |
| `lightning-bolt` | Lightning Fast | ⚡ |

#### Scoring System (from constants)

```typescript
BASE_POINTS = 1000;
STREAK_BONUS = 100;           // Per streak level
MAX_STREAK_BONUS = 500;       // Cap at 5 streak
TIME_BONUS_MULTIPLIER = 0.5;  // Faster = more points

// Formula: BASE + (timeBonus * TIME_BONUS_MULTIPLIER) + min(streak * STREAK_BONUS, MAX_STREAK_BONUS)
```

#### Game Settings

```typescript
DEFAULT_TIME_LIMIT = 20;      // Seconds per question
COUNTDOWN_DURATION = 3;       // 3-2-1 countdown
REVEAL_DURATION = 5000;       // 5 seconds to show answer
LEADERBOARD_DURATION = 8000;  // 8 seconds for leaderboard
MAX_PLAYERS = 50;
MIN_PLAYERS = 2;
```

---

## Data Structures

### Redis Key Patterns

```
# Rooms
room:{roomCode}                    → Hash (room config)
room:{roomCode}:players            → Hash (player data)
room:{roomCode}:game               → Hash (game state)
room:{roomCode}:questions          → List (question array)
room:{roomCode}:answers            → Hash (player answers)

# Sessions
session:{deviceId}                 → Hash (TV device session)
session:{socketId}                 → String (socket to device mapping)

# Auth
auth:tv-login:{token}              → Hash (pending TV login)
user:{userId}                      → Hash (user data)
user:{userId}:topics               → List (user's custom topics)

# Topics
topic:{topicId}                    → Hash (topic data)
topic:{topicId}:questions          → List (topic questions)
```

### Room Object

```typescript
interface Room {
    code: string;
    hostDeviceId: string;
    hostSocketId: string;
    hostName: string;
    createdAt: string;
    status: 'waiting' | 'playing' | 'finished';
    settings: {
        questionCount: number;
        timeLimit: number;
        category: string;
        isCustomTopic: boolean;
        topicId?: string;
    };
}
```

### Custom Topic Object

```typescript
interface CustomTopic {
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
    roomCode: string;       // Room-scoped topics
}
```

---

## Socket Events Specification

### Namespace Structure

```
/                   → Main namespace (game events)
```

### Connection Query Parameters

```typescript
// TV connects with:
{ deviceId: string, type: 'tv' }

// Mobile connects with:
{ userId?: string, type: 'player' }

// Auth socket (for QR login):
{ deviceId: string, type: 'tv-auth' }
```

---

### Room Events

#### `room:create` (Mobile/TV → Server)

Create a new game room.

```typescript
// Emit
socket.emit('room:create', {
    hostName: string;
    deviceId: string;
});

// Response
socket.on('room:created', {
    roomCode: string;
    room: Room;
});

// Error
socket.on('error', { message: string; code: 'ROOM_CREATE_FAILED' });
```

#### `room:join` (Mobile/TV → Server)

Join an existing room.

```typescript
// Emit
socket.emit('room:join', {
    roomCode: string;
    type: 'tv' | 'player';
    player?: {
        name: string;
        avatar: string;
        jingleId?: string;
    };
});

// Response (to joiner)
socket.on('room:joined', {
    room: Room;
    players: Player[];
    gameState?: GameState;
});

// Broadcast (to room)
socket.on('player:joined', {
    player: Player;
    playerCount: number;
});

// Error
socket.on('error', { 
    message: string; 
    code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_IN_PROGRESS' 
});
```

#### `room:leave` (Mobile/TV → Server)

Leave a room.

```typescript
// Emit
socket.emit('room:leave', { roomCode: string });

// Broadcast (to room)
socket.on('player:left', {
    playerId: string;
    playerCount: number;
});
```

---

### Game Events

#### `game:start` (TV → Server)

Start the game from lobby.

```typescript
// Emit
socket.emit('game:start', { roomCode: string });

// Broadcast (to room)
socket.on('game:starting', {
    countdown: number;  // 3
});

socket.on('game:countdown', {
    count: number;  // 3, 2, 1, 0
});

socket.on('game:started', {
    gameState: GameState;
});

// Error
socket.on('error', { 
    message: string; 
    code: 'NOT_ENOUGH_PLAYERS' | 'NOT_HOST' | 'QUESTIONS_NOT_READY' 
});
```

#### `game:state` (Server → TV/Mobile)

Full game state sync (sent periodically or on reconnect).

```typescript
socket.on('game:state', {
    gameState: GameState;
});
```

#### `game:phase` (Server → TV/Mobile)

Phase transition notification.

```typescript
socket.on('game:phase', {
    phase: GamePhase;
    data?: {
        // Phase-specific data
        question?: Question;           // For 'question' phase
        correctAnswer?: AnswerOption;  // For 'reveal' phase
        distribution?: Record<AnswerOption, number>;
        winner?: Player;               // For 'winner-jingle' phase
        leaderboard?: LeaderboardEntry[];  // For 'leaderboard' phase
        finalResults?: LeaderboardEntry[]; // For 'final-results' phase
    };
});
```

---

### Question & Answer Events

#### `question:show` (Server → TV/Mobile)

New question starts.

```typescript
socket.on('question:show', {
    question: Question;       // Without correctAnswer for mobile
    questionIndex: number;
    totalQuestions: number;
    timeLimit: number;
});
```

#### `timer:tick` (Server → TV/Mobile)

Server-authoritative timer sync.

```typescript
socket.on('timer:tick', {
    timeRemaining: number;
});
```

#### `timer:end` (Server → TV/Mobile)

Timer finished.

```typescript
socket.on('timer:end', {});
```

#### `answer:submit` (Mobile → Server)

Player submits an answer.

```typescript
// Emit
socket.emit('answer:submit', {
    roomCode: string;
    answer: 'A' | 'B' | 'C' | 'D';
    timestamp: number;  // Client timestamp for latency calc
});

// Response (to player)
socket.on('answer:received', {
    success: true;
    answerTime: number;  // Server-calculated time
});

// Broadcast (to TV only)
socket.on('player:answered', {
    playerId: string;
    answeredCount: number;
    totalPlayers: number;
});

// Error
socket.on('error', { 
    message: string; 
    code: 'ALREADY_ANSWERED' | 'TIME_EXPIRED' | 'INVALID_ANSWER' 
});
```

#### `answers:reveal` (Server → TV/Mobile)

Show correct answer and results.

```typescript
socket.on('answers:reveal', {
    correctAnswer: 'A' | 'B' | 'C' | 'D';
    distribution: Record<AnswerOption, number>;
    players: Player[];  // Updated with lastAnswerCorrect, score
    winner: Player | null;  // Fastest correct answer
});
```

---

### Quiz Generation Events

#### `quiz:generate` (TV → Server)

Generate quiz questions using AI.

```typescript
// Emit
socket.emit('quiz:generate', {
    roomCode: string;
    category: string;
    questionCount: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
    isCustomTopic?: boolean;
    topicId?: string;
});

// Progress updates
socket.on('quiz:generating', {
    progress: number;  // 0-100
    message: string;
});

// Success
socket.on('quiz:ready', {
    questionCount: number;
    category: string;
});

// Error
socket.on('error', { 
    message: string; 
    code: 'QUIZ_GENERATION_FAILED' | 'INVALID_CATEGORY' 
});
```

---

### Topic Events

#### `topic:subscribe` (TV → Server)

Subscribe to room's custom topics.

```typescript
socket.emit('topic:subscribe', { roomCode: string });
```

#### `topic:create` (Mobile → Server)

Create a custom topic.

```typescript
// Emit
socket.emit('topic:create', {
    roomCode: string;
    name: string;
    description: string;
    icon: string;
    questions: Question[];
});

// Broadcast (to room)
socket.on('topic:created', {
    topic: CustomTopic;
});
```

#### `topic:delete` (Mobile → Server)

Delete a custom topic.

```typescript
// Emit
socket.emit('topic:delete', {
    roomCode: string;
    topicId: string;
});

// Broadcast (to room)
socket.on('topic:deleted', {
    topicId: string;
});
```

#### `topic:list` (Server → TV)

Full topic list (on subscribe or reconnect).

```typescript
socket.on('topic:list', {
    topics: CustomTopic[];
});
```

---

### Auth Events (QR Login Flow)

#### `auth:register-tv` (TV → Server)

Register TV for QR login.

```typescript
socket.emit('auth:register-tv', {
    loginToken: string;
    deviceId: string;
});
```

#### `auth:unregister-tv` (TV → Server)

Cancel login flow.

```typescript
socket.emit('auth:unregister-tv', {
    loginToken: string;
});
```

#### `auth:tv-login` (Mobile → Server via HTTP)

Mobile scans QR and authenticates.

```http
POST /auth/tv-login
{
    "token": "tv-abc123",
    "user": {
        "id": "user-123",
        "name": "Alex",
        "avatar": "🦊",
        "email": "alex@example.com"
    }
}
```

#### `auth:logged-in` (Server → TV)

TV receives successful login.

```typescript
socket.on('auth:logged-in', {
    user: {
        id: string;
        name: string;
        avatar: string;
        email?: string;
    };
    topics: UserTopic[];
});
```

#### `user:subscribe-topics` (TV → Server)

Subscribe to logged-in user's topics.

```typescript
socket.emit('user:subscribe-topics', { userId: string });
```

#### `user:topic:created` (Server → TV)

Real-time update when user creates topic on mobile.

```typescript
socket.on('user:topic:created', {
    topic: UserTopic;
});
```

#### `user:topic:deleted` (Server → TV)

Real-time update when user deletes topic.

```typescript
socket.on('user:topic:deleted', {
    topicId: string;
});
```

---

## API Endpoints

### Health Check

```http
GET /health
→ { status: 'ok', timestamp: string }
```

### Room Management

```http
# Create room (alternative to socket)
POST /rooms
{ hostName: string, deviceId: string }
→ { roomCode: string, room: Room }

# Get room info
GET /rooms/:roomCode
→ { room: Room, players: Player[] }

# Check room exists
HEAD /rooms/:roomCode
→ 200 OK | 404 Not Found
```

### Auth

```http
# TV Login via QR (called by mobile after scan)
POST /auth/tv-login
{ token: string, user: AuthUser }
→ { success: true }

# Verify JWT token
POST /auth/verify
{ token: string }
→ { valid: boolean, user?: AuthUser }
```

### Quiz

```http
# Generate quiz (fallback if socket times out)
POST /quiz/generate
{ category: string, count: number, difficulty?: string }
→ { questions: Question[] }
```

---

## Game Flow State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GAME STATE MACHINE                          │
└─────────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │  IDLE    │  (No room created)
    └────┬─────┘
         │ room:create
         ▼
    ┌──────────┐     room:join (players)
    │  LOBBY   │◄────────────────────────
    └────┬─────┘
         │ game:start (min 2 players + questions ready)
         ▼
    ┌──────────┐
    │ STARTING │  (3-2-1 countdown)
    └────┬─────┘
         │ countdown = 0
         ▼
    ┌──────────┐
    │ QUESTION │  (Show question, start timer)
    └────┬─────┘
         │ timer = 0 OR all answered
         ▼
    ┌──────────┐
    │  REVEAL  │  (Show correct answer, distribution)
    └────┬─────┘
         │ 5 seconds
         ▼
    ┌──────────────┐
    │ WINNER_JINGLE│  (Play fastest answerer's jingle)
    └────┬─────────┘
         │ jingle duration (3s)
         ▼
    ┌─────────────┐
    │ LEADERBOARD │  (Show current standings)
    └─────┬───────┘
          │ 8 seconds
          │
     ┌────┴────┐
     │ Is last │
     │question?│
     └────┬────┘
          │
    ┌─────┴─────┐         ┌──────────────┐
    │    NO     │         │     YES      │
    └─────┬─────┘         └──────┬───────┘
          │                      │
          ▼                      ▼
    ┌──────────┐         ┌──────────────┐
    │ QUESTION │         │ FINAL_RESULTS│
    │ (next)   │         └──────┬───────┘
    └──────────┘                │
                                │ "New Game" pressed
                                ▼
                          ┌──────────┐
                          │  LOBBY   │
                          └──────────┘
```

---

## Edge Cases & Error Handling

### Connection Issues

| Scenario | Handling |
|----------|----------|
| TV disconnects mid-game | Pause game, wait 30s for reconnect, then end game |
| Player disconnects mid-question | Mark as "disconnected", keep in game, skip their answer |
| Player reconnects | Restore their state, send current game state |
| All players disconnect | End game, notify TV |
| Network latency spike | Server-authoritative timer, client shows interpolated time |

### Game Logic Edge Cases

| Scenario | Handling |
|----------|----------|
| Player answers after time expires | Reject with `TIME_EXPIRED` error |
| Player tries to answer twice | Reject with `ALREADY_ANSWERED` error |
| Two players have same answer time | First received by server wins |
| No one answers correctly | No winner jingle, skip to leaderboard |
| Player joins mid-game | Reject with `GAME_IN_PROGRESS` error |
| Host tries to start with 1 player | Reject with `NOT_ENOUGH_PLAYERS` error |
| Quiz generation fails | Retry once, then error with fallback questions |

### Room Management Edge Cases

| Scenario | Handling |
|----------|----------|
| Room code collision | Regenerate code (extremely rare with 6 chars) |
| Room expires (no activity) | Auto-delete after 2 hours |
| Max players reached (50) | Reject new joins with `ROOM_FULL` error |
| Invalid room code format | Reject with `INVALID_ROOM_CODE` error |
| Host leaves in lobby | Transfer host to first player or close room |

### Auth Edge Cases

| Scenario | Handling |
|----------|----------|
| QR token expires | 5 minute TTL, regenerate if expired |
| Same token scanned twice | Ignore second scan |
| User logs in on different TV | Log out from previous TV |
| Invalid token format | Reject with `INVALID_TOKEN` error |

### Data Validation

| Field | Validation |
|-------|------------|
| `roomCode` | 6 uppercase alphanumeric characters |
| `playerName` | 1-20 characters, no special chars |
| `avatar` | Must be from predefined list |
| `jingleId` | Must be from predefined list |
| `answer` | Must be 'A', 'B', 'C', or 'D' |
| `category` | Must be from predefined list or valid topicId |

---

## Implementation Progress

### Phase 1: Core Infrastructure ⬜

- [ ] Project setup (package.json, tsconfig, etc.)
- [ ] Express server with Socket.io
- [ ] Redis connection
- [ ] Environment configuration
- [ ] Basic health check endpoint
- [ ] Logging setup (pino)
- [ ] Error handling middleware

### Phase 2: Room Management ⬜

- [ ] Room creation with code generation
- [ ] Room joining (TV and players)
- [ ] Room leaving
- [ ] Player list management
- [ ] Room expiration (2h TTL)
- [ ] Room state persistence in Redis

### Phase 3: Auth System ⬜

- [ ] QR login token generation
- [ ] TV registration for login
- [ ] Mobile login endpoint
- [ ] Token-to-TV routing
- [ ] User session management
- [ ] JWT token handling

### Phase 4: Game Flow ⬜

- [ ] Game start with countdown
- [ ] Server-authoritative timer
- [ ] Question distribution
- [ ] Answer submission & validation
- [ ] Answer reveal with distribution
- [ ] Score calculation
- [ ] Winner determination
- [ ] Phase transitions
- [ ] Game completion

### Phase 5: Quiz Generation ⬜

- [ ] OpenAI integration
- [ ] Category-based generation
- [ ] Custom topic support
- [ ] Question caching
- [ ] Fallback questions

### Phase 6: Topics System ⬜

- [ ] Room-scoped topics
- [ ] User-scoped topics
- [ ] Topic CRUD operations
- [ ] Real-time topic sync

### Phase 7: Polish & Deploy ⬜

- [ ] Reconnection handling
- [ ] Rate limiting
- [ ] Input sanitization
- [ ] Load testing
- [ ] Railway deployment
- [ ] Monitoring setup

---

## File Structure

```
backend/
├── src/
│   ├── index.ts                 # Entry point
│   ├── app.ts                   # Express app setup
│   ├── socket.ts                # Socket.io setup
│   │
│   ├── config/
│   │   ├── index.ts             # Config loader
│   │   ├── redis.ts             # Redis connection
│   │   └── openai.ts            # OpenAI client
│   │
│   ├── handlers/                # Socket event handlers
│   │   ├── index.ts
│   │   ├── roomHandler.ts       # room:* events
│   │   ├── gameHandler.ts       # game:* events
│   │   ├── quizHandler.ts       # quiz:*, answer:* events
│   │   ├── topicHandler.ts      # topic:* events
│   │   └── authHandler.ts       # auth:* events
│   │
│   ├── services/                # Business logic
│   │   ├── index.ts
│   │   ├── roomService.ts       # Room CRUD
│   │   ├── gameService.ts       # Game state machine
│   │   ├── quizService.ts       # Quiz generation
│   │   ├── scoreService.ts      # Score calculation
│   │   ├── timerService.ts      # Server-authoritative timer
│   │   └── authService.ts       # Auth logic
│   │
│   ├── routes/                  # HTTP routes
│   │   ├── index.ts
│   │   ├── health.ts
│   │   ├── rooms.ts
│   │   ├── auth.ts
│   │   └── quiz.ts
│   │
│   ├── types/                   # TypeScript types
│   │   ├── index.ts
│   │   ├── game.ts
│   │   ├── room.ts
│   │   ├── player.ts
│   │   ├── question.ts
│   │   └── socket.ts
│   │
│   ├── utils/
│   │   ├── index.ts
│   │   ├── roomCode.ts          # Code generation
│   │   ├── validation.ts        # Input validation
│   │   ├── avatars.ts           # Avatar pool
│   │   └── constants.ts         # Game constants
│   │
│   └── middleware/
│       ├── index.ts
│       ├── errorHandler.ts
│       ├── rateLimiter.ts
│       └── socketAuth.ts
│
├── package.json
├── tsconfig.json
├── .env.example
├── Dockerfile
├── railway.json
├── IMPLEMENTATION.md            # This file
└── README.md
```

---

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-jwt-secret-here

# OpenAI
OPENAI_API_KEY=sk-...

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Game Settings (optional overrides)
MAX_PLAYERS=50
ROOM_EXPIRY_HOURS=2
QR_TOKEN_EXPIRY_MINUTES=5
```

---

## Next Steps

1. **Initialize project** - Create package.json and install dependencies
2. **Setup TypeScript** - Configure tsconfig.json
3. **Create entry point** - Basic Express + Socket.io server
4. **Redis connection** - Connect to Redis with error handling
5. **Room handlers** - Implement room:create, room:join, room:leave

---

> **Note:** This document will be updated as implementation progresses. Check the Progress section for current status.
