import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  startTestServer,
  createRoom,
  joinRoom,
  waitFor,
  waitForMaybe,
  collect,
  type TestServer,
  type TestClient,
} from "../helpers/test-server";
import { getGameEngine } from "../../server/socket-handlers";
import type { FootballConnectionQuestion, MissingClubQuestion, MysteryCareerQuestion, OpenQuestion, Player, Question, RoundResult } from "../../src/types";

/**
 * These drive the real GameEngine end to end. Rounds are advanced with
 * `game:request_next_round` rather than waiting out the 8s auto-advance.
 */
describe("game flow", () => {
  let server: TestServer;
  const clients: TestClient[] = [];

  const track = <T extends TestClient>(c: T) => {
    clients.push(c);
    return c;
  };

  beforeEach(async () => {
    server = await startTestServer();
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    await server.close();
  });

  /** Start a game and return the first question, skipping the 3s countdown. */
  async function startGame(host: TestClient, watchers: TestClient[] = []) {
    const countdowns = collect<[number]>(host, "game:starting");
    host.emit("game:start");
    const [round, question] = await waitFor<[number, Question]>(host, "game:round_start", 12_000);
    await Promise.all(watchers.map((w) => Promise.resolve()));
    return { round, question, countdowns };
  }

  it("counts down before the first round and reaches every player", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const guestRound = waitFor<[number, Question]>(guest, "game:round_start", 12_000);
    const { countdowns, round, question } = await startGame(host);

    expect(countdowns.map(([n]) => n)).toEqual([3, 2, 1]);
    expect(round).toBe(1);
    expect(question.type).toBe("open");

    const [guestRoundNumber] = await guestRound;
    expect(guestRoundNumber).toBe(1);
  });

  it("never ships the answer to the client", async () => {
    const { host } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);

    const { question } = await startGame(host);
    expect((question as OpenQuestion).answers).toEqual([]);
  });

  it("plays Connexion Foot with retries, speed points and a full reveal", async () => {
    const { host, code } = await createRoom(server, {
      playlist: [{
        mode: "footballconnection",
        rounds: 1,
        footballConnectionDifficulty: "mixed",
        footballConnectionFormats: ["club_club", "club_country", "initials"],
      }],
    });
    track(host);

    const { question } = await startGame(host);
    expect(question.type).toBe("footballconnection");
    expect((question as FootballConnectionQuestion).answers).toEqual([]);
    expect((question as FootballConnectionQuestion).answerCount).toBeGreaterThan(0);

    const truth = loadedQuestion(server, code, question.id) as FootballConnectionQuestion;
    const wrongResult = waitFor<[{ correct: boolean; attemptsRemaining: number }]>(
      host,
      "footballconnection:guess_result"
    );
    host.emit("footballconnection:submit_guess", "Personne Introuvable");
    expect((await wrongResult)[0]).toMatchObject({ correct: false, attemptsRemaining: 4 });

    await new Promise((resolve) => setTimeout(resolve, 1050));
    const guessResult = waitFor<[{ correct: boolean; points?: number }]>(
      host,
      "footballconnection:guess_result"
    );
    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("footballconnection:submit_guess", truth.answers[0].playerName);

    expect((await guessResult)[0]).toMatchObject({ correct: true });
    const [result] = await roundEnd;
    expect(result.question.type).toBe("footballconnection");
    expect((result.question as FootballConnectionQuestion).answers.length).toBeGreaterThan(0);
    expect(result.scores[0].points).toBeGreaterThanOrEqual(question.points);
    expect(result.correctAnswer).toContain(truth.answers[0].playerName);
  });

  it("plays Carrière mystère with server-side progressive clues and a full reveal", async () => {
    const { host, code } = await createRoom(server, {
      playlist: [{
        mode: "mysterycareer",
        rounds: 1,
        mysteryCareerDifficulty: "mixed",
      }],
    });
    track(host);

    const { question } = await startGame(host);
    expect(question.type).toBe("mysterycareer");
    const publicQuestion = question as MysteryCareerQuestion;
    expect(publicQuestion.playerName).toBe("");
    expect(publicQuestion.aliases).toEqual([]);
    expect(publicQuestion.playerId).toBe(0);
    expect(publicQuestion.clubs).toHaveLength(Math.min(3, publicQuestion.totalClubs));
    expect(publicQuestion.totalClubs).toBeGreaterThanOrEqual(3);

    const truth = loadedQuestion(server, code, question.id) as MysteryCareerQuestion;
    expect(publicQuestion.sportingCountry).toBe(truth.sportingCountry);
    const initiallyVisibleOrders = publicQuestion.clubs.map((club) => club.order);
    const nextClue = waitFor<[MysteryCareerQuestion["clubs"][number]]>(
      host,
      "mysterycareer:clue_revealed",
      3000
    );
    setRemainingTime(code, truth.timeLimit - truth.revealInterval);
    expect(initiallyVisibleOrders).not.toContain((await nextClue)[0].order);

    const wrongResult = waitFor<[{ correct: boolean; attemptsRemaining: number }]>(
      host,
      "mysterycareer:guess_result"
    );
    host.emit("mysterycareer:submit_guess", "Joueur Imaginaire");
    expect((await wrongResult)[0]).toMatchObject({ correct: false, attemptsRemaining: 4 });

    await new Promise((resolve) => setTimeout(resolve, 950));
    const guessResult = waitFor<[{ correct: boolean; normalizedPlayerName?: string; points?: number }]>(
      host,
      "mysterycareer:guess_result"
    );
    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("mysterycareer:submit_guess", truth.playerName);

    expect((await guessResult)[0]).toMatchObject({
      correct: true,
      normalizedPlayerName: truth.playerName,
    });
    const [result] = await roundEnd;
    expect(result.question.type).toBe("mysterycareer");
    expect((result.question as MysteryCareerQuestion).clubs).toHaveLength(truth.clubs.length);
    expect(result.correctAnswer).toBe(truth.playerName);
    expect(result.scores[0].points).toBeGreaterThanOrEqual(question.points);
  });

  it("plays Club manquant without leaking the gap and reveals the full career", async () => {
    const { host, code } = await createRoom(server, {
      playlist: [{
        mode: "missingclub",
        rounds: 1,
        missingClubDifficulty: "mixed",
      }],
    });
    track(host);

    const { question } = await startGame(host);
    expect(question.type).toBe("missingclub");
    const publicQuestion = question as MissingClubQuestion;
    expect(publicQuestion.missingClubName).toBe("");
    expect(publicQuestion.acceptedAnswers).toEqual([]);
    expect(publicQuestion.clubs[publicQuestion.missingIndex]).toMatchObject({
      teamId: 0,
      name: "",
      appearances: null,
      goals: null,
    });

    const truth = loadedQuestion(server, code, question.id) as MissingClubQuestion;
    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", truth.acceptedAnswers[0]);
    const [result] = await roundEnd;

    expect(result.correctAnswer).toBe(truth.missingClubName);
    expect((result.question as MissingClubQuestion).clubs[truth.missingIndex].name)
      .toBe(truth.missingClubName);
    expect(result.answers[0].isCorrect).toBe(true);
    expect(result.scores[0].points).toBeGreaterThan(question.points);
  });

  it("ends the round as soon as everyone has answered, and scores it", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const { question } = await startGame(host);
    const engineRoom = server.roomManager.getRoom(code)!;
    expect(engineRoom.status).toBe("playing");

    // Reach into the loaded pool for the real answer: the client never sees it.
    const truth = answerOf(server, code, question.id);

    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", truth);
    guest.emit("game:submit_answer", "réponse manifestement fausse");

    const [result] = await roundEnd;
    const byPlayer = Object.fromEntries(result.scores.map((s) => [s.playerId, s.points]));

    expect(byPlayer["host"]).toBe(question.points);
    expect(byPlayer["p2"]).toBe(0);
    expect(result.winner?.id).toBe("host");
    expect(result.correctAnswer).toBeTruthy();
  });

  // Regression: responseTime is 0 for an answer given inside the first second,
  // and `responseTime || Infinity` used to turn the fastest answer into the
  // slowest — leaving the round with no winner at all.
  it("crowns the fastest correct answer even when it lands instantly", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const { question } = await startGame(host);
    const truth = answerOf(server, code, question.id);

    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", truth);
    guest.emit("game:submit_answer", truth);
    const [result] = await roundEnd;

    expect(result.answers.map((a) => a.responseTime)).toContain(0);
    expect(result.winner?.id).toBe("host");
  });

  it("tells everyone who has answered, without leaking the answer", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);

    const answered = waitFor<[string]>(guest, "game:player_answered");
    host.emit("game:submit_answer", "peu importe");
    expect(await answered).toEqual(["host"]);
  });

  it("ignores a second answer from the same player", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    track(await joinRoom(server, code, "p2"));

    const { question } = await startGame(host);
    const truth = answerOf(server, code, question.id);

    host.emit("game:submit_answer", "première réponse fausse");
    host.emit("game:submit_answer", truth);

    // p2 never answers, so only the clock can end this round.
    setRemainingTime(code, 1);
    const [result] = await waitFor<[RoundResult]>(host, "game:round_end", 6000);
    const hostScore = result.scores.find((s) => s.playerId === "host")!;
    expect(hostScore.points).toBe(0);
  });

  it("plays every round of the playlist and then finishes", async () => {
    const { host } = await createRoom(server, { playlist: [{ mode: "open", rounds: 3 }] });
    track(host);

    const rounds = collect<[number, Question]>(host, "game:round_start");
    await startGame(host);

    for (let i = 0; i < 3; i++) {
      const ended = waitFor<[RoundResult]>(host, "game:round_end");
      host.emit("game:submit_answer", "peu importe");
      await ended;
      host.emit("game:request_next_round");
    }

    const [finalScores] = await waitFor<[Player[]]>(host, "game:finished");
    expect(rounds.map(([n]) => n)).toEqual([1, 2, 3]);
    expect(finalScores).toHaveLength(1);
  });

  it("emits mode_changed when the playlist crosses into another mode", async () => {
    const { host } = await createRoom(server, {
      playlist: [
        { mode: "open", rounds: 1 },
        { mode: "estimation", rounds: 1 },
      ],
    });
    track(host);

    const modes = collect<[string]>(host, "game:mode_changed");
    await startGame(host);

    const ended = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", "peu importe");
    await ended;

    host.emit("game:request_next_round");
    const [, second] = await waitFor<[number, Question]>(host, "game:round_start");

    expect(second.type).toBe("estimation");
    expect(modes.map(([m]) => m)).toEqual(["open", "estimation"]);
  });

  it("hides the real price during an estimation round and scores by proximity", async () => {
    const { host, code } = await createRoom(server, {
      playlist: [{ mode: "estimation", rounds: 1 }],
    });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    const { question } = await startGame(host);
    expect(question.type).toBe("estimation");
    // Sanitized: the client is handed 0 instead of the price.
    expect((question as { correctValue: number }).correctValue).toBe(0);

    const real = (loadedQuestion(server, code, question.id) as { correctValue: number }).correctValue;

    const roundEnd = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", String(real)); // spot on
    guest.emit("game:submit_answer", String(real * 10)); // wildly off
    const [result] = await roundEnd;

    const byPlayer = Object.fromEntries(result.scores.map((s) => [s.playerId, s.points]));
    expect(byPlayer["host"]).toBe(question.points);
    expect(byPlayer["p2"]).toBe(0);
    expect(result.winner?.id).toBe("host");
  });

  it("ends the round on its own when the timer runs out", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);

    await startGame(host);

    // Fast-forward: shorten the running round instead of waiting out 15-20s.
    setRemainingTime(code, 1);

    const [result] = await waitFor<[RoundResult]>(host, "game:round_end", 6000);
    expect(result.scores.find((s) => s.playerId === "host")!.points).toBe(0);
  });

  it("counts the timer down for the whole room", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);
    const ticks = collect<[number]>(guest, "game:time_update");

    const [first] = await waitFor<[number]>(guest, "game:time_update", 3000);
    const [second] = await waitFor<[number]>(guest, "game:time_update", 3000);

    expect(second).toBe(first - 1);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses to start the game for anyone but the host", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    guest.emit("game:start");
    const [message] = await waitFor<[string]>(guest, "room:error");
    expect(message).toBe("Only host can start the game");
    expect(await waitForMaybe(host, "game:starting", 300)).toBeNull();
  });

  it("ignores next-round requests from a non-host", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 2 }] });
    track(host);
    const guest = track(await joinRoom(server, code, "p2"));

    await startGame(host);
    const ended = waitFor<[RoundResult]>(host, "game:round_end");
    host.emit("game:submit_answer", "x");
    guest.emit("game:submit_answer", "y");
    await ended;

    guest.emit("game:request_next_round");
    expect(await waitForMaybe(host, "game:round_start", 500)).toBeNull();
  });

  it("resets scores when a game is started again", async () => {
    const { host, code } = await createRoom(server, { playlist: [{ mode: "open", rounds: 1 }] });
    track(host);

    server.roomManager.getRoom(code)!.players[0].score = 999;

    await startGame(host);
    expect(server.roomManager.getRoom(code)!.players[0].score).toBe(0);
  });
});

// ==========================================
// Peeking at server-side state the client is not allowed to see
// ==========================================

/** The engine's private fields, which tests are allowed to read. */
type EngineInternals = { questions: Question[]; timeRemaining: number };

function engineOf(code: string): EngineInternals {
  const engine = getGameEngine(code);
  if (!engine) throw new Error(`no engine for room ${code}`);
  return engine as unknown as EngineInternals;
}

function loadedQuestion(_server: TestServer, code: string, questionId: string): Question {
  const q = engineOf(code).questions.find((x) => x.id === questionId);
  if (!q) throw new Error(`question ${questionId} is not in the dealt pool`);
  return q;
}

/** The real answer, which the client is never sent. */
function answerOf(_server: TestServer, code: string, questionId: string): string {
  const q = loadedQuestion(_server, code, questionId);
  if (q.type !== "open") throw new Error(`question ${questionId} is ${q.type}, not open`);
  return q.answers[0];
}

/**
 * Cut the running round short. Waiting out a real 15-20s question would make
 * the suite unusable, and the engine offers no other way to hurry it along.
 */
function setRemainingTime(code: string, seconds: number) {
  engineOf(code).timeRemaining = seconds;
}
