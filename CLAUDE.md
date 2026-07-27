# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quizz Arena — a real-time multiplayer quiz game built with Next.js 14 (App Router) + Express + Socket.IO. Full-stack TypeScript monorepo. The playable modes are declared in `GAME_MODES` (`src/types/index.ts`) across four categories — Culture G / Maths, Géographie, Pokémon and Foot / FUT — and a game is a *playlist* of mode segments (see `GameSettings.playlist` and `GAME_PRESETS`).

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

# Regenerate the geography dataset (countries, flags, world map) — needs network
npm run build:countries

# Tests (Vitest)
npm test                # everything
npm run test:watch      # watch mode
npm run test:unit       # pure logic + datasets (node)
npm run test:integration # real Socket.IO server, end to end (node)
npm run test:client     # stores and React components (jsdom)
npm run test:coverage
npm run typecheck       # both tsconfigs, tests included
```

## Tests

`vitest.config.ts` declares two projects, because the code lives in two worlds:

| Project | Environment | Files | What it covers |
|---------|-------------|-------|----------------|
| `node`  | node  | `tests/unit`, `tests/integration` | server logic, datasets, and the real Socket.IO stack |
| `dom`   | jsdom | `tests/client` | Zustand stores, `src/lib`, React components |

The integration tests boot a **real** Express + Socket.IO server on an ephemeral
port (`tests/helpers/test-server.ts`) and drive it with real `socket.io-client`
sockets — room manager, game engine and socket handlers only make sense
together, so nothing in that path is mocked. Rounds are advanced with
`game:request_next_round` rather than waiting out the 8s auto-advance, and
`getGameEngine(code)` (a read-only test seam exported from `socket-handlers.ts`)
lets a test compare what the server dealt against what it sent the client.

Two notes on what tests deliberately assert:
- `tests/unit/world-map.test.ts` checks that `server/countries.ts` and
  `src/lib/world-map.ts` resolve a tap to the *same* country, across every
  capital, every city in the pool and a global grid. That equivalence is the
  contract that makes the geo modes scoreable.
- `tests/unit/game-modes.test.ts` builds a real `GameEngine` per entry in
  `GAME_MODES` and asserts it can deal a full segment — a mode whose data file
  goes missing fails there rather than in front of players.

CI (`.github/workflows/ci.yml`) runs typecheck, the three test groups, the
Next.js + server build, and finally builds the Docker image and curls `/health`
inside it.

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
- **game-engine.ts** — Per-room game logic: question loading from `data/questions/` JSON files with in-code fallbacks, timer management (1s intervals), answer validation, scoring (base + speed bonus + streak bonus). Estimation uses proportional scoring within 15% tolerance.

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
| `server/countries.ts` | Country & city pools, tap→country hit-test and answer matching for the geography modes |
| `src/lib/world-map.ts` | Client twin of the hit-test + Mercator projection for the world map |
| `src/features/game/world-map.tsx` | Pan/pinch/tap SVG world map (used in-round and at reveal) |

### Geography modes (`flag`, `capital`, `countrylocate`, `citylocate`)

`scripts/build-countries.ts` regenerates everything they need from Natural Earth + flagcdn:
`data/questions/countries.json` (197 countries: FR names, aliases, capitals, difficulty tier),
`data/questions/cities.json` (602 cities for `citylocate`), `public/geo/world-countries.json`
(simplified shapes, keyed by ISO-3) and `public/images/flags/`.
The generated files are committed — the script only needs to run when the data changes.

The map shapes are shared: `server/countries.ts` and `src/lib/world-map.ts` implement the same
point-in-polygon test with the same tolerance, so the country highlighted under the player's
finger is the one the server scores. Rounds ramp easy → medium → hard within a mode segment,
and points scale with the tier.

`citylocate` scores on distance alone (`cityProximityRatio`): full points within 75 km, decaying
to nothing at ~1275 km, with a floor for landing in the right country. Its easy tier is a curated
list of world cities (population is a poor proxy for fame); medium/hard are scored from Natural
Earth flags (world city, capital, population) plus a bonus for having a French exonym, and the
country is shown as a hint from the medium tier up.
