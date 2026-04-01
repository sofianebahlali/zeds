"use client";

import { useEffect, useCallback } from "react";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import { usePlayerStore, useRoomStore, useGameStore, useUIStore } from "@/stores";
import type { Room, Player, GameSettings, GameMode, Question, RoundResult, DrawingPhase, DrawingPhaseData, DrawingRevealState, DrawingRoundResult, PetitBacValidationData, PetitBacValidationSubmission, GeoQuizValidationData, GeoQuizValidationSubmission, GeoQuizAnswerResultData, LangueValidationData, LangueValidationSubmission, LangueAnswerResultData, ParcoursValidationData, ParcoursValidationSubmission, ParcoursAnswerResultData, GuessGameValidationData, GuessGameValidationSubmission, GuessGameAnswerResultData, ConsensusValidationData, ConsensusAnswerResultData, TeamRoundData, TeamRoundResult, LineupGuessResult, LineupMatch, ChatMessage, AnswerReaction, SplitStealStartData, SplitStealRevealData, ListeRoundResult, ListeProgressData, PokestatsGuessResult, PokestatsHintData, PokestatsRoundResult, PokestatsAbandonResult, PokeGeoValidationData, PokeGeoValidationSubmission, PokeGeoAnswerResultData } from "@/types";
import { useChatStore } from "@/stores/chat-store";

// Module-level flag: listeners are attached ONCE across all component instances
let listenersAttached = false;

function setupVisibilityHandler() {
  if (typeof document === "undefined") return;

  let wasConnected = false;

  document.addEventListener("visibilitychange", () => {
    const socket = getSocket();

    if (document.visibilityState === "hidden") {
      // Tab going to background — remember connection state
      wasConnected = socket.connected;
    } else if (document.visibilityState === "visible") {
      // Tab coming back to foreground — reconnect if needed
      if (wasConnected && !socket.connected) {
        console.log("Tab visible again, reconnecting socket...");
        connectSocket();
        // Try app-level reconnect if we were in a room
        const room = useRoomStore.getState().room;
        const playerStore = usePlayerStore.getState();
        if (room && playerStore.playerId) {
          setTimeout(() => {
            if (socket.connected) {
              socket.emit("connection:reconnect", room.code, playerStore.playerId!);
            }
          }, 500);
        }
      }
    }
  });
}

function setupSocketListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const socket = getSocket();

  // Visibility handler to prevent tab-switch disconnects
  setupVisibilityHandler();

  // Connection events
  socket.on("connect", () => {
    console.log("Socket connected");
    useUIStore.getState().setConnected(true);
    useUIStore.getState().setReconnecting(false);

    // Re-join room on reconnection (handles mobile tab-switch race condition
    // where Socket.IO auto-reconnects before the visibility handler runs)
    const room = useRoomStore.getState().room;
    const playerId = usePlayerStore.getState().playerId;
    if (room && playerId) {
      socket.emit("connection:reconnect", room.code, playerId);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    useUIStore.getState().setConnected(false);
    // If server disconnected us (transport close from tab switch), try to reconnect immediately
    if (reason === "transport close" || reason === "ping timeout") {
      socket.connect();
    }
  });

  socket.on("connect_error", (error) => {
    console.error("Socket connection error:", error);
    useUIStore.getState().setReconnecting(true);
  });

  // Room events
  socket.on("room:joined", (room: Room, player: Player) => {
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
    useUIStore.getState().setError(message);
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
    useRoomStore.getState().setRoom(room);
    usePlayerStore.getState().setIsHost(player.isHost);
    useUIStore.getState().setReconnecting(false);
    useUIStore.getState().setConnected(true);

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
    useUIStore.getState().setLoading(true, "Création de la room...");
    const playerId = usePlayerStore.getState().playerId;

    if (socket.connected) {
      socket.emit("room:create", playerName, avatar, playerId);
    } else {
      socket.once("connect", () => {
        socket.emit("room:create", playerName, avatar, playerId);
      });
      connectSocket();
    }
  }, [socket]);

  const joinRoom = useCallback((roomCode: string, playerName: string, avatar: string) => {
    useUIStore.getState().setLoading(true, "Connexion à la room...");
    const playerId = usePlayerStore.getState().playerId;

    if (socket.connected) {
      socket.emit("room:join", roomCode, playerName, avatar, playerId);
    } else {
      socket.once("connect", () => {
        socket.emit("room:join", roomCode, playerName, avatar, playerId);
      });
      connectSocket();
    }
  }, [socket]);

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
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
    submitPokemonGuess,
    abandonPokemon,
    validatePokemonAnswer,
    sendChatMessage,
    sendLaughReaction,
    playAgain,
  };
}
