# Quizz Arena 🎮

Application de quiz multijoueur en temps réel, inspirée de popsauce / jklm.fun.

## Architecture

```
quizz-arena/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Layout principal
│   │   ├── page.tsx            # Page principale (routing par état)
│   │   └── globals.css         # Styles globaux + Tailwind
│   │
│   ├── components/
│   │   ├── ui/                 # Composants shadcn-ui personnalisés
│   │   │   ├── button.tsx      # Bouton avec variants et animations
│   │   │   ├── input.tsx       # Input avec variants
│   │   │   ├── card.tsx        # Cartes avec effets glass/gradient
│   │   │   ├── avatar.tsx      # Avatar avec sélecteur emoji
│   │   │   ├── badge.tsx       # Badges et StatusBadge
│   │   │   ├── progress.tsx    # Progress bar + TimerProgress
│   │   │   ├── dialog.tsx      # Modal dialog
│   │   │   ├── scroll-area.tsx # Zone de scroll personnalisée
│   │   │   └── tooltip.tsx     # Tooltips
│   │   │
│   │   ├── layout/             # Composants de layout
│   │   │   ├── screen-container.tsx
│   │   │   ├── notification-container.tsx
│   │   │   └── loading-overlay.tsx
│   │   │
│   │   └── game/               # Composants spécifiques au jeu
│   │
│   ├── features/               # Écrans par feature
│   │   ├── home/               # Écran d'accueil
│   │   ├── room/               # Création/Rejoindre room
│   │   ├── lobby/              # Salle d'attente
│   │   ├── game/               # Écran de jeu
│   │   ├── scoreboard/         # Résultats finaux
│   │   └── error/              # États d'erreur/reconnexion
│   │
│   ├── stores/                 # État global (Zustand)
│   │   ├── player-store.ts     # Données joueur (persisté)
│   │   ├── room-store.ts       # État de la room
│   │   ├── game-store.ts       # État du jeu
│   │   └── ui-store.ts         # État UI (écran, loading, erreurs)
│   │
│   ├── hooks/                  # Hooks personnalisés
│   │   └── use-socket.ts       # Hook Socket.IO
│   │
│   ├── lib/                    # Utilitaires
│   │   ├── utils.ts            # Helpers (cn, generateCode, etc.)
│   │   └── socket.ts           # Client Socket.IO
│   │
│   └── types/                  # Types TypeScript
│       └── index.ts            # Tous les types du projet
│
├── server/                     # Backend Node.js
│   ├── index.ts                # Point d'entrée serveur
│   ├── room-manager.ts         # Gestion des rooms
│   ├── socket-handlers.ts      # Handlers Socket.IO
│   └── game-engine.ts          # Logique de jeu
│
└── public/                     # Assets statiques
    └── manifest.json           # PWA manifest
```

## Stack Technique

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: shadcn-ui + Tailwind CSS (custom theme)
- **Animations**: Framer Motion
- **État**: Zustand (avec persistance localStorage)
- **Temps réel**: Socket.IO Client

### Backend
- **Runtime**: Node.js avec Express
- **Temps réel**: Socket.IO Server
- **Architecture**: Room-based avec autorité serveur

## Design System

### Couleurs
- `brand-*`: Bleu primaire (#0ea5e9)
- `accent-*`: Violet accent (#d946ef)
- `success-*`: Vert succès (#22c55e)
- `warning-*`: Orange warning (#f59e0b)
- `danger-*`: Rouge erreur (#ef4444)
- `surface-*`: Gris neutres

### Composants Mobile-First
- Tailles tactiles minimum 44px
- Zones cliquables larges
- Feedback visuel immédiat (scale, color)
- Transitions fluides (<200ms)

## Événements Socket.IO

### Client → Serveur
- `room:create` - Créer une room
- `room:join` - Rejoindre une room
- `room:leave` - Quitter
- `room:ready` - Marquer prêt
- `game:start` - Lancer la partie (host)
- `game:submit_answer` - Envoyer une réponse

### Serveur → Client
- `room:joined` - Room rejointe avec succès
- `room:player_joined` - Nouveau joueur
- `game:starting` - Countdown de début
- `game:round_start` - Nouvelle question
- `game:time_update` - Timer update
- `game:round_end` - Résultats de la manche
- `game:finished` - Fin de partie

## Lancement

```bash
# Installation
npm install

# Développement (frontend + backend)
npm run dev

# Frontend seul
npm run dev:frontend

# Backend seul
npm run dev:backend

# Build production
npm run build
```

## Modes de Jeu (Architecture)

1. **QCM** (`qcm`) - Questions à choix multiples
2. **Question ouverte** (`open`) - Réponse texte libre
3. **Image** (`image`) - Deviner l'image (à implémenter)
4. **Dictée** (`dictation`) - Audio vers texte (à implémenter)

Chaque mode implémente la même interface `Question` et réutilise les composants UI génériques.

## UX Mobile

- Interface pensée tactile d'abord
- Pas de scroll horizontal
- Texte lisible sans zoom (min 16px)
- États visibles (prêt, en attente, répondu)
- Gestion reconnexion automatique
- Support safe-area iOS
