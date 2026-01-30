"use client";

import { useEffect, useCallback, useRef } from "react";
import { getSocket, connectSocket, disconnectSocket } from "@/lib/socket";
import { usePlayerStore, useRoomStore, useGameStore, useUIStore } from "@/stores";
import type { Room, Player, GameSettings, Question, RoundResult } from "@/types";

export function useSocket() {
  const socket = getSocket();
  const isInitialized = useRef(false);

  // Get store actions
  const setRoom = useRoomStore((s) => s.setRoom);
  const addPlayer = useRoomStore((s) => s.addPlayer);
  const removePlayer = useRoomStore((s) => s.removePlayer);
  const setPlayerReady = useRoomStore((s) => s.setPlayerReady);
  const updateSettings = useRoomStore((s) => s.updateSettings);
  const setHost = useRoomStore((s) => s.setHost);
  const setPlayerDisconnected = useRoomStore((s) => s.setPlayerDisconnected);

  const playerSetIsHost = usePlayerStore((s) => s.setIsHost);

  const setGameStatus = useGameStore((s) => s.setStatus);
  const setCountdown = useGameStore((s) => s.setCountdown);
  const setCurrentQuestion = useGameStore((s) => s.setCurrentQuestion);
  const setTimeRemaining = useGameStore((s) => s.setTimeRemaining);
  const markPlayerAnswered = useGameStore((s) => s.markPlayerAnswered);
  const setRoundResult = useGameStore((s) => s.setRoundResult);
  const startGame = useGameStore((s) => s.startGame);
  const finishGame = useGameStore((s) => s.finishGame);

  const setScreen = useUIStore((s) => s.setScreen);
  const setError = useUIStore((s) => s.setError);
  const setConnected = useUIStore((s) => s.setConnected);
  const setReconnecting = useUIStore((s) => s.setReconnecting);
  const addNotification = useUIStore((s) => s.addNotification);
  const setLoading = useUIStore((s) => s.setLoading);

  // Setup event listeners
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Connection events
    socket.on("connect", () => {
      console.log("Socket connected");
      setConnected(true);
      setReconnecting(false);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setReconnecting(true);
    });

    // Room events
    socket.on("room:joined", (room: Room, player: Player) => {
      setRoom(room);
      playerSetIsHost(player.isHost);
      setScreen("lobby");
      setLoading(false);
      addNotification({
        type: "success",
        message: player.isHost ? "Room créée !" : "Tu as rejoint la room !",
      });
    });

    socket.on("room:player_joined", (player: Player) => {
      addPlayer(player);
      addNotification({
        type: "info",
        message: `${player.name} a rejoint la partie`,
      });
    });

    socket.on("room:player_left", (playerId: string) => {
      const room = useRoomStore.getState().room;
      const player = room?.players.find((p) => p.id === playerId);
      removePlayer(playerId);
      if (player) {
        addNotification({
          type: "info",
          message: `${player.name} a quitté la partie`,
        });
      }
    });

    socket.on("room:player_ready", (playerId: string, isReady: boolean) => {
      setPlayerReady(playerId, isReady);
    });

    socket.on("room:settings_updated", (settings: GameSettings) => {
      updateSettings(settings);
    });

    socket.on("room:host_changed", (newHostId: string) => {
      const currentPlayerId = usePlayerStore.getState().playerId;
      setHost(newHostId);
      if (`player_${socket.id}` === newHostId || currentPlayerId === newHostId) {
        playerSetIsHost(true);
        addNotification({
          type: "info",
          message: "Tu es maintenant l'hôte !",
        });
      }
    });

    socket.on("room:error", (message: string) => {
      setError(message);
      setLoading(false);
    });

    // Game events
    socket.on("game:starting", (countdown: number) => {
      setCountdown(countdown);
      setScreen("game");
      const room = useRoomStore.getState().room;
      if (room) {
        startGame(room.settings.totalRounds);
      }
    });

    socket.on("game:round_start", (round: number, question: Question) => {
      setCurrentQuestion(question);
    });

    socket.on("game:time_update", (time: number) => {
      setTimeRemaining(time);
    });

    socket.on("game:player_answered", (playerId: string) => {
      markPlayerAnswered(playerId);
    });

    socket.on("game:round_end", (result: RoundResult) => {
      setRoundResult(result);
    });

    socket.on("game:leaderboard", (players: Player[]) => {
      const room = useRoomStore.getState().room;
      if (room) {
        useRoomStore.getState().setPlayers(players);
      }
      setGameStatus("leaderboard");
    });

    socket.on("game:finished", (finalScores: Player[]) => {
      useRoomStore.getState().setPlayers(finalScores);
      finishGame();
      setScreen("scoreboard");
    });

    // Connection events
    socket.on("connection:reconnected", (room: Room, player: Player) => {
      setRoom(room);
      playerSetIsHost(player.isHost);
      setReconnecting(false);
      setConnected(true);

      if (room.status === "playing") {
        setScreen("game");
      } else if (room.status === "finished") {
        setScreen("scoreboard");
      } else {
        setScreen("lobby");
      }

      addNotification({
        type: "success",
        message: "Reconnecté !",
      });
    });

    socket.on("connection:player_disconnected", (playerId: string) => {
      setPlayerDisconnected(playerId, false);
    });

    socket.on("connection:player_reconnected", (playerId: string) => {
      setPlayerDisconnected(playerId, true);
      const room = useRoomStore.getState().room;
      const player = room?.players.find((p) => p.id === playerId);
      if (player) {
        addNotification({
          type: "info",
          message: `${player.name} s'est reconnecté`,
        });
      }
    });

    return () => {
      socket.removeAllListeners();
      isInitialized.current = false;
    };
  }, []);

  // Actions
  const connect = useCallback(() => {
    connectSocket();
  }, []);

  const disconnect = useCallback(() => {
    disconnectSocket();
  }, []);

  const createRoom = useCallback((playerName: string, avatar: string) => {
    setLoading(true, "Création de la room...");
    connectSocket();
    socket.emit("room:create", playerName, avatar);
  }, [socket, setLoading]);

  const joinRoom = useCallback((roomCode: string, playerName: string, avatar: string) => {
    setLoading(true, "Connexion à la room...");
    connectSocket();
    socket.emit("room:join", roomCode, playerName, avatar);
  }, [socket, setLoading]);

  const leaveRoom = useCallback(() => {
    socket.emit("room:leave");
    setRoom(null);
    setScreen("home");
    useGameStore.getState().resetGame();
  }, [socket, setRoom, setScreen]);

  const setReady = useCallback((isReady: boolean) => {
    socket.emit("room:ready", isReady);
    usePlayerStore.getState().setIsReady(isReady);
  }, [socket]);

  const updateRoomSettings = useCallback((settings: Partial<GameSettings>) => {
    socket.emit("room:update_settings", settings);
  }, [socket]);

  const changeGameMode = useCallback((mode: string) => {
    socket.emit("room:change_game_mode", mode as "qcm" | "open" | "image" | "dictation");
  }, [socket]);

  const kickPlayer = useCallback((playerId: string) => {
    socket.emit("room:kick_player", playerId);
  }, [socket]);

  const startGameAction = useCallback(() => {
    socket.emit("game:start");
  }, [socket]);

  const submitAnswer = useCallback((answer: string) => {
    const canSubmit = useGameStore.getState().canSubmitAnswer();
    if (canSubmit) {
      socket.emit("game:submit_answer", answer);
      useGameStore.getState().submitAnswer(answer);
    }
  }, [socket]);

  const requestNextRound = useCallback(() => {
    socket.emit("game:request_next_round");
  }, [socket]);

  const reconnect = useCallback((roomCode: string, playerId: string) => {
    setReconnecting(true);
    connectSocket();
    socket.emit("connection:reconnect", roomCode, playerId);
  }, [socket, setReconnecting]);

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
