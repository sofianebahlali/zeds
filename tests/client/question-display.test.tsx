import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionDisplay } from "../../src/features/game/question-display";
import { useGameStore } from "../../src/stores/game-store";
import { useRoomStore } from "../../src/stores/room-store";
import type { Player, Question, Room } from "../../src/types";
import { DEFAULT_GAME_SETTINGS } from "../../src/types";

const submitAnswer = vi.fn();

// The component only needs a way to send an answer; a live socket would just
// add flakiness.
vi.mock("../../src/hooks", () => ({
  useSocket: () => ({ submitAnswer }),
}));

const player = (id: string): Player => ({
  id,
  name: id.toUpperCase(),
  avatar: "🦊",
  isHost: false,
  isReady: false,
  isConnected: true,
  score: 0,
  roundScore: 0,
  loseStreak: 0,
});

function showQuestion(question: Question, players: Player[] = [player("p1"), player("p2")]) {
  useRoomStore.getState().setRoom({
    code: "AB12",
    hostId: "p1",
    players,
    status: "playing",
    gameMode: question.type,
    settings: { ...DEFAULT_GAME_SETTINGS },
    currentRound: 1,
    totalRounds: 3,
    createdAt: Date.now(),
  } as Room);
  useGameStore.getState().setCurrentQuestion(question, 1);
  return render(<QuestionDisplay />);
}

const openQuestion = {
  id: "q-open",
  type: "open",
  question: "Quelle est la capitale de la France ?",
  answers: [],
  caseSensitive: false,
  timeLimit: 20,
  points: 100,
} as Question;

const mathsQuestion = {
  id: "q-maths",
  type: "maths",
  question: "Combien font 2 + 2 ?",
  options: ["3", "4", "5", "6"],
  correctIndex: 1,
  category: "calcul",
  difficulty: "easy",
  timeLimit: 20,
  points: 100,
} as unknown as Question;

const flagQuestion = {
  id: "q-flag",
  type: "flag",
  cca3: "FRA",
  flagUrl: "/images/flags/fr.png",
  continent: "Europe",
  difficulty: "easy",
  countryName: "",
  acceptedAnswers: [],
  timeLimit: 20,
  points: 100,
} as unknown as Question;

describe("<QuestionDisplay />", () => {
  beforeEach(() => {
    submitAnswer.mockClear();
    useGameStore.getState().resetGame();
    useRoomStore.getState().resetRoom();
  });

  it("renders nothing without a question", () => {
    const { container } = render(<QuestionDisplay />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("open questions", () => {
    it("shows the prompt and an empty answer box", () => {
      showQuestion(openQuestion);

      expect(screen.getByText("Quelle est la capitale de la France ?")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Tape ta réponse...")).toHaveValue("");
    });

    it("keeps the submit button disabled until something is typed", async () => {
      const user = userEvent.setup();
      showQuestion(openQuestion);

      const submit = screen.getByRole("button", { name: /valider/i });
      expect(submit).toBeDisabled();

      await user.type(screen.getByPlaceholderText("Tape ta réponse..."), "Paris");
      expect(submit).toBeEnabled();
    });

    it("sends the trimmed answer", async () => {
      const user = userEvent.setup();
      showQuestion(openQuestion);

      await user.type(screen.getByPlaceholderText("Tape ta réponse..."), "  Paris  ");
      await user.click(screen.getByRole("button", { name: /valider/i }));

      expect(submitAnswer).toHaveBeenCalledWith("Paris");
    });

    it("submits on Enter", async () => {
      const user = userEvent.setup();
      showQuestion(openQuestion);

      await user.type(screen.getByPlaceholderText("Tape ta réponse..."), "Paris{Enter}");
      expect(submitAnswer).toHaveBeenCalledWith("Paris");
    });

    it("replaces the box with the answer once it is in", async () => {
      const user = userEvent.setup();
      showQuestion(openQuestion);

      await user.type(screen.getByPlaceholderText("Tape ta réponse..."), "Paris{Enter}");
      act(() => useGameStore.getState().submitAnswer("Paris"));

      expect(await screen.findByText("Ta réponse :")).toBeInTheDocument();
      expect(screen.getByText("Paris")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Tape ta réponse...")).not.toBeInTheDocument();
    });
  });

  describe("multiple-choice (maths) questions", () => {
    it("lists every option, lettered", () => {
      showQuestion(mathsQuestion);

      expect(screen.getByText("Combien font 2 + 2 ?")).toBeInTheDocument();
      for (const option of ["3", "4", "5", "6"]) {
        expect(screen.getByText(option)).toBeInTheDocument();
      }
      for (const letter of ["A", "B", "C", "D"]) {
        expect(screen.getByText(letter)).toBeInTheDocument();
      }
    });

    it("sends the index of the option tapped, not its text", async () => {
      const user = userEvent.setup();
      showQuestion(mathsQuestion);

      await user.click(screen.getByText("4").closest("button")!);
      expect(submitAnswer).toHaveBeenCalledWith("1");
    });

    it("stops accepting taps once an answer is in", async () => {
      const user = userEvent.setup();
      showQuestion(mathsQuestion);

      await user.click(screen.getByText("4").closest("button")!);
      act(() => useGameStore.getState().submitAnswer("1"));

      submitAnswer.mockClear();
      await user.click(screen.getByText("5").closest("button")!);
      expect(submitAnswer).not.toHaveBeenCalled();
    });
  });

  describe("flag questions", () => {
    it("shows the flag and asks for a country", () => {
      showQuestion(flagQuestion);

      const flag = screen.getByAltText("Drapeau à identifier");
      expect(flag).toHaveAttribute("src", "/images/flags/fr.png");
      expect(screen.getByText("Quel est ce pays ?")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Nom du pays...")).toBeInTheDocument();
    });

    it("falls back to a placeholder when the flag will not load", async () => {
      showQuestion(flagQuestion);

      const flag = screen.getByAltText("Drapeau à identifier");
      flag.dispatchEvent(new Event("error"));

      expect(await screen.findByText("Drapeau indisponible")).toBeInTheDocument();
    });

    it("sends what the player typed", async () => {
      const user = userEvent.setup();
      showQuestion(flagQuestion);

      await user.type(screen.getByPlaceholderText("Nom du pays..."), "France{Enter}");
      expect(submitAnswer).toHaveBeenCalledWith("France");
    });
  });

  describe("who has answered", () => {
    it("counts the answers in without naming them", () => {
      showQuestion(openQuestion);
      expect(screen.getByText("0/2 ont répondu")).toBeInTheDocument();

      act(() => useGameStore.getState().markPlayerAnswered("p2"));
      expect(screen.getByText("1/2 ont répondu")).toBeInTheDocument();
    });
  });

  describe("the timer", () => {
    it("is shown for a normal round", () => {
      showQuestion(openQuestion);
      expect(screen.getByText(/^\d+s?$/)).toBeInTheDocument();
    });

    it("is hidden during a chrono round, where guessing the time is the game", () => {
      showQuestion({
        id: "q-chrono",
        type: "chrono",
        targetDuration: 10,
        instruction: "Arrête à 10 secondes",
        timeLimit: 30,
        points: 100,
      } as unknown as Question);

      expect(screen.queryByText("Combien font 2 + 2 ?")).not.toBeInTheDocument();
      // The round is running but no countdown is on screen.
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
  });

  it("clears the typed answer when the next question arrives", async () => {
    const user = userEvent.setup();
    showQuestion(openQuestion);

    await user.type(screen.getByPlaceholderText("Tape ta réponse..."), "Paris");
    expect(screen.getByPlaceholderText("Tape ta réponse...")).toHaveValue("Paris");

    act(() =>
      useGameStore.getState().setCurrentQuestion({ ...openQuestion, id: "q-open-2" } as Question, 2)
    );
    expect(await screen.findByPlaceholderText("Tape ta réponse...")).toHaveValue("");
  });
});
