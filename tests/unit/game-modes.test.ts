import { describe, it, expect } from "vitest";
import {
  GAME_MODES,
  GAME_MODE_CATEGORIES,
  GAME_PRESETS,
  DEFAULT_PLAYLIST,
  DEFAULT_GAME_SETTINGS,
  type GameMode,
  type GameModeConfig,
  type MysteryCareerQuestion,
  type MissingClubQuestion,
  type RoundResult,
} from "../../src/types";
import { GameEngine } from "../../server/game-engine";
import { RoomManager } from "../../server/room-manager";
import type { Room } from "../../src/types";

const ALL_MODE_IDS = GAME_MODES.map((m) => m.id);

/** Modes that were removed from the game and must not creep back in. */
const RETIRED_MODES = ["dictation", "image", "qcm"];

describe("game mode catalogue", () => {
  it("has no duplicate ids", () => {
    expect(new Set(ALL_MODE_IDS).size).toBe(ALL_MODE_IDS.length);
  });

  it("gives every mode a name, a description, an icon and a gradient", () => {
    for (const mode of GAME_MODES) {
      expect(mode.name, mode.id).toBeTruthy();
      expect(mode.description, mode.id).toBeTruthy();
      expect(mode.icon, mode.id).toBeTruthy();
      expect(mode.color, mode.id).toMatch(/^from-/);
    }
  });

  it("files every mode under a declared category", () => {
    const categories = new Set(GAME_MODE_CATEGORIES.map((c) => c.id));
    for (const mode of GAME_MODES) {
      expect(categories, mode.id).toContain(mode.category);
    }
  });

  it("leaves no category empty", () => {
    for (const category of GAME_MODE_CATEGORIES) {
      expect(GAME_MODES.filter((m) => m.category === category.id).length).toBeGreaterThan(0);
    }
  });

  it("no longer advertises the retired modes", () => {
    for (const retired of RETIRED_MODES) {
      expect(ALL_MODE_IDS).not.toContain(retired);
    }
  });
});

describe("playlists and presets", () => {
  it("builds the default playlist out of real modes", () => {
    for (const segment of DEFAULT_PLAYLIST) {
      expect(ALL_MODE_IDS, segment.mode).toContain(segment.mode);
      expect(segment.rounds).toBeGreaterThan(0);
    }
  });

  it("keeps DEFAULT_GAME_SETTINGS coherent with its playlist", () => {
    expect(DEFAULT_GAME_SETTINGS.playlist).toBe(DEFAULT_PLAYLIST);
    expect(DEFAULT_GAME_SETTINGS.maxPlayers).toBeGreaterThan(1);
    expect(DEFAULT_GAME_SETTINGS.roundDuration).toBeGreaterThan(0);
  });

  it("builds every preset out of real modes", () => {
    for (const preset of GAME_PRESETS) {
      expect(preset.playlist.length, preset.id).toBeGreaterThan(0);
      for (const segment of preset.playlist) {
        expect(ALL_MODE_IDS, `${preset.id} → ${segment.mode}`).toContain(segment.mode);
        expect(segment.rounds, `${preset.id} → ${segment.mode}`).toBeGreaterThan(0);
      }
    }
  });

  it("gives every preset a distinct id and a presentable card", () => {
    const ids = GAME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of GAME_PRESETS) {
      expect(preset.name, preset.id).toBeTruthy();
      expect(preset.description, preset.id).toBeTruthy();
      expect(preset.icon, preset.id).toBeTruthy();
      expect(preset.gradient, preset.id).toMatch(/^from-/);
    }
  });

  it("never references a retired mode", () => {
    const referenced = [
      ...DEFAULT_PLAYLIST.map((s) => s.mode),
      ...GAME_PRESETS.flatMap((p) => p.playlist.map((s) => s.mode)),
    ];
    for (const retired of RETIRED_MODES) {
      expect(referenced).not.toContain(retired);
    }
  });
});

describe("every advertised mode can actually deal questions", () => {
  /**
   * The catalogue is one thing; a mode whose data file is missing or renamed is
   * another. This builds a real engine per mode and checks it dealt the rounds
   * it was asked for, with a question of the right type.
   */
  const dealFor = (
    mode: GameMode,
    rounds: number,
    config: Partial<GameModeConfig> = {}
  ) => {
    const roomManager = new RoomManager();
    const room: Room = {
      code: "TEST",
      hostId: "p1",
      players: [
        {
          id: "p1",
          name: "P1",
          avatar: "🦊",
          isHost: true,
          isReady: true,
          isConnected: true,
          score: 0,
          roundScore: 0,
          loseStreak: 0,
        },
      ],
      status: "waiting",
      gameMode: mode,
      settings: {
        ...DEFAULT_GAME_SETTINGS,
        playlist: [{ mode, rounds, ...config }],
        totalRounds: rounds,
      },
      currentRound: 0,
      totalRounds: rounds,
      createdAt: Date.now(),
    };

    const io = {
      to: () => ({ emit: () => {} }),
    } as never;

    const engine = new GameEngine(room, io, roomManager);
    const questions = (engine as unknown as { questions: { type: string; id: string }[] }).questions;
    engine.destroy();
    return questions;
  };

  it.each(GAME_MODES.map((m) => [m.id, m.name] as const))(
    "%s (%s) deals a full segment",
    (mode) => {
      const questions = dealFor(mode, 3);
      expect(questions.length, `${mode} dealt nothing`).toBe(3);
      for (const q of questions) {
        expect(q.type, `${mode} dealt a ${q.type}`).toBe(mode);
        expect(q.id).toBeTruthy();
      }
    }
  );

  it.each(GAME_MODES.map((m) => [m.id] as const))("%s gives every question a timer and a value", (mode) => {
    const questions = dealFor(mode, 2) as unknown as { timeLimit: number; points: number }[];
    for (const q of questions) {
      expect(q.timeLimit, `${mode}`).toBeGreaterThan(0);
      expect(q.points, `${mode}`).toBeGreaterThan(0);
    }
  });

  it("does not repeat a question inside one segment", () => {
    // Checked on the modes with the smallest pools, where collisions would show.
    for (const mode of ["flag", "capital", "countrylocate", "citylocate"] as GameMode[]) {
      const ids = dealFor(mode, 8).map((q) => q.id);
      expect(new Set(ids).size, mode).toBe(ids.length);
    }
  });

  it("keeps a requested Connexion Foot format while completing a narrow difficulty bucket", () => {
    const questions = dealFor("footballconnection", 10, {
      footballConnectionDifficulty: "easy",
      footballConnectionFormats: ["initials"],
    }) as unknown as { id: string; format: string }[];

    expect(questions).toHaveLength(10);
    expect(questions.every((question) => question.format === "initials")).toBe(true);
    expect(new Set(questions.map((question) => question.id)).size).toBe(10);
  });

  it("plays a mixed playlist in the order it was given", () => {
    const roomManager = new RoomManager();
    const playlist = [
      { mode: "open" as GameMode, rounds: 2 },
      { mode: "flag" as GameMode, rounds: 2 },
      { mode: "estimation" as GameMode, rounds: 1 },
    ];
    const room: Room = {
      code: "MIX1",
      hostId: "p1",
      players: [
        {
          id: "p1",
          name: "P1",
          avatar: "🦊",
          isHost: true,
          isReady: true,
          isConnected: true,
          score: 0,
          roundScore: 0,
          loseStreak: 0,
        },
      ],
      status: "waiting",
      gameMode: "open",
      settings: { ...DEFAULT_GAME_SETTINGS, playlist, totalRounds: 5, shufflePlaylist: false },
      currentRound: 0,
      totalRounds: 5,
      createdAt: Date.now(),
    };

    const engine = new GameEngine(room, { to: () => ({ emit: () => {} }) } as never, roomManager);
    const types = (engine as unknown as { questions: { type: string }[] }).questions.map((q) => q.type);
    engine.destroy();

    expect(types).toEqual(["open", "open", "flag", "flag", "estimation"]);
    // …and the room's round count is corrected to what was actually dealt.
    expect(room.totalRounds).toBe(5);
  });
});

describe("Carrière mystère engine", () => {
  it("hides the identity, accepts aliases and awards the early-clue bonus", () => {
    const roomManager = new RoomManager();
    const room = roomManager.createRoom({
      id: "p1",
      name: "P1",
      avatar: "🦊",
      isHost: true,
      isReady: true,
      isConnected: true,
      score: 0,
      roundScore: 0,
      loseStreak: 0,
    });
    room.settings.playlist = [{
      mode: "mysterycareer",
      rounds: 1,
      mysteryCareerDifficulty: "easy",
    }];
    room.settings.totalRounds = 1;
    room.totalRounds = 1;
    room.gameMode = "mysterycareer";
    roomManager.mapSocketToPlayer("socket-p1", "p1");

    const emitted: { target: string; event: string; args: unknown[] }[] = [];
    const io = {
      to: (target: string) => ({
        emit: (event: string, ...args: unknown[]) => {
          emitted.push({ target, event, args });
        },
      }),
    } as never;
    const engine = new GameEngine(room, io, roomManager);
    const internals = engine as unknown as {
      questions: MysteryCareerQuestion[];
      currentQuestion: MysteryCareerQuestion | null;
      currentRound: number;
      timeRemaining: number;
      mysteryCareerLastAttemptAt: Map<string, number>;
      sanitizeQuestionForClient: (question: MysteryCareerQuestion) => MysteryCareerQuestion;
    };
    const truth = internals.questions[0];
    const publicQuestion = internals.sanitizeQuestionForClient(truth);

    expect(publicQuestion.playerName).toBe("");
    expect(publicQuestion.playerId).toBe(0);
    expect(publicQuestion.aliases).toEqual([]);
    expect(publicQuestion.clubs).toEqual([truth.clubs[0]]);

    internals.currentQuestion = truth;
    internals.currentRound = 1;
    internals.timeRemaining = truth.timeLimit;
    engine.submitMysteryCareerGuess("p1", "réponse impossible");
    expect(emitted.find((entry) => entry.event === "mysterycareer:guess_result")?.args[0])
      .toMatchObject({ correct: false, attemptsRemaining: 2 });

    internals.mysteryCareerLastAttemptAt.set("p1", 0);
    engine.submitMysteryCareerGuess("p1", truth.aliases[0]);
    const correct = emitted
      .filter((entry) => entry.event === "mysterycareer:guess_result")
      .at(-1)?.args[0];
    expect(correct).toMatchObject({
      correct: true,
      normalizedPlayerName: truth.playerName,
    });
    const result = emitted.find((entry) => entry.event === "game:round_end")
      ?.args[0] as RoundResult;
    expect(result.correctAnswer).toBe(truth.playerName);
    expect(result.question).toBe(truth);
    expect(result.scores[0].points).toBeGreaterThan(truth.points);

    engine.destroy();
  });
});

describe("Club manquant engine", () => {
  it("redacts the gap and fuzzy-scores a valid club with a speed bonus", () => {
    const roomManager = new RoomManager();
    const room = roomManager.createRoom({
      id: "p1",
      name: "P1",
      avatar: "🦊",
      isHost: true,
      isReady: true,
      isConnected: true,
      score: 0,
      roundScore: 0,
      loseStreak: 0,
    });
    room.settings.playlist = [{
      mode: "missingclub",
      rounds: 1,
      missingClubDifficulty: "easy",
    }];
    room.settings.totalRounds = 1;
    room.totalRounds = 1;
    room.gameMode = "missingclub";

    const emitted: { event: string; args: unknown[] }[] = [];
    const io = {
      to: () => ({
        emit: (event: string, ...args: unknown[]) => emitted.push({ event, args }),
      }),
    } as never;
    const engine = new GameEngine(room, io, roomManager);
    const internals = engine as unknown as {
      questions: MissingClubQuestion[];
      currentQuestion: MissingClubQuestion | null;
      currentRound: number;
      timeRemaining: number;
      sanitizeQuestionForClient: (question: MissingClubQuestion) => MissingClubQuestion;
    };
    const truth = internals.questions[0];
    const publicQuestion = internals.sanitizeQuestionForClient(truth);
    const hidden = publicQuestion.clubs[publicQuestion.missingIndex];

    expect(publicQuestion.missingClubName).toBe("");
    expect(publicQuestion.acceptedAnswers).toEqual([]);
    expect(hidden).toMatchObject({ teamId: 0, name: "", appearances: null, goals: null });
    expect(hidden.fromYear).toBe(truth.clubs[truth.missingIndex].fromYear);

    internals.currentQuestion = truth;
    internals.currentRound = 1;
    internals.timeRemaining = truth.timeLimit;
    engine.submitAnswer("p1", truth.acceptedAnswers[0]);

    const result = emitted.find((entry) => entry.event === "game:round_end")
      ?.args[0] as RoundResult;
    expect(result.correctAnswer).toBe(truth.missingClubName);
    expect(result.answers[0].isCorrect).toBe(true);
    expect(result.scores[0].points).toBe(150);

    engine.destroy();
  });
});
