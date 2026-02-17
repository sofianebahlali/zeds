# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quizz Arena — a real-time multiplayer quiz game built with Next.js 14 (App Router) + Express + Socket.IO. Full-stack TypeScript monorepo (~3K LOC). Supports 5 game modes: QCM (multiple choice), Open (free text), Dictation (French audio transcription), Image (identification), and Estimation ("Juste Prix" proportional scoring).

## Commands

```bash
# Development (runs both frontend and backend concurrently)
npm run dev

# Individual processes
npm run dev:frontend   # Next.js on :3000
npm run dev:backend    # Express+Socket.IO on :3001 (tsx watch, auto-reload)

# Build
npm run build:all      # Next.js build + server TypeScript compilation

# Production (single-port mode, serves Next.js + Socket.IO on :3000)
npm run start:prod     # node dist/server/production.js

# Docker
docker build -t quizz-arena .
docker run -p 3000:3000 quizz-arena
```

No test framework is currently configured.

## Architecture

### Two-Server Model
- **Dev**: Frontend (Next.js :3000) and backend (Express+Socket.IO :3001) run separately via `concurrently`
- **Production**: Single Express server on :3000 serves both Next.js and Socket.IO (`server/production.ts`)
- Socket URL auto-detection handles local, GitHub Codespaces (`*.app.github.dev`), and production environments (`src/lib/socket.ts`)

### Frontend — State-Based Routing (No file-based routes)
The app has a single page (`src/app/page.tsx`) that renders screens based on `uiStore.currentScreen`. There is no Next.js routing — all navigation is state-driven through Zustand stores.

### Zustand Stores (`src/stores/`)
Four stores manage all client state:
- **playerStore** — Player profile, persisted to localStorage (playerId, name, avatar)
- **roomStore** — Room object, player list, settings
- **gameStore** — Game progression: status, current question, time remaining, answers
- **uiStore** — Screen navigation, loading states, notifications, connection status

### Server (`server/`)
- **room-manager.ts** — Room lifecycle, player tracking, socket↔player mapping. Rooms use 4-char alphanumeric codes.
- **socket-handlers.ts** — All Socket.IO event handlers (room:create, game:start, etc.)
- **game-engine.ts** — Per-room game logic: question loading from `data/questions/` JSON files with in-code fallbacks, timer management (1s intervals), answer validation, scoring (base + speed bonus + streak bonus). Dictation uses word-level LCS with 85% threshold. Estimation uses proportional scoring within 15% tolerance.

### TypeScript Configuration
- Frontend: `tsconfig.json` — ES2020, strict, path alias `@/*` → `./src/*`
- Server: `tsconfig.server.json` — CommonJS output to `dist/`

### Styling
Tailwind CSS with custom design tokens in `tailwind.config.ts`:
- Custom color palettes: brand (orange/coral), accent (amber), surface (gray/taupe)
- Mobile-first: `touch` = 44px tap targets, `safe-bottom` = `env(safe-area-inset-bottom)`
- Fonts: DM Sans (sans), Fraunces (display/serif)
- UI components in `src/components/ui/` are shadcn/ui-based with Radix UI primitives

### Socket.IO Events
Typed in `src/types/index.ts` as `ServerToClientEvents` and `ClientToServerEvents`. Key flow:
```
room:create → room:joined → room:ready → game:start → game:starting (countdown)
→ game:round_start → game:submit_answer → game:round_end → game:leaderboard
→ ... (repeat rounds) → game:finished
```

## Key Files

| File | Purpose |
|------|---------|
| `src/types/index.ts` | All shared TypeScript types (Player, Room, Question variants, Socket events) |
| `src/app/page.tsx` | App entry — state-based screen routing |
| `src/hooks/use-socket.ts` | Socket.IO connection setup and event listener binding |
| `src/lib/socket.ts` | Socket.IO client singleton and URL detection |
| `server/game-engine.ts` | Core game logic and scoring (~760 LOC, largest file) |
| `server/socket-handlers.ts` | Socket event handlers |
| `server/room-manager.ts` | Room and player management |
| `data/questions/*.json` | Question banks loaded by game engine |
