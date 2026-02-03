# CLAUDE.md - AI Assistant Guide for Quizz Arena

## Project Overview

Quizz Arena is a real-time multiplayer quiz game (inspired by popsauce/jklm.fun) built with Next.js and Socket.IO. Players create or join rooms, compete in various quiz modes, and see live leaderboards.

**Language**: The application UI is in French ("fr" locale).

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS with custom design system + shadcn-ui patterns
- **Animations**: Framer Motion
- **State**: Zustand with localStorage persistence
- **Real-time**: Socket.IO Client

### Backend
- **Runtime**: Node.js with Express
- **Real-time**: Socket.IO Server
- **Architecture**: Room-based with server authority

## Quick Commands

```bash
# Install dependencies
npm install

# Development (frontend + backend concurrently)
npm run dev

# Frontend only (port 3000)
npm run dev:frontend

# Backend only (port 3001)
npm run dev:backend

# Production build
npm run build

# Lint
npm run lint
```

## Project Structure

```
zeds/
├── server/                     # Backend Node.js
│   ├── index.ts               # Server entry point, Express + Socket.IO setup
│   ├── room-manager.ts        # Room CRUD, player management, scoring
│   ├── socket-handlers.ts     # Socket.IO event handlers
│   └── game-engine.ts         # Game logic, questions, scoring calculations
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout (French locale, dark mode)
│   │   ├── page.tsx           # Main page (screen routing via state)
│   │   └── globals.css        # Global styles + Tailwind
│   │
│   ├── components/
│   │   ├── ui/                # Reusable UI components (button, input, card, etc.)
│   │   └── layout/            # Layout components (notifications, loading)
│   │
│   ├── features/              # Screen components organized by feature
│   │   ├── home/              # Home screen
│   │   ├── room/              # Create/Join room screens
│   │   ├── lobby/             # Waiting room before game starts
│   │   ├── game/              # Active game screen with questions
│   │   ├── scoreboard/        # Final results screen
│   │   └── error/             # Error and reconnection screens
│   │
│   ├── stores/                # Zustand state stores
│   │   ├── player-store.ts    # Player data (persisted)
│   │   ├── room-store.ts      # Current room state
│   │   ├── game-store.ts      # Game state (questions, answers, timer)
│   │   └── ui-store.ts        # UI state (screen, loading, errors)
│   │
│   ├── hooks/
│   │   └── use-socket.ts      # Socket.IO hook with all event handlers
│   │
│   ├── lib/
│   │   ├── socket.ts          # Socket.IO client singleton
│   │   └── utils.ts           # Utility functions (cn, generateCode)
│   │
│   └── types/
│       └── index.ts           # All TypeScript types (shared with server)
│
├── public/
│   └── manifest.json          # PWA manifest
│
└── Configuration files
    ├── tailwind.config.ts     # Custom theme with brand colors
    ├── tsconfig.json          # TypeScript config with @/* path alias
    └── next.config.js         # Next.js configuration
```

## Key Architecture Patterns

### 1. Screen-based Routing (No URL routing)
The app uses state-based routing via `useUIStore.currentScreen`. Screens are: `home`, `create`, `join`, `lobby`, `game`, `scoreboard`, `error`, `reconnecting`.

```typescript
// Changing screens
const setScreen = useUIStore((s) => s.setScreen);
setScreen("lobby");
```

### 2. Zustand Stores
Four separate stores handle different concerns:
- **playerStore**: Player identity (name, avatar, playerId) - persisted to localStorage
- **roomStore**: Current room state (players, settings, code)
- **gameStore**: Game state (current question, timer, answers, results)
- **uiStore**: UI state (screen, loading, errors, notifications)

### 3. Socket.IO Event Flow
All socket events are handled in `src/hooks/use-socket.ts`. The hook:
- Connects/disconnects the socket
- Listens to server events and updates stores
- Provides action functions (createRoom, joinRoom, submitAnswer, etc.)

### 4. Server Authority
The server (`server/game-engine.ts`) controls:
- Question selection and timing
- Answer validation (automatic for QCM, peer-voting for open questions)
- Voting phase management for non-QCM questions
- Score calculation with speed bonuses
- Round progression

### 5. Peer Voting System
For non-QCM questions (open, image, dictation), answers are validated by peer voting:
- After answer submission, a 15-second voting phase begins
- Each player sees all submitted answers and the expected correct answer
- Players vote to validate or refuse each answer (except their own)
- An answer is validated if it receives a strict majority (>50%) of "valid" votes
- If votes are tied (50/50), the answer is refused
- Points are awarded only to validated answers

## Socket.IO Events

### Client → Server
| Event | Parameters | Description |
|-------|------------|-------------|
| `room:create` | playerName, avatar | Create a new room |
| `room:join` | roomCode, playerName, avatar | Join existing room |
| `room:leave` | - | Leave current room |
| `room:ready` | isReady | Toggle ready status |
| `game:start` | - | Host starts the game |
| `game:submit_answer` | answer | Submit answer for current question |
| `game:submit_vote` | targetPlayerId, isValid | Vote on a player's answer |

### Server → Client
| Event | Parameters | Description |
|-------|------------|-------------|
| `room:joined` | room, player | Successfully joined room |
| `room:player_joined` | player | Another player joined |
| `game:starting` | countdown | Game countdown (3, 2, 1) |
| `game:round_start` | round, question | New question started |
| `game:time_update` | timeRemaining | Timer tick |
| `game:voting_start` | VotingPhaseData | Voting phase begins (non-QCM) |
| `game:voting_time_update` | timeRemaining | Voting timer tick |
| `game:player_voted` | voterId, targetPlayerId | A player cast a vote |
| `game:voting_end` | VotingResults | Voting phase ended with results |
| `game:round_end` | result | Round results with scores |
| `game:finished` | finalScores | Game ended |

## Game Modes

| Mode | Type | Validation | Description |
|------|------|------------|-------------|
| `qcm` | Multiple Choice | Automatic | 4 options, select correct one |
| `open` | Free Text | Peer voting | Type the answer, validated by other players |
| `image` | Image Guess | Peer voting | Identify what's in the image (not yet implemented) |
| `dictation` | Audio | Peer voting | Write what you hear (not yet implemented) |

## Design System

### Colors (Tailwind)
- `brand-*`: Primary blue (#0ea5e9)
- `accent-*`: Purple accent (#d946ef)
- `success-*`: Green (#22c55e)
- `warning-*`: Orange (#f59e0b)
- `danger-*`: Red (#ef4444)
- `surface-*`: Neutral grays

### Mobile-First Guidelines
- Minimum touch target: 44px (`touch` spacing)
- No horizontal scroll
- Readable text without zoom (min 16px)
- Support for iOS safe areas
- Visual feedback on interactions

## Environment Variables

```bash
# .env or .env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001  # Socket server URL
PORT=3001                                       # Backend port
FRONTEND_URL=http://localhost:3000              # CORS origin
```

## Code Conventions

### TypeScript
- Strict mode enabled
- Shared types in `src/types/index.ts`
- Path alias `@/*` maps to `./src/*`

### Components
- Feature screens in `src/features/[feature]/`
- Reusable UI in `src/components/ui/`
- Use Framer Motion for animations
- Export via index.ts barrels

### State Updates
- Always use store actions, not direct mutations
- Access state via selectors: `useStore((s) => s.value)`
- For actions that need current state: `useStore.getState()`

### Socket Events
- All listeners in `use-socket.ts`
- Actions return from the hook
- Update stores in response to server events

## Common Tasks

### Adding a New Screen
1. Create component in `src/features/[feature]/`
2. Export from feature's `index.ts`
3. Add to `Screen` type in `src/types/index.ts`
4. Add case in `src/app/page.tsx`

### Adding a New Socket Event
1. Add types to `ServerToClientEvents` or `ClientToServerEvents` in `src/types/index.ts`
2. Add handler in `src/hooks/use-socket.ts`
3. Add server handler in `server/socket-handlers.ts`

### Adding a New Question Type
1. Add interface extending `BaseQuestion` in `src/types/index.ts`
2. Add to `Question` union type
3. Update `checkAnswer()` in `server/game-engine.ts`
4. Update `QuestionDisplay` component to render new type

## Testing

Currently no test setup. When adding tests:
- Use Jest + React Testing Library for components
- Mock Socket.IO connections
- Test stores independently

## Debugging

### Server logs
The server logs room creation, player joins/leaves, and disconnections to console.

### Health endpoint
```bash
curl http://localhost:3001/health
# Returns: { status: "ok", rooms: N, players: M }
```

### Room info endpoint
```bash
curl http://localhost:3001/api/rooms/ABCD
# Returns room info or 404
```

## Important Notes

1. **Room codes**: 4 uppercase letters/numbers, excludes ambiguous chars (O, 0, I, 1, L)
2. **Reconnection**: 30-second window for disconnected players to reconnect
3. **Inactive rooms**: Cleaned up after 1 hour if still in "waiting" status
4. **Minimum players**: Game requires at least 2 players to start
5. **Host transfer**: If host leaves, first remaining player becomes host
6. **Voting rules**: Players cannot vote on their own answers; strict majority (>50%) required to validate
7. **Voting time**: 15 seconds for the voting phase on non-QCM questions
