# Queezy Backend

Real-time multiplayer quiz game backend with Socket.io, Claude AI, and Admin Dashboard.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Anthropic API Key

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/queezy

# Redis
REDIS_URL=redis://localhost:6379

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Admin (for initial seed)
ADMIN_EMAIL=admin@queezy.app
ADMIN_PASSWORD=AdminPassword123!
```

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Initial data seeder
├── src/
│   ├── config/            # Configuration
│   │   ├── index.ts       # Main config loader
│   │   ├── claude.ts      # Claude AI client
│   │   ├── database.ts    # Prisma client
│   │   └── redis.ts       # Redis client
│   ├── handlers/          # Socket.io event handlers
│   │   ├── roomHandler.ts
│   │   ├── gameHandler.ts
│   │   ├── quizHandler.ts
│   │   └── answerHandler.ts
│   ├── middleware/        # Express middleware
│   │   └── adminAuth.ts   # JWT authentication
│   ├── routes/            # REST API routes
│   │   ├── health.ts      # Health check
│   │   ├── auth.ts        # Mobile auth
│   │   └── admin/         # Admin dashboard API
│   ├── services/          # Business logic
│   │   ├── roomService.ts
│   │   ├── gameService.ts
│   │   ├── quizService.ts
│   │   └── scoreService.ts
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilities
│   ├── app.ts             # Express app
│   ├── socket.ts          # Socket.io setup
│   └── index.ts           # Entry point
└── package.json
```

## 🔌 Socket.io Events

### Room Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `room:create` | Client → Server | TV creates a room |
| `room:join` | Client → Server | Player joins room |
| `room:leave` | Client → Server | Player leaves room |
| `room:player-joined` | Server → Client | Player joined notification |
| `room:player-left` | Server → Client | Player left notification |

### Game Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `game:start` | Client → Server | Host starts game |
| `game:question` | Server → Client | New question |
| `game:reveal` | Server → Client | Answer reveal |
| `game:leaderboard` | Server → Client | Updated standings |
| `game:finished` | Server → Client | Game complete |

### Quiz Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `quiz:generate` | Client → Server | Generate questions with AI |
| `quiz:generated` | Server → Client | Questions ready |
| `answer:submit` | Client → Server | Player submits answer |
| `answer:received` | Server → Client | Answer confirmation |

## 🔐 Admin API

Base URL: `/api/admin`

### Authentication

- `POST /auth/login` - Admin login
- `POST /auth/verify` - Verify JWT token

### Jingles

- `GET /jingles` - List all jingles
- `GET /jingles/:id` - Get jingle
- `POST /jingles` - Create jingle (with file upload)
- `PUT /jingles/:id` - Update jingle
- `DELETE /jingles/:id` - Delete jingle

### Categories

- `GET /categories` - List categories
- `GET /categories/:id` - Get category
- `POST /categories` - Create category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

### Questions

- `GET /questions` - List questions (paginated)
- `GET /questions/:id` - Get question
- `POST /questions` - Create question
- `POST /questions/bulk` - Bulk create questions
- `PUT /questions/:id` - Update question
- `DELETE /questions/:id` - Delete question

### Users

- `GET /users` - List users (paginated)
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

### Settings

- `GET /settings` - Get all settings
- `PUT /settings/:key` - Update setting
- `DELETE /settings/:key` - Reset to default

### Stats

- `GET /stats/overview` - Dashboard stats
- `GET /stats/games` - Game statistics
- `GET /stats/questions` - Question statistics
- `GET /stats/users` - User statistics

## 🤖 Claude AI Integration

Quiz questions are generated using the Anthropic Claude API (claude-sonnet-4-20250514).

The system prompt ensures:
- Questions are educational and interesting
- 4 multiple choice options (A, B, C, D)
- One correct answer clearly indicated
- Appropriate difficulty levels
- No repetitive or similar questions

## 📊 Scoring System

- **Base Points**: 1000 for correct answer
- **Time Bonus**: Up to 500 extra points for faster answers
- **Streak Bonus**: +100 per consecutive correct answer (max +500)

```
Total = BasePoints + TimeBonus + StreakBonus
```

## 🚢 Deployment

### Railway

1. Create PostgreSQL and Redis services
2. Add environment variables
3. Deploy from GitHub
4. Run migrations: `npm run db:push`
5. Seed data: `npm run db:seed`

### Docker (Coming Soon)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "4000:4000"
    depends_on:
      - postgres
      - redis
```

## 📝 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run db:push` | Push schema changes |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |

## 🔧 Configuration

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for full implementation details.
