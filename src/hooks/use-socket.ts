"use client";

import { useEffect, useCallback } from "react";
import { getSocket, connectSocket, disconnectSocket, setSocketAuth, getSocketAuth } from "@/lib/socket";
import { usePlayerStore, useRoomStore, useGameStore, useUIStore } from "@/stores";
import type { Room, Player, GameSettings, GameMode, Question, GameResyncData, RoundResult, DrawingPhase, DrawingPhaseData, DrawingRevealState, DrawingRoundResult, PetitBacValidationData, PetitBacValidationSubmission, GeoQuizValidationData, GeoQuizValidationSubmission, GeoQuizAnswerResultData, LangueValidationData, LangueValidationSubmission, LangueAnswerResultData, ParcoursValidationData, ParcoursValidationSubmission, ParcoursAnswerResultData, GuessGameValidationData, GuessGameValidationSubmission, GuessGameAnswerResultData, ConsensusValidationData, ConsensusAnswerResultData, TeamRoundData, TeamRoundResult, LineupGuessResult, LineupMatch, ChatMessage, AnswerReaction, SplitStealStartData, SplitStealRevealData, ListeRoundResult, ListeProgressData, PokestatsGuessResult, PokestatsHintData, PokestatsRoundResult, PokestatsAbandonResult, PokeGeoValidationData, PokeGeoValidationSubmission, PokeGeoAnswerResultData, ReconnectFailureReason } from "@/types";
import { useChatStore } from "@/stores/chat-store";
import { saveSessionRoom, clearSessionRoom, loadSessionRoom } from "@/lib/session";

// Module-level flag: listeners are attached ONCE across all component instances
let listenersAttached = false;

// Failed handshakes in a row before we replace the current screen with the
// full-screen "Reconnexion…" UI.
const CONNECT_ERRORS_BEFORE_RECONNECTING_UI = 3;
let consecutiveConnectErrors = 0;

// How long room:create / room:join may wait for a socket before we give the
// player their screen back instead of a spinner that never resolves.
const CONNECT_TIMEOUT_MS = 12_000;

/**
 * Set while we are walking back into a room the server dropped us from. If the
 * re-join fails too, there is nothing left to recover and the client has to go
 * home rather than sit in a lobby the server knows nothing about.
 */
let rejoinInFlight = false;
let rejoinTimeout: ReturnType<typeof setTimeout> | null = null;

function setRejoinInFlight(value: boolean) {
  rejoinInFlight = value;
  if (rejoinTimeout) {
    clearTimeout(rejoinTimeout);
    rejoinTimeout = null;
  }
  // Safety net: if the server never answers the re-join, stop treating later
  // errors as its verdict.
  if (value) {
    rejoinTimeout = setTimeout(() => {
      rejoinInFlight = false;
      rejoinTimeout = null;
    }, CONNECT_TIMEOUT_MS);
  }
}

/**
 * Set once the server handed our identity to another tab. Suppresses the
 * automatic reconnect that would otherwise take it straight back.
 */
let wasSuperseded = false;

// Every screen except "home" is replaced by the full-screen reconnect UI (see
// page.tsx), so a hiccup on any of them deserves the same patience.
function isInRoomScreen(): boolean {
  return useUIStore.getState().currentScreen !== "home";
}

/**
 * Push the current identity into the socket handshake so that any (re)connect
 * — including the automatic ones we never see — re-attaches this socket to its
 * player server-side before a single packet is processed.
 *
 * Falls back to the persisted room code so the very first connection after a
 * page reload already carries enough to be re-attached.
 */
function syncSocketAuth() {
  const room = useRoomStore.getState().room;
  if (room) saveSessionRoom(room.code);

  setSocketAuth({
    playerId: usePlayerStore.getState().playerId,
    roomCode: room?.code ?? loadSessionRoom() ?? undefined,
  });
}

/**
 * Drop every trace of the current game and send the player back home. Used for
 * all the "you are no longer in this room" endings: kicked, superseded by
 * another tab, or a room that no longer exists.
 */
function leaveToHome(message: string, type: "error" | "info" = "error") {
  setRejoinInFlight(false);
  clearSessionRoom();
  useRoomStore.getState().resetRoom();
  useGameStore.getState().resetGame();
  useChatStore.getState().reset();
  usePlayerStore.getState().resetSession();
  useUIStore.getState().setReconnecting(false);
  useUIStore.getState().setLoading(false);
  useUIStore.getState().setScreen("home");
  useUIStore.getState().addNotification({ type, message, duration: 6000 });
}

/**
 * Ask the server to put us back in our room. Only needed when the handshake
 * couldn't do it — otherwise the server has already re-attached this socket
 * and answered with connection:reconnected, and a second request would just
 * produce a duplicate "Reconnecté !".
 */
function requestRejoinIfHandshakeDidNot() {
  const socket = getSocket();
  const room = useRoomStore.getState().room;
  const playerId = usePlayerStore.getState().playerId;
  if (!room || !playerId || !socket.connected) return;
  if (getSocketAuth().roomCode === room.code) return;
  socket.emit("connection:reconnect", room.code, playerId);
}

/**
 * Run `send` once the socket is up, connecting first if needed.
 *
 * The bare `socket.once("connect", …)` this replaces had no way out: when the
 * server was unreachable the callback never fired, the loading overlay stayed
 * up forever, and `isLoading` then blocked every later attempt — the app was
 * bricked until a reload.
 */
function emitWhenConnected(
  socket: ReturnType<typeof getSocket>,
  failureMessage: string,
  send: (playerId: string) => void
) {
  const playerId = usePlayerStore.getState().playerId;
  wasSuperseded = false;

  if (socket.connected) {
    send(playerId);
    return;
  }

  const timeout = setTimeout(() => {
    socket.off("connect", onConnect);
    useUIStore.getState().setLoading(false);
    useUIStore.getState().setError(`${failureMessage} — vérifie ta connexion et réessaie.`);
  }, CONNECT_TIMEOUT_MS);

  function onConnect() {
    clearTimeout(timeout);
    send(playerId);
  }

  socket.once("connect", onConnect);
  syncSocketAuth();
  connectSocket();
}

function resumeConnection(source: string) {
  // Already connected → nothing to do. Socket.IO's own heartbeat detects a
  // zombie transport and triggers a real reconnect, which re-attaches us via
  // the handshake.
  if (getSocket().connected) return;
  console.log(`Resuming socket connection (${source})`);
  syncSocketAuth();
  connectSocket();
}

function setupVisibilityHandler() {
  if (typeof document === "undefined") return;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    // Always try to resume when coming back to the foreground: on mobile the
    // socket is usually already dead by then, and tracking "was it connected
    // when we left" misses the bfcache case entirely.
    resumeConnection("visibilitychange");
  });

  // iOS Safari restores the page from the back/forward cache without ever
  // firing visibilitychange, leaving a silently dead socket behind.
  window.addEventListener("pageshow", (event) => {
    if ((event as PageTransitionEvent).persisted) {
      resumeConnection("pageshow");
    }
  });

  window.addEventListener("online", () => resumeConnection("online"));
}

function setupSocketListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const socket = getSocket();

  // Keep the handshake identity current so every automatic reconnection
  // re-attaches to the right room without a round-trip.
  syncSocketAuth();
  useRoomStore.subscribe(syncSocketAuth);
  usePlayerStore.subscribe(syncSocketAuth);

  // Visibility handler to prevent tab-switch disconnects
  setupVisibilityHandler();

  // The page was reloaded (or restored) while we were in a room: connect right
  // away so the handshake can walk us back in. The server answers with either
  // connection:reconnected or connection:reconnect_failed, both of which the
  // handlers below know how to land.
  if (loadSessionRoom()) {
    connectSocket();
  }

  // Connection events
  socket.on("connect", () => {
    console.log("Socket connected");
    consecutiveConnectErrors = 0;
    useUIStore.getState().setConnected(true);
    useUIStore.getState().setReconnecting(false);
    useUIStore.getState().resetReconnectAttempts();
    // Clear any stale error from a previous disconnect so the UI recovers.
    useUIStore.getState().setError(null);

    // Fallback for the case where the socket connected without a room code in
    // its handshake (e.g. it was opened before we joined a room).
    requestRejoinIfHandshakeDidNot();
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    useUIStore.getState().setConnected(false);

    // Only "io server disconnect" and an explicit client disconnect stop the
    // built-in reconnection manager. For everything else (transport close,
    // ping timeout, …) Socket.IO is already retrying — calling connect() here
    // races its scheduler and produces spurious connect_errors.
    //
    // The one server-side disconnect we must NOT undo is the one that hands
    // this player's identity to another tab.
    if (reason === "io server disconnect" && !wasSuperseded) {
      syncSocketAuth();
      connectSocket();
    }
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
    consecutiveConnectErrors += 1;
    useUIStore.getState().incrementReconnectAttempts();
    // Don't tear the room screen down on the first hiccup. A single failed
    // handshake is routine on mobile (network switch, tunnel, screen lock) and
    // Socket.IO retries on its own; only escalate to the full-screen
    // "Reconnexion" once it's clearly not coming back.
    if (consecutiveConnectErrors >= CONNECT_ERRORS_BEFORE_RECONNECTING_UI || !isInRoomScreen()) {
      useUIStore.getState().setReconnecting(true);
    }
  });

  // Room events
  socket.on("room:joined", (room: Room, player: Player) => {
    setRejoinInFlight(false);
    saveSessionRoom(room.code);
    useRoomStore.getState().setRoom(room);
    usePlayerStore.getState().setIsHost(player.isHost);
    useUIStore.getState().setScreen("lobby");
    useUIStore.getState().setLoading(false);
    useUIStore.getState().addNotification({
      type: "success",
      message: player.isHost ? "Room créée !" : "Tu as rejoint la room !",
    });
  });

  socket.on("room:player_joined", (player: Player) => {
    useRoomStore.getState().addPlayer(player);
    useUIStore.getState().addNotification({
      type: "info",
      message: `${player.name} a rejoint la partie`,
    });
  });

  socket.on("room:player_left", (playerId: string) => {
    // It's us: the server removed this player from the room (grace period
    // expired, or we were evicted because this identity started another game).
    // Staying on the lobby/game screen would leave every button doing nothing.
    if (playerId === usePlayerStore.getState().playerId) {
      if (useUIStore.getState().currentScreen !== "home") {
        leaveToHome("Tu as été retiré de la partie.");
      }
      return;
    }

    const room = useRoomStore.getState().room;
    const player = room?.players.find((p) => p.id === playerId);
    useRoomStore.getState().removePlayer(playerId);
    if (player) {
      useUIStore.getState().addNotification({
        type: "info",
        message: `${player.name} a quitté la partie`,
      });
    }
  });

  socket.on("room:kicked", () => {
    leaveToHome("Tu as été exclu de la partie par l'hôte.");
  });

  socket.on("room:player_ready", (playerId: string, isReady: boolean) => {
    useRoomStore.getState().setPlayerReady(playerId, isReady);
  });

  socket.on("room:settings_updated", (settings: GameSettings) => {
    useRoomStore.getState().updateSettings(settings);
  });

  socket.on("room:host_changed", (newHostId: string) => {
    const currentPlayerId = usePlayerStore.getState().playerId;
    useRoomStore.getState().setHost(newHostId);
    if (currentPlayerId === newHostId) {
      usePlayerStore.getState().setIsHost(true);
      useUIStore.getState().addNotification({
        type: "info",
        message: "Tu es maintenant l'hôte !",
      });
    }
  });

  socket.on("room:error", (message: string) => {
    // The last-ditch re-join failed (typically "la partie a déjà commencé").
    // There is nothing left to come back to, so leave cleanly instead of
    // showing a toast over a room that only exists on this client.
    if (rejoinInFlight) {
      leaveToHome(message);
      return;
    }

    const screen = useUIStore.getState().currentScreen;
    const isInRoom = screen === "lobby" || screen === "game" || screen === "scoreboard";
    if (isInRoom) {
      // Already in a room — show a notification but don't nuke the screen.
      // This prevents transient errors (e.g. reconnect hiccup) from
      // killing the lobby or game.
      useUIStore.getState().addNotification({ type: "error", message, duration: 5000 });
    } else {
      // User was trying to create/join a room — show a blocking error so
      // they know it failed.
      useUIStore.getState().setError(message);
    }
    useUIStore.getState().setLoading(false);
  });

  // Game events
  socket.on("game:mode_changed", (mode: GameMode) => {
    useRoomStore.getState().setGameMode(mode);
    useGameStore.getState().setModeTransition(mode);
    // Auto-clear after animation
    setTimeout(() => {
      useGameStore.getState().setModeTransition(null);
    }, 2500);
  });

  socket.on("game:starting", (countdown: number) => {
    if (useGameStore.getState().status !== "countdown") {
      useUIStore.getState().setScreen("game");
      const room = useRoomStore.getState().room;
      if (room) {
        useGameStore.getState().startGame(room.settings.totalRounds);
      }
    }
    useGameStore.getState().setCountdown(countdown);
  });

  socket.on("game:round_start", (round: number, question: Question) => {
    useGameStore.getState().setCurrentQuestion(question, round);
  });

  socket.on("game:time_update", (time: number) => {
    useGameStore.getState().setTimeRemaining(time);
  });

  socket.on("game:player_answered", (playerId: string) => {
    useGameStore.getState().markPlayerAnswered(playerId);
  });

  socket.on("game:round_end", (result: RoundResult) => {
    useGameStore.getState().setRoundResult(result);
  });

  socket.on("game:leaderboard", (players: Player[]) => {
    useRoomStore.getState().setPlayers(players);
    // Don't show leaderboard between rounds — scores are revealed at game end (scoreboard screen)
  });

  socket.on("game:finished", (finalScores: Player[]) => {
    useRoomStore.getState().setPlayers(finalScores);
    useGameStore.getState().finishGame();
    useUIStore.getState().setScreen("scoreboard");
  });

  // Sent to us alone after a reconnection: the round we missed the broadcast
  // for. Without it we land on the game screen with no question on it.
  socket.on("game:resync", (data: GameResyncData) => {
    useGameStore.getState().setCurrentQuestion(data.question, data.round);
    useGameStore.setState({
      totalRounds: data.totalRounds,
      timeRemaining: data.timeRemaining,
      answeredPlayers: data.answeredPlayerIds,
      hasAnswered: data.myAnswer !== null,
      myAnswer: data.myAnswer,
      status: data.myAnswer !== null ? "answering" : "question",
    });
    useUIStore.getState().setScreen("game");
  });

  // Drawing events
  socket.on("drawing:phase_start", (phase: DrawingPhase, data: DrawingPhaseData) => {
    useGameStore.getState().setDrawingPhase(phase, data.timeLimit);
  });

  socket.on("drawing:your_phrase", (phrase: string, _questionId: string) => {
    useGameStore.getState().setDrawingPhrase(phrase);
  });

  socket.on("drawing:your_guess_target", (drawingData: string) => {
    useGameStore.getState().setDrawingToGuess(drawingData);
  });

  socket.on("drawing:reveal_state", (revealState: DrawingRevealState) => {
    useGameStore.getState().setDrawingRevealState(revealState);
  });

  socket.on("drawing:reveal_step", (chainIndex: number, step: number) => {
    useGameStore.getState().updateDrawingRevealStep(chainIndex, step);
  });

  socket.on("drawing:round_scores", (result: DrawingRoundResult) => {
    useGameStore.getState().setDrawingScores(result);
  });

  socket.on("drawing:chain_validated", (chainIndex: number, accepted: boolean) => {
    useGameStore.getState().validateDrawingChain(chainIndex, accepted);
  });

  // Petit Bac events
  socket.on("petitbac:validation_start", (data: PetitBacValidationData) => {
    useGameStore.getState().setPetitBacValidation(data);
  });

  socket.on("petitbac:stop_triggered", (data: { playerId: string; playerName: string; countdown: number }) => {
    useGameStore.setState({ petitBacStopTriggered: { playerName: data.playerName, countdown: data.countdown } });
  });

  socket.on("petitbac:validation_result", (validation: PetitBacValidationSubmission) => {
    useGameStore.getState().setPetitBacValidatedAnswers(validation);
  });

  // GeoQuiz events
  socket.on("geoquiz:validation_start", (data: GeoQuizValidationData) => {
    useGameStore.getState().setGeoQuizValidation(data);
  });

  socket.on("geoquiz:validation_result", (validation: GeoQuizValidationSubmission) => {
    useGameStore.getState().setGeoQuizValidatedPlayerIds(validation);
  });

  socket.on("geoquiz:hint_revealed", (hint: string) => {
    useGameStore.getState().setGeoQuizHint(hint);
  });

  socket.on("geoquiz:answer_result", (data: GeoQuizAnswerResultData) => {
    useGameStore.getState().addGeoQuizAnswerResult(data);
  });

  // PokéGeo events
  socket.on("pokegeo:validation_start", (data: PokeGeoValidationData) => {
    useGameStore.getState().setPokeGeoValidation(data);
  });

  socket.on("pokegeo:validation_result", (validation: PokeGeoValidationSubmission) => {
    useGameStore.getState().setPokeGeoValidatedPlayerIds(validation);
  });

  socket.on("pokegeo:hint_revealed", (hint: string) => {
    useGameStore.getState().setPokeGeoHint(hint);
  });

  socket.on("pokegeo:answer_result", (data: PokeGeoAnswerResultData) => {
    useGameStore.getState().addPokeGeoAnswerResult(data);
  });

  // Langue events
  socket.on("langue:validation_start", (data: LangueValidationData) => {
    useGameStore.getState().setLangueValidation(data);
  });

  socket.on("langue:validation_result", (_validation: LangueValidationSubmission) => {
    // round_end follows immediately
  });

  socket.on("langue:answer_result", (data: LangueAnswerResultData) => {
    useGameStore.getState().addLangueAnswerResult(data);
  });

  // Parcours events
  socket.on("parcours:validation_start", (data: ParcoursValidationData) => {
    useGameStore.getState().setParcoursValidation(data);
  });

  socket.on("parcours:validation_result", (_validation: ParcoursValidationSubmission) => {
    // round_end follows immediately
  });

  socket.on("parcours:answer_result", (data: ParcoursAnswerResultData) => {
    useGameStore.getState().addParcoursAnswerResult(data);
  });

  // GuessGame events
  socket.on("guessgame:validation_start", (data: GuessGameValidationData) => {
    useGameStore.getState().setGuessGameValidation(data);
  });

  socket.on("guessgame:validation_result", (_validation: GuessGameValidationSubmission) => {
    // round_end follows immediately
  });

  socket.on("guessgame:answer_result", (data: GuessGameAnswerResultData) => {
    useGameStore.getState().addGuessGameAnswerResult(data);
  });

  // Consensus events
  socket.on("consensus:validation_start", (data: ConsensusValidationData) => {
    useGameStore.getState().setConsensusValidation(data);
  });

  socket.on("consensus:answer_result", (data: ConsensusAnswerResultData) => {
    useGameStore.getState().addConsensusAnswerResult(data);
  });

  // Split or Steal events
  socket.on("splitsteal:phase_start", (data: SplitStealStartData) => {
    useGameStore.getState().setSplitStealPhase(data);
  });

  socket.on("splitsteal:player_chose", (playerId: string) => {
    useGameStore.getState().markPlayerAnswered(playerId);
  });

  socket.on("splitsteal:reveal", (data: SplitStealRevealData) => {
    useGameStore.getState().setSplitStealReveal(data);
  });

  // Lineup events
  socket.on("lineup:guess_result", (result: LineupGuessResult) => {
    const store = useGameStore.getState();
    const myPlayerId = usePlayerStore.getState().playerId;
    if (result.correct) {
      // Find the guesser's name for notifications
      const room = useRoomStore.getState().room;
      const guesserPlayer = room?.players.find((p) => p.id === result.playerId);
      store.addLineupFoundPlayer(result, myPlayerId, guesserPlayer?.name);
    }
    // Update my own count
    if (result.playerId === myPlayerId) {
      store.setLineupLastGuessCorrect(result.correct);
      if (result.correct) {
        useGameStore.setState({ lineupMyFoundCount: result.foundCount });
      }
    }
  });

  socket.on("lineup:reveal", (match: LineupMatch, scores: { playerId: string; foundCount: number }[]) => {
    useGameStore.getState().setLineupReveal(match, scores);
  });

  // Liste events
  socket.on("liste:item_found", (data: { playerId: string; itemIndex: number; answer: string }) => {
    const myPlayerId = usePlayerStore.getState().playerId;
    useGameStore.getState().addListeFoundItem(data.itemIndex, data.answer, data.playerId);
    if (data.playerId === myPlayerId) {
      // Use functional update to avoid stale count race condition
      useGameStore.setState((state) => ({ listeMyFoundCount: state.listeMyFoundCount + 1 }));
    }
  });

  socket.on("liste:player_finished", (data: { playerId: string; finishedCount: number; totalPlayers: number }) => {
    useGameStore.getState().addListeFinishedPlayer(data.playerId);
  });

  socket.on("liste:round_end", (result: ListeRoundResult) => {
    useGameStore.getState().setListeRoundResult(result);
  });

  // Pokemon Stats events
  socket.on("pokestats:guess_result", (result: PokestatsGuessResult) => {
    if (result.correct && result.points !== undefined) {
      useGameStore.getState().setPokestatsFound(result.points);
    }
  });

  socket.on("pokestats:hint", (data: PokestatsHintData) => {
    useGameStore.getState().addPokestatsHint(data);
  });

  socket.on("pokestats:player_found", (data: { playerId: string; hintsUsed: number }) => {
    useGameStore.getState().addPokestatsFoundPlayer(data.playerId, data.hintsUsed);
  });

  socket.on("pokestats:round_end", (result: PokestatsRoundResult) => {
    useGameStore.getState().setPokestatsRoundResult(result);
  });

  socket.on("pokestats:abandon_result", (data: PokestatsAbandonResult) => {
    useGameStore.getState().setPokestatsAbandoned(data);
  });

  // Pokemon Attack events
  socket.on("pokemonattack:guess_result", (result) => {
    if (result.correct && result.points !== undefined) {
      useGameStore.getState().setPokemonAttackFound(result.points);
    }
  });

  socket.on("pokemonattack:hint", (data) => {
    useGameStore.getState().addPokemonAttackHint(data);
  });

  socket.on("pokemonattack:player_found", (data) => {
    useGameStore.getState().addPokemonAttackFoundPlayer(data.playerId, data.hintsUsed);
  });

  socket.on("pokemonattack:round_end", (result) => {
    useGameStore.getState().setPokemonAttackRoundResult(result);
  });

  socket.on("pokemonattack:abandon_result", (data) => {
    useGameStore.getState().setPokemonAttackAbandoned(data);
  });

  // Pokemon Silhouette events
  socket.on("pokemon:guess_result", (result) => {
    if (result.correct && result.points !== undefined) {
      useGameStore.getState().setPokemonFound(result.points, result.isFirst || false);
    }
  });

  socket.on("pokemon:player_found", (data) => {
    useGameStore.getState().addPokemonFoundPlayer(data.playerId, data.isFirst);
  });

  socket.on("pokemon:round_end", (result) => {
    useGameStore.getState().setPokemonRoundResult(result);
  });

  socket.on("pokemon:abandon_result", (data) => {
    useGameStore.getState().setPokemonAbandoned(data);
  });

  socket.on("pokemon:validation_start", (data) => {
    useGameStore.getState().setPokemonValidation(data);
  });

  socket.on("pokemon:answer_result", (data) => {
    useGameStore.getState().addPokemonAnswerResult(data);
  });

  // Team events
  socket.on("game:team_round_start", (data: TeamRoundData) => {
    useGameStore.getState().setTeamRoundStart(data);
  });

  socket.on("game:team_round_end", (result: TeamRoundResult) => {
    useGameStore.getState().setTeamRoundEnd(result);
  });

  // Chat events
  socket.on("chat:message", (message: ChatMessage) => {
    useChatStore.getState().addMessage(message);
  });

  // Reaction events
  socket.on("reaction:laugh", (reaction: AnswerReaction) => {
    useChatStore.getState().addReaction(reaction);
  });

  // Connection events
  socket.on("connection:reconnected", (room: Room, player: Player) => {
    setRejoinInFlight(false);
    saveSessionRoom(room.code);
    useRoomStore.getState().setRoom(room);
    usePlayerStore.getState().setIsHost(player.isHost);
    useUIStore.getState().setReconnecting(false);
    useUIStore.getState().setConnected(true);
    useUIStore.getState().setError(null);
    useUIStore.getState().setLoading(false);

    if (room.status === "playing") {
      useUIStore.getState().setScreen("game");
    } else if (room.status === "finished") {
      useUIStore.getState().setScreen("scoreboard");
    } else {
      useUIStore.getState().setScreen("lobby");
    }

    useUIStore.getState().addNotification({
      type: "success",
      message: "Reconnecté !",
    });
  });

  socket.on("connection:reconnect_failed", (reason: ReconnectFailureReason) => {
    const player = usePlayerStore.getState();
    // May be a room we only know from the persisted session (page reload).
    const roomCode = useRoomStore.getState().room?.code ?? loadSessionRoom();

    // The room is still alive, we were just dropped from it → walk back in
    // rather than stranding the player in a lobby the server knows nothing
    // about (where every button silently does nothing). Guarded so a rejected
    // re-join can't bounce us around this branch forever.
    if (reason === "player_removed" && roomCode && player.playerName && !rejoinInFlight) {
      setRejoinInFlight(true);
      socket.emit("room:join", roomCode, player.playerName, player.avatar, player.playerId);
      return;
    }

    leaveToHome(
      reason === "room_gone"
        ? "Cette partie n'existe plus."
        : "Impossible de rejoindre la partie."
    );
  });

  // Our identity was claimed by another tab. The server has already closed
  // this socket; reconnecting would just take the room back from the other tab
  // and start the fight over, so we bow out.
  socket.on("connection:superseded", () => {
    wasSuperseded = true;
    leaveToHome("Cette partie est ouverte dans un autre onglet.", "info");
  });

  socket.on("connection:player_disconnected", (playerId: string) => {
    useRoomStore.getState().setPlayerDisconnected(playerId, false);
  });

  socket.on("connection:player_reconnected", (playerId: string) => {
    useRoomStore.getState().setPlayerDisconnected(playerId, true);
    const room = useRoomStore.getState().room;
    const player = room?.players.find((p) => p.id === playerId);
    if (player) {
      useUIStore.getState().addNotification({
        type: "info",
        message: `${player.name} s'est reconnecté`,
      });
    }
  });

  // Play again event
  socket.on("room:play_again", (room: Room) => {
    useRoomStore.getState().setRoom(room);
    useGameStore.getState().resetGame();
    useChatStore.getState().reset();
    usePlayerStore.getState().setIsReady(false);
    useUIStore.getState().setScreen("lobby");
    useUIStore.getState().addNotification({
      type: "info",
      message: "Nouvelle partie !",
    });
  });
}

export function useSocket() {
  const socket = getSocket();

  // Setup listeners once (module-level, survives component mount/unmount)
  useEffect(() => {
    setupSocketListeners();
  }, []);

  // Actions
  const connect = useCallback(() => {
    connectSocket();
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  const createRoom = useCallback((playerName: string, avatar: string) => {
    // A double tap used to create two rooms and leave the first orphaned with
    // a ghost player in it.
    if (useUIStore.getState().isLoading) return;
    useUIStore.getState().setLoading(true, "Création de la room...");

    // Creating a room means abandoning any previous one — don't let a stale
    // room code ride along in the handshake.
    clearSessionRoom();
    useRoomStore.getState().resetRoom();

    emitWhenConnected(socket, "Création impossible", (playerId) => {
      socket.emit("room:create", playerName, avatar, playerId);
    });
  }, [socket]);

  const joinRoom = useCallback((roomCode: string, playerName: string, avatar: string) => {
    if (useUIStore.getState().isLoading) return;
    useUIStore.getState().setLoading(true, "Connexion à la room...");

    emitWhenConnected(socket, "Connexion impossible", (playerId) => {
      socket.emit("room:join", roomCode, playerName, avatar, playerId);
    });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
    clearSessionRoom();
    useRoomStore.getState().setRoom(null);
    useUIStore.getState().setScreen("home");
    useGameStore.getState().resetGame();
    useChatStore.getState().reset();
  }, [socket]);

  const setReady = useCallback((isReady: boolean) => {
    socket.emit("room:ready", isReady);
    usePlayerStore.getState().setIsReady(isReady);
  }, [socket]);

  const updateRoomSettings = useCallback((settings: Partial<GameSettings>) => {
    socket.emit("room:update_settings", settings);
  }, [socket]);

  const changeGameMode = useCallback((mode: string) => {
    socket.emit("room:change_game_mode", mode as GameMode);
    // Optimistic update
    useRoomStore.getState().setGameMode(mode as GameMode);
  }, [socket]);

  const kickPlayer = useCallback((playerId: string) => {
    socket.emit("room:kick_player", playerId);
  }, [socket]);

  const startGameAction = useCallback(() => {
    socket.emit("game:start");
  }, [socket]);

  const submitAnswer = useCallback((answer: string) => {
    if (useGameStore.getState().canSubmitAnswer()) {
      socket.emit("game:submit_answer", answer);
      useGameStore.getState().submitAnswer(answer);
    }
  }, [socket]);

  const requestNextRound = useCallback(() => {
    socket.emit("game:request_next_round");
  }, [socket]);

  const reconnect = useCallback((roomCode: string, playerId: string) => {
    useUIStore.getState().setReconnecting(true);
    connectSocket();
    socket.emit("connection:reconnect", roomCode, playerId);
  }, [socket]);

  // Drawing actions — don't call submitAnswer() because it sets status="answering"
  // which overrides the drawing phase status and causes the screen to flip to QuestionDisplay
  const submitDrawingSuggestion = useCallback((suggestion: string) => {
    socket.emit("drawing:submit_suggestion", suggestion);
    useGameStore.setState({ hasAnswered: true, myAnswer: suggestion });
  }, [socket]);

  const submitDrawing = useCallback((base64: string) => {
    socket.emit("drawing:submit_drawing", base64);
    useGameStore.setState({ hasAnswered: true, myAnswer: base64.substring(0, 50) });
  }, [socket]);

  const submitDrawingGuess = useCallback((guess: string) => {
    socket.emit("drawing:submit_guess", guess);
    useGameStore.setState({ hasAnswered: true, myAnswer: guess });
  }, [socket]);

  const advanceDrawingReveal = useCallback(() => {
    socket.emit("drawing:reveal_next");
  }, [socket]);

  const retreatDrawingReveal = useCallback(() => {
    socket.emit("drawing:reveal_prev");
  }, [socket]);

  const validateDrawingChain = useCallback((chainIndex: number, accepted: boolean) => {
    socket.emit("drawing:validate_chain", chainIndex, accepted);
  }, [socket]);

  const submitPetitBacValidation = useCallback((validation: PetitBacValidationSubmission) => {
    socket.emit("petitbac:submit_validation", validation);
  }, [socket]);

  const submitGeoQuizValidation = useCallback((validation: GeoQuizValidationSubmission) => {
    socket.emit("geoquiz:submit_validation", validation);
  }, [socket]);

  const validateGeoQuizAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("geoquiz:validate_answer", playerId, accepted);
  }, [socket]);

  const useGeoQuizHint = useCallback(() => {
    socket.emit("geoquiz:use_hint");
  }, [socket]);

  const submitPokeGeoValidation = useCallback((validation: PokeGeoValidationSubmission) => {
    socket.emit("pokegeo:submit_validation", validation);
  }, [socket]);

  const validatePokeGeoAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("pokegeo:validate_answer", playerId, accepted);
  }, [socket]);

  const usePokeGeoHint = useCallback(() => {
    socket.emit("pokegeo:use_hint");
  }, [socket]);

  const validateLangueAnswer = useCallback((playerId: string, languageCorrect: boolean, meaningCorrect: boolean) => {
    socket.emit("langue:validate_answer", playerId, languageCorrect, meaningCorrect);
  }, [socket]);

  const submitLangueValidation = useCallback((validation: LangueValidationSubmission) => {
    socket.emit("langue:submit_validation", validation);
  }, [socket]);

  const validateParcoursAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("parcours:validate_answer", playerId, accepted);
  }, [socket]);

  const validateGuessGameAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("guessgame:validate_answer", playerId, accepted);
  }, [socket]);

  const validateConsensusAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("consensus:validate_answer", playerId, accepted);
  }, [socket]);

  const submitLineupGuess = useCallback((guess: string) => {
    if (useGameStore.getState().timeRemaining > 0) {
      socket.emit("game:submit_answer", guess);
    }
  }, [socket]);

  const skipLineupReveal = useCallback(() => {
    socket.emit("lineup:skip_reveal");
  }, [socket]);

  const submitSplitStealChoice = useCallback((choice: "split" | "steal") => {
    socket.emit("splitsteal:submit_choice", choice);
    useGameStore.setState({ hasAnswered: true, myAnswer: choice });
  }, [socket]);

  const submitListeAnswer = useCallback((answer: string) => {
    if (useGameStore.getState().timeRemaining > 0) {
      socket.emit("liste:submit_answer", answer);
    }
  }, [socket]);

  const submitListeFinish = useCallback(() => {
    socket.emit("liste:finish");
  }, [socket]);

  const submitPokestatsGuess = useCallback((guess: string) => {
    if (useGameStore.getState().timeRemaining > 0 && !useGameStore.getState().pokestatsFound) {
      socket.emit("game:submit_answer", guess);
    }
  }, [socket]);

  const usePokestatsHint = useCallback(() => {
    socket.emit("pokestats:use_hint");
  }, [socket]);

  const abandonPokestats = useCallback(() => {
    socket.emit("pokestats:abandon");
  }, [socket]);

  const submitPokemonAttackGuess = useCallback((guess: string) => {
    if (useGameStore.getState().timeRemaining > 0 && !useGameStore.getState().pokemonAttackFound) {
      socket.emit("game:submit_answer", guess);
    }
  }, [socket]);

  const usePokemonAttackHint = useCallback(() => {
    socket.emit("pokemonattack:use_hint");
  }, [socket]);

  const abandonPokemonAttack = useCallback(() => {
    socket.emit("pokemonattack:abandon");
  }, [socket]);

  const submitPokemonGuess = useCallback((guess: string) => {
    if (useGameStore.getState().timeRemaining > 0 && !useGameStore.getState().pokemonFound) {
      socket.emit("game:submit_answer", guess);
    }
  }, [socket]);

  const abandonPokemon = useCallback(() => {
    socket.emit("pokemon:abandon");
  }, [socket]);

  const validatePokemonAnswer = useCallback((playerId: string, accepted: boolean) => {
    socket.emit("pokemon:validate_answer", playerId, accepted);
  }, [socket]);

  const sendChatMessage = useCallback((message: string) => {
    socket.emit("chat:send_message", message);
  }, [socket]);

  const sendLaughReaction = useCallback((targetPlayerId: string, roundNumber: number) => {
    socket.emit("reaction:laugh", targetPlayerId, roundNumber);
  }, [socket]);

  const playAgain = useCallback(() => {
    socket.emit("room:play_again");
  }, [socket]);

  return {
    socket,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    updateRoomSettings,
    changeGameMode,
    kickPlayer,
    startGame: startGameAction,
    submitAnswer,
    requestNextRound,
    reconnect,
    submitDrawingSuggestion,
    submitDrawing,
    submitDrawingGuess,
    advanceDrawingReveal,
    retreatDrawingReveal,
    validateDrawingChain,
    submitPetitBacValidation,
    submitGeoQuizValidation,
    validateGeoQuizAnswer,
    useGeoQuizHint,
    submitPokeGeoValidation,
    validatePokeGeoAnswer,
    usePokeGeoHint,
    validateLangueAnswer,
    submitLangueValidation,
    validateParcoursAnswer,
    validateGuessGameAnswer,
    validateConsensusAnswer,
    submitLineupGuess,
    skipLineupReveal,
    submitSplitStealChoice,
    submitListeAnswer,
    submitListeFinish,
    submitPokestatsGuess,
    usePokestatsHint,
    abandonPokestats,
    submitPokemonAttackGuess,
    usePokemonAttackHint,
    abandonPokemonAttack,
    submitPokemonGuess,
    abandonPokemon,
    validatePokemonAnswer,
    sendChatMessage,
    sendLaughReaction,
    playAgain,
  };
}
