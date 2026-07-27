import { Server, Socket } from "socket.io";
import { RoomManager } from "./room-manager";
import { GameEngine } from "./game-engine";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Player,
  GameSettings,
  GameMode,
  PetitBacValidationSubmission,
  GeoQuizValidationSubmission,
  LangueValidationSubmission,
} from "../src/types";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// Store game engines per room
const gameEngines = new Map<string, GameEngine>();

/**
 * The engine of a live room. Only used by the integration tests, which need to
 * check what the server dealt against what it sent the client — deliberately a
 * read-only lookup rather than an exported map.
 */
export function getGameEngine(roomCode: string): GameEngine | undefined {
  return gameEngines.get(roomCode);
}
// Store disconnect timeouts per player so they can be cancelled on reconnection
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * Grace period before a disconnected player is dropped from their room.
 * Mobile browsers kill the socket as soon as the app is backgrounded, so this
 * has to cover "took a phone call / answered a message", not just a page
 * refresh. Only ever applies when other players remain in the room.
 */
const DISCONNECT_GRACE_MS = 120_000;

export function setupSocketHandlers(io: TypedIO, roomManager: RoomManager) {
  io.on("connection", (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Re-attach the socket to its player *synchronously*, from the handshake,
    // before any client packet can be processed.
    //
    // Without this, a reconnecting client's buffered emits (socket.io flushes
    // its send buffer before firing "connect", so before the client can emit
    // connection:reconnect) arrive on a socket the server cannot map to a
    // player — every handler bails out at `if (!playerId) return` and the
    // actions are silently swallowed. That is what makes a room feel dead
    // after coming back from the background.
    reattachFromHandshake(socket, io, roomManager);

    // ==========================================
    // ROOM EVENTS
    // ==========================================

    socket.on("room:create", (playerName: string, avatar: string, playerId: string) => {
      try {
        // This identity now plays here — retire any other live socket using it.
        supersedeOtherSocket(socket, io, roomManager, playerId);

        // Drop out of any previous room first, otherwise the old room keeps a
        // ghost player that counts toward maxPlayers and blocks its start.
        evictFromPreviousRoom(socket, io, roomManager, playerId);

        const player: Player = {
          id: playerId,
          name: playerName.trim(),
          avatar,
          isHost: true,
          isReady: false,
          isConnected: true,
          score: 0,
          roundScore: 0,
          loseStreak: 0,
        };

        const room = roomManager.createRoom(player);
        roomManager.mapSocketToPlayer(socket.id, player.id);

        socket.join(room.code);
        socket.emit("room:joined", room, player);

        console.log(`Room created: ${room.code} by ${playerName}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create room";
        socket.emit("room:error", message);
      }
    });

    socket.on("room:join", (roomCode: string, playerName: string, avatar: string, playerId: string) => {
      try {
        const code = roomCode.toUpperCase().trim();
        const existingRoom = roomManager.getRoom(code);

        if (!existingRoom) {
          socket.emit("room:error", "Room introuvable");
          return;
        }

        supersedeOtherSocket(socket, io, roomManager, playerId);

        // Leave any previous room, unless this *is* the room we're already in
        // (a re-join after a dropped connection).
        if (roomManager.getCurrentRoomCode(playerId) !== code) {
          evictFromPreviousRoom(socket, io, roomManager, playerId);
        }

        const player: Player = {
          id: playerId,
          name: playerName.trim(),
          avatar,
          isHost: false,
          isReady: false,
          isConnected: true,
          score: 0,
          roundScore: 0,
          loseStreak: 0,
        };

        const room = roomManager.joinRoom(code, player);
        if (!room) {
          socket.emit("room:error", "Failed to join room");
          return;
        }

        roomManager.mapSocketToPlayer(socket.id, player.id);
        socket.join(room.code);
        clearDisconnectTimeout(player.id);

        // Get the actual player from room (might be reconnection)
        const actualPlayer = room.players.find((p) => p.id === player.id);

        // Re-joining a game already in progress: route the client to the game
        // screen instead of the lobby, and tell the engine we're back.
        if (room.status !== "waiting") {
          gameEngines.get(room.code)?.handlePlayerReconnect(player.id);
          socket.emit("connection:reconnected", room, actualPlayer || player);
          socket.to(room.code).emit("connection:player_reconnected", player.id);
        } else {
          socket.emit("room:joined", room, actualPlayer || player);
          socket.to(room.code).emit("room:player_joined", actualPlayer || player);
        }

        console.log(`${playerName} joined room ${code}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join room";
        socket.emit("room:error", message);
      }
    });

    socket.on("room:leave", () => {
      handlePlayerLeave(socket, io, roomManager);
    });

    socket.on("room:ready", (isReady: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const result = roomManager.setPlayerReady(playerId, isReady);
      if (!result) return;

      const { room } = result;
      io.to(room.code).emit("room:player_ready", playerId, isReady);
    });

    socket.on("room:update_settings", (settings: Partial<GameSettings>) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const updatedRoom = roomManager.updateSettings(room.code, settings);
      if (updatedRoom) {
        io.to(room.code).emit("room:settings_updated", updatedRoom.settings);
      }
    });

    socket.on("room:change_game_mode", (mode: GameMode) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      roomManager.updateGameMode(room.code, mode);
      io.to(room.code).emit("room:settings_updated", room.settings);
    });

    socket.on("room:kick_player", (targetPlayerId: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      // Resolve the victim's socket *before* kicking — kickPlayer drops the
      // socket↔player mapping we need to reach them.
      const kickedSocketId = roomManager.getSocketIdFromPlayerId(targetPlayerId);

      const kicked = roomManager.kickPlayer(room.code, targetPlayerId, playerId);
      if (!kicked) return;

      clearDisconnectTimeout(targetPlayerId);

      // Tell the kicked player *and* pull their socket out of the room, so they
      // land back on the home screen instead of sitting in a lobby where every
      // button silently does nothing. Done before the broadcast so they don't
      // also get a "X a quitté la partie" about themselves.
      const kickedSocket = kickedSocketId ? io.sockets.sockets.get(kickedSocketId) : undefined;
      if (kickedSocket) {
        kickedSocket.leave(room.code);
        kickedSocket.emit("room:kicked");
      }

      io.to(room.code).emit("room:player_left", targetPlayerId);
    });

    socket.on("room:play_again", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) {
        socket.emit("room:error", "Session expirée, veuillez vous reconnecter");
        return;
      }

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) {
        socket.emit("room:error", "Room introuvable");
        return;
      }
      if (room.hostId !== playerId) {
        socket.emit("room:error", "Seul l'hôte peut relancer la partie");
        return;
      }

      // Clean up old game engine
      const oldEngine = gameEngines.get(room.code);
      if (oldEngine) {
        oldEngine.destroy();
        gameEngines.delete(room.code);
      }

      // Reset room state
      roomManager.updateRoomStatus(room.code, "waiting");
      roomManager.resetAllScores(room.code);

      // Reset all player ready states
      room.players.forEach((p) => {
        p.isReady = false;
      });

      // Notify all players with updated room
      io.to(room.code).emit("room:play_again", room);
    });

    // ==========================================
    // GAME EVENTS
    // ==========================================

    socket.on("game:start", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) {
        socket.emit("room:error", "Only host can start the game");
        return;
      }

      // Clean up old game engine if replaying
      const oldEngine = gameEngines.get(room.code);
      if (oldEngine) {
        oldEngine.destroy();
        gameEngines.delete(room.code);
      }

      // Reset scores for a fresh game
      roomManager.resetAllScores(room.code);

      // Create game engine for this room
      const gameEngine = new GameEngine(room, io, roomManager);
      gameEngines.set(room.code, gameEngine);

      // Start the game
      gameEngine.start();
    });

    socket.on("game:submit_answer", (answer: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitAnswer(playerId, answer);
    });

    socket.on("game:request_next_round", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (gameEngine) {
        gameEngine.nextRound();
      }
    });

    // ==========================================
    // PETIT BAC EVENTS
    // ==========================================

    socket.on("petitbac:submit_validation", (validation) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitPetitBacValidation(validation);
    });

    // ==========================================
    // GEOQUIZ EVENTS
    // ==========================================

    socket.on("geoquiz:submit_validation", (validation) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitGeoQuizValidation(validation);
    });

    socket.on("geoquiz:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSingleGeoQuizAnswer(targetPlayerId, accepted);
    });

    socket.on("geoquiz:use_hint", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.useGeoQuizHint(playerId);
    });

    // ==========================================
    // POKEGEO EVENTS
    // ==========================================

    socket.on("pokegeo:submit_validation", (validation) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitPokeGeoValidation(validation);
    });

    socket.on("pokegeo:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSinglePokeGeoAnswer(targetPlayerId, accepted);
    });

    socket.on("pokegeo:use_hint", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.usePokeGeoHint(playerId);
    });

    // ==========================================
    // LANGUE EVENTS
    // ==========================================

    socket.on("langue:submit_validation", (validation) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitLangueValidation(validation);
    });

    socket.on("langue:validate_answer", (targetPlayerId: string, languageCorrect: boolean, meaningCorrect: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSingleLangueAnswer(targetPlayerId, languageCorrect, meaningCorrect);
    });

    // ==========================================
    // PARCOURS EVENTS
    // ==========================================

    socket.on("parcours:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSingleParcoursAnswer(targetPlayerId, accepted);
    });

    // ==========================================
    // GUESSGAME EVENTS
    // ==========================================

    socket.on("guessgame:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSingleGuessGameAnswer(targetPlayerId, accepted);
    });

    // ==========================================
    // CONSENSUS EVENTS
    // ==========================================

    socket.on("consensus:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSingleConsensusAnswer(targetPlayerId, accepted);
    });

    // ==========================================
    // LINEUP EVENTS
    // ==========================================

    socket.on("lineup:skip_reveal", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.skipLineupReveal();
    });

    // ==========================================
    // SPLIT OR STEAL EVENTS
    // ==========================================

    socket.on("splitsteal:submit_choice", (choice: "split" | "steal") => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitSplitStealChoice(playerId, choice);
    });

    // ==========================================
    // POKEMON STATS EVENTS
    // ==========================================

    socket.on("pokestats:use_hint", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.usePokestatsHint(playerId);
    });

    socket.on("pokestats:abandon", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.handlePokestatsAbandon(playerId);
    });

    // ==========================================
    // POKEMON ATTACK EVENTS
    // ==========================================

    socket.on("pokemonattack:use_hint", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.usePokemonAttackHint(playerId);
    });

    socket.on("pokemonattack:abandon", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.handlePokemonAttackAbandon(playerId);
    });

    // ==========================================
    // POKEMON SILHOUETTE EVENTS
    // ==========================================

    socket.on("pokemon:abandon", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.handlePokemonAbandon(playerId);
    });

    socket.on("pokemon:validate_answer", (targetPlayerId: string, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateSinglePokemonAnswer(targetPlayerId, accepted);
    });

    // ==========================================
    // LISTE EVENTS
    // ==========================================

    socket.on("liste:submit_answer", (answer: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitAnswer(playerId, answer);
    });

    socket.on("liste:finish", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitListeFinish(playerId);
    });

    // ==========================================
    // DRAWING EVENTS
    // ==========================================

    socket.on("drawing:submit_suggestion", (suggestion: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitSuggestion(playerId, suggestion);
    });

    socket.on("drawing:submit_drawing", (drawingBase64: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitDrawing(playerId, drawingBase64);
    });

    socket.on("drawing:submit_guess", (guess: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.submitGuess(playerId, guess);
    });

    socket.on("drawing:reveal_next", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.advanceReveal();
    });

    socket.on("drawing:reveal_prev", () => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.retreatReveal();
    });

    socket.on("drawing:validate_chain", (chainIndex: number, accepted: boolean) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const gameEngine = gameEngines.get(room.code);
      if (!gameEngine) return;

      gameEngine.validateDrawingChain(chainIndex, accepted);
    });

    // ==========================================
    // CHAT EVENTS
    // ==========================================

    socket.on("chat:send_message", (message: string) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      const trimmed = message.trim().slice(0, 200);
      if (!trimmed) return;

      const chatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerId: player.id,
        playerName: player.name,
        playerAvatar: player.avatar,
        message: trimmed,
        timestamp: Date.now(),
      };

      io.to(room.code).emit("chat:message", chatMessage);
    });

    // ==========================================
    // REACTION EVENTS
    // ==========================================

    socket.on("reaction:laugh", (targetPlayerId: string, roundNumber: number) => {
      const playerId = roomManager.getPlayerIdFromSocket(socket.id);
      if (!playerId) return;

      const room = roomManager.getRoomByPlayerId(playerId);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (!player) return;

      io.to(room.code).emit("reaction:laugh", {
        playerId: player.id,
        playerName: player.name,
        targetPlayerId,
        roundNumber,
      });
    });

    // ==========================================
    // CONNECTION EVENTS
    // ==========================================

    socket.on("connection:reconnect", (roomCode: string, playerId: string) => {
      supersedeOtherSocket(socket, io, roomManager, playerId);

      const result = roomManager.reconnectPlayer(roomCode, playerId, socket.id);
      if (!result) {
        // Tell the client *why* it failed. A generic room:error left the app
        // sitting in a lobby whose room no longer exists server-side, where
        // every button silently did nothing.
        const roomStillExists = Boolean(roomManager.getRoom(roomCode));
        socket.emit(
          "connection:reconnect_failed",
          roomStillExists ? "player_removed" : "room_gone"
        );
        return;
      }

      const { room, player } = result;
      socket.join(room.code);
      clearDisconnectTimeout(player.id);

      // Notify game engine so it removes the player from disconnectedPlayers set
      const gameEngine = gameEngines.get(room.code);
      if (gameEngine) {
        gameEngine.handlePlayerReconnect(player.id);
      }

      socket.emit("connection:reconnected", room, player);
      socket.to(room.code).emit("connection:player_reconnected", player.id);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
      handlePlayerDisconnect(socket, io, roomManager);
    });
  });
}

function clearDisconnectTimeout(playerId: string) {
  const timeout = disconnectTimeouts.get(playerId);
  if (timeout) {
    clearTimeout(timeout);
    disconnectTimeouts.delete(playerId);
  }
}

/**
 * Restore the socket ↔ player mapping from the handshake auth payload.
 *
 * The client re-sends `{ playerId, roomCode }` on every connection attempt, so
 * a reconnecting socket is usable the instant it lands — no round-trip, and no
 * window where buffered client events get dropped for lack of a mapping.
 */
function reattachFromHandshake(socket: TypedSocket, io: TypedIO, roomManager: RoomManager) {
  const auth = (socket.handshake.auth ?? {}) as { playerId?: unknown; roomCode?: unknown };
  const playerId = typeof auth.playerId === "string" ? auth.playerId : undefined;
  const roomCode = typeof auth.roomCode === "string" ? auth.roomCode : undefined;
  if (!playerId || !roomCode) return;

  supersedeOtherSocket(socket, io, roomManager, playerId);

  const result = roomManager.reconnectPlayer(roomCode, playerId, socket.id);
  if (!result) {
    // The client believes it is in a room the server no longer has it in.
    // Say so, so it can recover instead of sitting in a dead lobby.
    socket.emit(
      "connection:reconnect_failed",
      roomManager.getRoom(roomCode) ? "player_removed" : "room_gone"
    );
    return;
  }

  const { room, player } = result;
  socket.join(room.code);
  clearDisconnectTimeout(player.id);
  gameEngines.get(room.code)?.handlePlayerReconnect(player.id);

  socket.emit("connection:reconnected", room, player);
  socket.to(room.code).emit("connection:player_reconnected", player.id);
  console.log(`${player.name} re-attached to room ${room.code} from handshake`);
}

/**
 * A player identity maps to exactly one socket. When a second *live* socket
 * shows up for the same playerId (the player opened the game in another tab —
 * both share the playerId in localStorage), the newcomer wins and the old one
 * is retired explicitly.
 *
 * Without this the two sockets take turns owning the server-side mapping, and
 * whichever one loses the race goes quietly dead: every handler bails out at
 * `if (!playerId) return` and the room looks frozen from that tab.
 */
function supersedeOtherSocket(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager,
  playerId: string
) {
  const previousSocketId = roomManager.getSocketIdFromPlayerId(playerId);
  if (!previousSocketId || previousSocketId === socket.id) return;

  const previousSocket = io.sockets.sockets.get(previousSocketId);
  // A merely stale mapping (the old socket is already gone) needs no eviction —
  // reconnectPlayer() cleans those up on its own.
  if (!previousSocket?.connected) return;

  previousSocket.emit("connection:superseded");
  previousSocket.disconnect(true);
  console.log(`Socket ${previousSocketId} superseded by ${socket.id} for player ${playerId}`);
}

/**
 * Remove a player from whatever room they were still registered in before they
 * create or join another one.
 */
function evictFromPreviousRoom(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager,
  playerId: string
) {
  const previousCode = roomManager.getCurrentRoomCode(playerId);
  if (!previousCode) return;

  clearDisconnectTimeout(playerId);
  const result = roomManager.leaveRoom(playerId);
  if (!result) return;

  socket.leave(previousCode);
  io.to(previousCode).emit("room:player_left", playerId);
  if (result.newHostId) {
    io.to(previousCode).emit("room:host_changed", result.newHostId);
  }
  if (result.room.players.length === 0) {
    gameEngines.get(previousCode)?.destroy();
    gameEngines.delete(previousCode);
  }
}

/**
 * Periodic room reaper. Lives here (rather than in the server entrypoints) so
 * it can also tear down the game engines of the rooms it removes — otherwise
 * their per-second timers keep running for the lifetime of the process.
 */
export function startRoomCleanup(roomManager: RoomManager): NodeJS.Timeout {
  return setInterval(() => {
    for (const { code, playerIds } of roomManager.cleanupInactiveRooms()) {
      gameEngines.get(code)?.destroy();
      gameEngines.delete(code);
      // The grace timers of a reaped room have nothing left to remove.
      playerIds.forEach(clearDisconnectTimeout);
    }
  }, 60000);
}

function handlePlayerLeave(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager
) {
  const playerId = roomManager.getPlayerIdFromSocket(socket.id);
  if (!playerId) return;

  const result = roomManager.leaveRoom(playerId);
  if (!result) return;

  const { room, wasHost, newHostId } = result;

  socket.leave(room.code);
  clearDisconnectTimeout(playerId);
  io.to(room.code).emit("room:player_left", playerId);

  if (newHostId) {
    io.to(room.code).emit("room:host_changed", newHostId);
  }

  // Cleanup game engine if room is empty
  if (room.players.length === 0) {
    gameEngines.get(room.code)?.destroy();
    gameEngines.delete(room.code);
  }
}

function handlePlayerDisconnect(
  socket: TypedSocket,
  io: TypedIO,
  roomManager: RoomManager
) {
  const result = roomManager.disconnectPlayer(socket.id);
  if (!result) return;

  const { room, player } = result;
  io.to(room.code).emit("connection:player_disconnected", player.id);

  // If in a game, mark player as disconnected
  const gameEngine = gameEngines.get(room.code);
  if (gameEngine) {
    gameEngine.handlePlayerDisconnect(player.id);
  }

  // Schedule removal after the grace period — cancellable on reconnection.
  // Replace any timer already armed for this player so it can't fire later.
  clearDisconnectTimeout(player.id);
  const timeout = setTimeout(() => {
    disconnectTimeouts.delete(player.id);
    const currentRoom = roomManager.getRoom(room.code);
    if (!currentRoom) return;

    const currentPlayer = currentRoom.players.find((p) => p.id === player.id);
    if (currentPlayer && !currentPlayer.isConnected) {
      // Player didn't come back. removeTimedOutPlayer() refuses to remove the
      // last player of a room — that would delete the room out from under
      // someone who merely backgrounded their phone.
      const leaveResult = roomManager.removeTimedOutPlayer(player.id);
      if (leaveResult) {
        io.to(room.code).emit("room:player_left", player.id);
        if (leaveResult.newHostId) {
          io.to(room.code).emit("room:host_changed", leaveResult.newHostId);
        }
      }
    }
  }, DISCONNECT_GRACE_MS);
  disconnectTimeouts.set(player.id, timeout);
}
