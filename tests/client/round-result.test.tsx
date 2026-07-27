import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { RoundResult } from "../../src/features/game/round-result";
import { useGameStore } from "../../src/stores/game-store";
import { useRoomStore } from "../../src/stores/room-store";
import { usePlayerStore } from "../../src/stores/player-store";
import { useChatStore } from "../../src/stores/chat-store";
import type { Player, Question, Room, RoundResult as RoundResultType } from "../../src/types";
import { DEFAULT_GAME_SETTINGS } from "../../src/types";

vi.mock("../../src/hooks", () => ({
  useSocket: () => ({ sendLaughReaction: vi.fn() }),
}));

const player = (id: string, score = 0): Player => ({
  id,
  name: id.toUpperCase(),
  avatar: "🦊",
  isHost: id === "me",
  isReady: false,
  isConnected: true,
  score,
  roundScore: 0,
  loseStreak: 0,
});

const openQuestion = {
  id: "q1",
  type: "open",
  question: "Capitale de la France ?",
  answers: [],
  caseSensitive: false,
  timeLimit: 20,
  points: 100,
} as Question;

function showResult(result: Partial<RoundResultType> & { question?: Question } = {}) {
  const players = [player("me", 100), player("p2", 0)];
  useRoomStore.getState().setRoom({
    code: "AB12",
    hostId: "me",
    players,
    status: "between_rounds",
    gameMode: "open",
    settings: { ...DEFAULT_GAME_SETTINGS },
    currentRound: 1,
    totalRounds: 3,
    createdAt: Date.now(),
  } as Room);

  const full: RoundResultType = {
    roundNumber: 1,
    question: openQuestion,
    answers: [
      { playerId: "me", questionId: "q1", answer: "Paris", timestamp: 0, isCorrect: true, points: 100 },
      { playerId: "p2", questionId: "q1", answer: "Lyon", timestamp: 0, isCorrect: false, points: 0 },
    ],
    correctAnswer: "Paris",
    winner: players[0],
    scores: [
      { playerId: "me", points: 100, total: 100 },
      { playerId: "p2", points: 0, total: 0 },
    ],
    ...result,
  } as RoundResultType;

  useGameStore.getState().setRoundResult(full);
  return render(<RoundResult />);
}

describe("<RoundResult />", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useRoomStore.getState().resetRoom();
    useChatStore.getState().reset();
    usePlayerStore.setState({ playerId: "me" });
  });

  it("renders nothing before there is a result", () => {
    const { container } = render(<RoundResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it("congratulates the player who got it right", () => {
    showResult();

    expect(screen.getByText("Bonne réponse !")).toBeInTheDocument();
    expect(screen.getByText("+100 points")).toBeInTheDocument();
  });

  it("commiserates with the player who did not", () => {
    usePlayerStore.setState({ playerId: "p2" });
    showResult();

    expect(screen.getByText("Raté !")).toBeInTheDocument();
    expect(screen.getByText("0 points")).toBeInTheDocument();
  });

  it("always reveals the right answer", () => {
    showResult();

    expect(screen.getByText("La bonne réponse était :")).toBeInTheDocument();
    // "Paris" shows twice: as the reveal, and as the answer this player gave.
    expect(screen.getAllByText("Paris").length).toBeGreaterThanOrEqual(1);
  });

  it("names the winner of the round", () => {
    showResult();
    // Once on the winner card, once in the score list.
    expect(screen.getAllByText("ME")).toHaveLength(2);
    expect(screen.getByText("Le plus rapide !")).toBeInTheDocument();
  });

  it("shows every player's answer, including the wrong ones", () => {
    showResult();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
  });

  it("still lists a player who stayed silent, with no answer line", () => {
    showResult({
      answers: [
        { playerId: "me", questionId: "q1", answer: "Paris", timestamp: 0, isCorrect: true, points: 100 },
      ],
      scores: [
        { playerId: "me", points: 100, total: 100 },
        { playerId: "p2", points: 0, total: 0 },
      ],
    });

    // P2 appears in the score list…
    expect(screen.getByText("P2")).toBeInTheDocument();
    // …but with no answer to show for it.
    expect(screen.queryByText("Lyon")).not.toBeInTheDocument();
  });

  describe("estimation rounds", () => {
    const estimationQuestion = {
      id: "q-est",
      type: "estimation",
      question: "Combien coûte cet objet ?",
      productName: "Un grille-pain",
      imageUrl: "/x.jpg",
      correctValue: 100,
      unit: "€",
      category: "maison",
      difficulty: "easy",
      timeLimit: 20,
      points: 100,
    } as unknown as Question;

    it("labels the reveal as the real price and names the product", () => {
      showResult({
        question: estimationQuestion,
        correctAnswer: "100 €",
        answers: [
          { playerId: "me", questionId: "q-est", answer: "95", timestamp: 0, isCorrect: true, points: 90 },
        ],
        scores: [
          { playerId: "me", points: 90, total: 90 },
          { playerId: "p2", points: 0, total: 0 },
        ],
      });

      expect(screen.getByText("Le vrai prix :")).toBeInTheDocument();
      expect(screen.getByText("100 €")).toBeInTheDocument();
      expect(screen.getByText("Un grille-pain")).toBeInTheDocument();
    });

    it("shows each guess with how far off it was", () => {
      showResult({
        question: estimationQuestion,
        correctAnswer: "100 €",
        answers: [
          { playerId: "me", questionId: "q-est", answer: "80", timestamp: 0, isCorrect: false, points: 40 },
        ],
        scores: [
          { playerId: "me", points: 40, total: 40 },
          { playerId: "p2", points: 0, total: 0 },
        ],
      });

      expect(screen.getByText("80 € (20% d'écart)")).toBeInTheDocument();
    });

    it("uses the estimation wording for the verdict", () => {
      showResult({
        question: estimationQuestion,
        correctAnswer: "100 €",
        scores: [
          { playerId: "me", points: 95, total: 95 },
          { playerId: "p2", points: 0, total: 0 },
        ],
      });

      expect(screen.getByText("Bien estimé !")).toBeInTheDocument();
    });
  });

  describe("multiple-choice rounds", () => {
    it("turns the submitted index back into the option's text", () => {
      showResult({
        question: {
          id: "q-maths",
          type: "maths",
          question: "2 + 2 ?",
          options: ["3", "4", "5", "6"],
          correctIndex: 1,
          category: "calcul",
          difficulty: "easy",
          timeLimit: 20,
          points: 100,
        } as unknown as Question,
        correctAnswer: "4",
        answers: [
          { playerId: "p2", questionId: "q-maths", answer: "2", timestamp: 0, isCorrect: false, points: 0 },
        ],
        scores: [
          { playerId: "me", points: 0, total: 0 },
          { playerId: "p2", points: 0, total: 0 },
        ],
      });

      // p2 sent "2"; the card must read the option, not the raw index.
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  describe("flag rounds", () => {
    it("reveals the country, its flag and its continent", () => {
      showResult({
        question: {
          id: "q-flag",
          type: "flag",
          cca3: "FRA",
          flagUrl: "/images/flags/fr.png",
          continent: "Europe",
          difficulty: "easy",
          countryName: "France",
          acceptedAnswers: ["France"],
          timeLimit: 20,
          points: 100,
        } as unknown as Question,
        correctAnswer: "France",
      });

      expect(screen.getByText("Le pays était :")).toBeInTheDocument();
      expect(screen.getByText("France")).toBeInTheDocument();
      expect(screen.getByText("Europe")).toBeInTheDocument();
      expect(document.querySelector('img[src="/images/flags/fr.png"]')).not.toBeNull();
    });
  });

  it("updates when the next round's result comes in", () => {
    showResult();
    expect(screen.getAllByText("Paris").length).toBeGreaterThan(0);

    act(() =>
      useGameStore.getState().setRoundResult({
        roundNumber: 2,
        question: { ...openQuestion, id: "q2", question: "Capitale de l'Italie ?" } as Question,
        answers: [],
        correctAnswer: "Rome",
        scores: [
          { playerId: "me", points: 0, total: 100 },
          { playerId: "p2", points: 0, total: 0 },
        ],
      } as RoundResultType)
    );

    expect(screen.getByText("Rome")).toBeInTheDocument();
    expect(screen.queryAllByText("Paris")).toHaveLength(0);
  });
});
