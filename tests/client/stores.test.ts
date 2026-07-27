import { describe, it, expect, beforeEach } from "vitest";
import { useRoomStore } from "../../src/stores/room-store";
import { useGameStore } from "../../src/stores/game-store";
import { usePlayerStore } from "../../src/stores/player-store";
import { useUIStore } from "../../src/stores/ui-store";
import type { Player, Question, Room, RoundResult } from "../../src/types";
import { DEFAULT_GAME_SETTINGS } from "../../src/types";

const player = (id: string, over: Partial<Player> = {}): Player => ({
  id,
  name: id.toUpperCase(),
  avatar: "🦊",
  isHost: false,
  isReady: false,
  isConnected: true,
  score: 0,
  roundScore: 0,
  loseStreak: 0,
  ...over,
});

const room = (players: Player[]): Room => ({
  code: "AB12",
  hostId: players[0]?.id ?? "p1",
  players,
  status: "waiting",
  gameMode: "open",
  settings: { ...DEFAULT_GAME_SETTINGS },
  currentRound: 0,
  totalRounds: 5,
  createdAt: Date.now(),
});

const question = (over: Partial<Question> = {}): Question =>
  ({
    id: "q1",
    type: "open",
    question: "Capitale de la France ?",
    answers: [],
    caseSensitive: false,
    timeLimit: 20,
    points: 100,
    ...over,
  }) as Question;

describe("roomStore", () => {
  beforeEach(() => useRoomStore.getState().resetRoom());

  it("mirrors the room's players into its own list", () => {
    useRoomStore.getState().setRoom(room([player("p1"), player("p2")]));
    expect(useRoomStore.getState().players.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("keeps room.players and players in step through every mutation", () => {
    const store = useRoomStore.getState();
    store.setRoom(room([player("p1")]));

    useRoomStore.getState().addPlayer(player("p2"));
    expect(useRoomStore.getState().room!.players).toHaveLength(2);
    expect(useRoomStore.getState().players).toHaveLength(2);

    useRoomStore.getState().removePlayer("p1");
    expect(useRoomStore.getState().room!.players.map((p) => p.id)).toEqual(["p2"]);
    expect(useRoomStore.getState().players.map((p) => p.id)).toEqual(["p2"]);
  });

  it("flags ready and connection state per player", () => {
    useRoomStore.getState().setRoom(room([player("p1"), player("p2")]));

    useRoomStore.getState().setPlayerReady("p2", true);
    expect(useRoomStore.getState().getPlayer("p2")!.isReady).toBe(true);
    expect(useRoomStore.getState().getPlayer("p1")!.isReady).toBe(false);

    useRoomStore.getState().setPlayerDisconnected("p2", false);
    expect(useRoomStore.getState().getPlayer("p2")!.isConnected).toBe(false);
  });

  it("moves the host crown to exactly one player", () => {
    useRoomStore.getState().setRoom(room([player("p1", { isHost: true }), player("p2")]));
    useRoomStore.getState().setHost("p2");

    const players = useRoomStore.getState().players;
    expect(players.filter((p) => p.isHost).map((p) => p.id)).toEqual(["p2"]);
    expect(useRoomStore.getState().room!.hostId).toBe("p2");
    expect(useRoomStore.getState().getHost()!.id).toBe("p2");
  });

  it("treats the host as ready when deciding if everyone is", () => {
    useRoomStore.getState().setRoom(room([player("p1", { isHost: true }), player("p2")]));
    expect(useRoomStore.getState().isAllReady()).toBe(false);

    useRoomStore.getState().setPlayerReady("p2", true);
    expect(useRoomStore.getState().isAllReady()).toBe(true);
    expect(useRoomStore.getState().getReadyCount()).toBe(1);
  });

  it("is not 'all ready' when there is nobody", () => {
    expect(useRoomStore.getState().isAllReady()).toBe(false);
  });

  it("merges settings without dropping the rest", () => {
    useRoomStore.getState().setRoom(room([player("p1")]));
    useRoomStore.getState().updateSettings({ roundDuration: 45 });

    const settings = useRoomStore.getState().room!.settings;
    expect(settings.roundDuration).toBe(45);
    expect(settings.maxPlayers).toBe(DEFAULT_GAME_SETTINGS.maxPlayers);
  });

  it("shrugs off mutations when there is no room", () => {
    expect(() => {
      useRoomStore.getState().updateSettings({ roundDuration: 45 });
      useRoomStore.getState().setGameMode("flag");
      useRoomStore.getState().incrementRound();
      useRoomStore.getState().updateRoomStatus("playing");
    }).not.toThrow();
    expect(useRoomStore.getState().room).toBeNull();
  });
});

describe("gameStore", () => {
  beforeEach(() => useGameStore.getState().resetGame());

  it("arms a fresh round and clears the previous one", () => {
    useGameStore.setState({ hasAnswered: true, myAnswer: "vieux", answeredPlayers: ["p1"] });

    useGameStore.getState().setCurrentQuestion(question(), 3);
    const state = useGameStore.getState();

    expect(state.currentRound).toBe(3);
    expect(state.status).toBe("question");
    expect(state.timeRemaining).toBe(20);
    expect(state.hasAnswered).toBe(false);
    expect(state.myAnswer).toBeNull();
    expect(state.answeredPlayers).toEqual([]);
    expect(state.roundResult).toBeNull();
  });

  it("keeps the current round when none is given", () => {
    useGameStore.getState().setCurrentQuestion(question(), 4);
    useGameStore.getState().setCurrentQuestion(question({ id: "q2" }));
    expect(useGameStore.getState().currentRound).toBe(4);
  });

  it("locks answering once an answer is in", () => {
    useGameStore.getState().setCurrentQuestion(question(), 1);
    expect(useGameStore.getState().canSubmitAnswer()).toBe(true);

    useGameStore.getState().submitAnswer("Paris");
    expect(useGameStore.getState().hasAnswered).toBe(true);
    expect(useGameStore.getState().myAnswer).toBe("Paris");
    expect(useGameStore.getState().canSubmitAnswer()).toBe(false);
  });

  it("refuses an answer once the clock hits zero", () => {
    useGameStore.getState().setCurrentQuestion(question(), 1);
    useGameStore.getState().setTimeRemaining(0);
    expect(useGameStore.getState().canSubmitAnswer()).toBe(false);
  });

  it("never lets the clock go negative", () => {
    useGameStore.getState().setCurrentQuestion(question(), 1);
    useGameStore.getState().setTimeRemaining(1);
    useGameStore.getState().decrementTime();
    useGameStore.getState().decrementTime();
    expect(useGameStore.getState().timeRemaining).toBe(0);
  });

  it("records who answered, once each", () => {
    useGameStore.getState().markPlayerAnswered("p1");
    useGameStore.getState().markPlayerAnswered("p2");
    useGameStore.getState().markPlayerAnswered("p1");
    expect(useGameStore.getState().answeredPlayers).toEqual(["p1", "p2"]);
  });

  it("goes through countdown → question → revealing → finished", () => {
    useGameStore.getState().startGame(5);
    expect(useGameStore.getState().status).toBe("countdown");
    expect(useGameStore.getState().totalRounds).toBe(5);

    useGameStore.getState().setCurrentQuestion(question(), 1);
    expect(useGameStore.getState().status).toBe("question");

    useGameStore.getState().setRoundResult({
      roundNumber: 1,
      question: question(),
      answers: [],
      correctAnswer: "Paris",
      scores: [],
    } as RoundResult);
    expect(useGameStore.getState().status).toBe("revealing");

    useGameStore.getState().finishGame();
    expect(useGameStore.getState().status).toBe("finished");
  });

  it("returns to a blank slate on reset", () => {
    useGameStore.getState().startGame(5);
    useGameStore.getState().setCurrentQuestion(question(), 2);
    useGameStore.getState().submitAnswer("x");

    useGameStore.getState().resetGame();
    const state = useGameStore.getState();
    expect(state.status).toBe("idle");
    expect(state.currentQuestion).toBeNull();
    expect(state.hasAnswered).toBe(false);
    expect(state.roundResult).toBeNull();
  });
});

describe("playerStore", () => {
  beforeEach(() => usePlayerStore.getState().resetAll());

  it("gives every player a stable, unique id", () => {
    const first = usePlayerStore.getState().playerId;
    expect(first).toBeTruthy();
    expect(usePlayerStore.getState().playerId).toBe(first);

    usePlayerStore.getState().resetAll();
    expect(usePlayerStore.getState().playerId).not.toBe(first);
  });

  it("trims the name it is given", () => {
    usePlayerStore.getState().setPlayerName("  Alice  ");
    expect(usePlayerStore.getState().playerName).toBe("Alice");
  });

  it("clears the session without forgetting who you are", () => {
    usePlayerStore.getState().setPlayerName("Alice");
    usePlayerStore.getState().setAvatar("🐼");
    const id = usePlayerStore.getState().playerId;
    usePlayerStore.setState({ isHost: true, isReady: true, score: 300 });

    usePlayerStore.getState().resetSession();
    const state = usePlayerStore.getState();
    expect(state).toMatchObject({ isHost: false, isReady: false, score: 0, roundScore: 0 });
    // Identity survives — that is what lets the handshake reconnect us.
    expect(state.playerId).toBe(id);
    expect(state.playerName).toBe("Alice");
    expect(state.avatar).toBe("🐼");
  });

  it("only persists the identity, never the per-game state", () => {
    usePlayerStore.getState().setPlayerName("Alice");
    usePlayerStore.setState({ score: 500, isHost: true });

    const raw = window.localStorage.getItem("quizz-arena-player");
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!).state;
    expect(Object.keys(persisted).sort()).toEqual(["avatar", "playerId", "playerName"]);
  });

  it("builds a Player from its own state", () => {
    usePlayerStore.getState().setPlayerName("Alice");
    const p = usePlayerStore.getState().getPlayer();
    expect(p.name).toBe("Alice");
    expect(p.isConnected).toBe(true);
    expect(p.id).toBe(usePlayerStore.getState().playerId);
  });
});

describe("uiStore", () => {
  beforeEach(() => useUIStore.getState().reset());

  it("clears the error when the screen changes", () => {
    useUIStore.getState().setError("boom");
    useUIStore.getState().setScreen("lobby");
    expect(useUIStore.getState().currentScreen).toBe("lobby");
    expect(useUIStore.getState().error).toBeNull();
  });

  it("raises a notification alongside an error", () => {
    useUIStore.getState().setError("boom");
    expect(useUIStore.getState().notifications.map((n) => n.message)).toContain("boom");
  });

  it("drops the loading message when loading stops", () => {
    useUIStore.getState().setLoading(true, "Création...");
    expect(useUIStore.getState().loadingMessage).toBe("Création...");

    useUIStore.getState().setLoading(false);
    expect(useUIStore.getState().loadingMessage).toBeNull();
  });

  it("gives notifications distinct ids and can remove them one by one", () => {
    useUIStore.getState().addNotification({ type: "info", message: "un" });
    useUIStore.getState().addNotification({ type: "info", message: "deux" });

    const [a, b] = useUIStore.getState().notifications;
    expect(a.id).not.toBe(b.id);

    useUIStore.getState().removeNotification(a.id);
    expect(useUIStore.getState().notifications.map((n) => n.message)).toEqual(["deux"]);
  });

  it("resets the reconnect counter once the socket is back", () => {
    useUIStore.getState().incrementReconnectAttempts();
    useUIStore.getState().incrementReconnectAttempts();
    expect(useUIStore.getState().reconnectAttempts).toBe(2);

    useUIStore.getState().setConnected(true);
    expect(useUIStore.getState().reconnectAttempts).toBe(0);
    expect(useUIStore.getState().isReconnecting).toBe(false);
  });

  it("keeps the attempt count while the socket is still down", () => {
    useUIStore.getState().incrementReconnectAttempts();
    useUIStore.getState().setConnected(false);
    expect(useUIStore.getState().reconnectAttempts).toBe(1);
  });
});
