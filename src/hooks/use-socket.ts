"use client";

import { useEffect, useCallback } from "react";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import { usePlayerStore, useRoomStore, useGameStore, useUIStore } from "@/stores";
import type { Room, Player, GameSettings, GameMode, Question, RoundResult } from "@/types";

// Module-level flag: listeners are attached ONCE across all component instances
let listenersAttached = false;

function setupSocketListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  const socket = getSocket();

  // Connection events
  socket.on("connect", () => {
    console.log("Socket connected");
    useUIStore.getState().setConnected(true);
    useUIStore.getState().setReconnecting(false);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
    useUIStore.getState().setConnected(false);
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
    if (`player_${socket.id}` === newHostId || currentPlayerId === newHostId) {
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

  socket.on("game:round_start", (_round: number, question: Question) => {
    useGameStore.getState().setCurrentQuestion(question);
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
    useGameStore.getState().setStatus("leaderboard");
  });

  socket.on("game:finished", (finalScores: Player[]) => {
    useRoomStore.getState().setPlayers(finalScores);
    useGameStore.getState().finishGame();
    useUIStore.getState().setScreen("scoreboard");
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

    if (socket.connected) {
      socket.emit("room:create", playerName, avatar);
    } else {
      socket.once("connect", () => {
        socket.emit("room:create", playerName, avatar);
      });
      connectSocket();
    }
  }, [socket]);

  const joinRoom = useCallback((roomCode: string, playerName: string, avatar: string) => {
    useUIStore.getState().setLoading(true, "Connexion à la room...");

    if (socket.connected) {
      socket.emit("room:join", roomCode, playerName, avatar);
    } else {
      socket.once("connect", () => {
        socket.emit("room:join", roomCode, playerName, avatar);
      });
      connectSocket();
    }
  }, [socket]);

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
    useRoomStore.getState().setRoom(null);
    useUIStore.getState().setScreen("home");
    useGameStore.getState().resetGame();
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
  };
}
