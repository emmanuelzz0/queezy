# Railway Deployment Guide

This backend is configured for deployment on Railway (https://railway.app).

## Prerequisites

1. A Railway account.
2. A GitHub repository with this code.

## Deployment Steps

1. **New Project**: Create a new project on Railway.
2. **Database**: Add a PostgreSQL database service to your project.
3. **Redis**: Add a Redis service to your project.
4. **Backend Service**:
   - Add a GitHub Repo service and select this repository (specifically the `backend` folder as the root directory usually, or configure the Root Directory in Railway settings to `backend`).
   - If deploying as a monorepo, in the Service Settings > General > Root Directory, set it to `/backend`.

## Environment Variables

Configure the following variables in your Backend Service settings:

| Variable | Description | Example / Note |
|----------|-------------|----------------|
| `DATABASE_URL` | Connection string for Postgres | Use `${{Postgres.DATABASE_URL}}` to auto-link |
| `REDIS_URL` | Connection string for Redis | Use `${{Redis.REDIS_URL}}` to auto-link or `redis://...` |
| `JWT_SECRET` | Secret key for signing tokens | Generate a long random string (min 32 chars) |
| `ANTHROPIC_API_KEY` | API Key for Claude AI | Start with `sk-ant-...` |
| `CORS_ORIGINS` | Allowed frontend URLs | `https://your-app.vercel.app,https://your-tv-app.vercel.app` |
| `NODE_ENV` | Environment mode | Set to `production` |
| `PORT` | Port to listen on | Railway sets this automatically (usually `PORT`) |

## Build & Start

Railway will automatically detect the `package.json`.
- **Build Command**: `npm run build` (runs `tsc`)
- **Start Command**: `npm start` (runs `node dist/index.js`)
- **Post Install**: `npm run postinstall` (runs `prisma generate`) will run automatically after install.

## WebSockets

This backend uses Socket.io. Railway supports WebSockets automatically over the standard HTTP/HTTPS ports. Ensure your frontend connects to the Railway URL (e.g., `https://your-backend.up.railway.app`).

**Note**: Do not append a port number in your frontend socket connection string when connecting to the production HTTPS URL.
