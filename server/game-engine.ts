import { Server } from "socket.io";
import { RoomManager } from "./room-manager";
import type {
  Room,
  Player,
  Question,
  QCMQuestion,
  OpenQuestion,
  ImageQuestion,
  DictationQuestion,
  Answer,
  RoundResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from "../src/types";

type TypedIO = Server<ClientToServerEvents, ServerToClientEvents>;

// Sample questions for demo purposes
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "qcm",
    question: "Quelle est la capitale de la France ?",
    options: ["Lyon", "Paris", "Marseille", "Bordeaux"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q2",
    type: "qcm",
    question: "Combien de continents y a-t-il sur Terre ?",
    options: ["5", "6", "7", "8"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q3",
    type: "qcm",
    question: "Quel est le plus grand océan du monde ?",
    options: ["Atlantique", "Indien", "Pacifique", "Arctique"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q4",
    type: "open",
    question: "Quel animal est le meilleur ami de l'homme ?",
    answers: ["chien", "le chien", "un chien"],
    caseSensitive: false,
    timeLimit: 20,
    points: 150,
  },
  {
    id: "q5",
    type: "qcm",
    question: "En quelle année a eu lieu la Révolution française ?",
    options: ["1776", "1789", "1804", "1815"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q6",
    type: "qcm",
    question: "Quel est l'élément chimique avec le symbole 'O' ?",
    options: ["Or", "Osmium", "Oxygène", "Oganesson"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q7",
    type: "open",
    question: "Quelle planète est surnommée la planète rouge ?",
    answers: ["mars", "Mars"],
    caseSensitive: false,
    timeLimit: 15,
    points: 150,
  },
  {
    id: "q8",
    type: "qcm",
    question: "Combien de joueurs composent une équipe de football ?",
    options: ["9", "10", "11", "12"],
    correctIndex: 2,
    timeLimit: 15,
    points: 100,
  },
  {
    id: "q9",
    type: "qcm",
    question: "Quel est le plus long fleuve du monde ?",
    options: ["Amazone", "Nil", "Yangtsé", "Mississippi"],
    correctIndex: 1,
    timeLimit: 20,
    points: 100,
  },
  {
    id: "q10",
    type: "open",
    question: "Quel fruit est connu pour avoir fait tomber Newton ?",
    answers: ["pomme", "une pomme", "la pomme"],
    caseSensitive: false,
    timeLimit: 15,
    points: 150,
  },
];

export class GameEngine {
  private room: Room;
  private io: TypedIO;
  private roomManager: RoomManager;
  private currentRound: number = 0;
  private currentQuestion: Question | null = null;
  private answers: Map<string, Answer> = new Map();
  private timerInterval: NodeJS.Timeout | null = null;
  private timeRemaining: number = 0;
  private questions: Question[] = [];
  private disconnectedPlayers: Set<string> = new Set();

  constructor(room: Room, io: TypedIO, roomManager: RoomManager) {
    this.room = room;
    this.io = io;
    this.roomManager = roomManager;
    this.prepareQuestions();
  }

  /**
   * Prepare questions for the game
   */
  private prepareQuestions(): void {
    // Shuffle and select questions based on settings
    const shuffled = [...SAMPLE_QUESTIONS].sort(() => Math.random() - 0.5);
    this.questions = shuffled.slice(0, this.room.settings.totalRounds);
  }

  /**
   * Start the game
   */
  start(): void {
    this.roomManager.updateRoomStatus(this.room.code, "starting");

    // Send countdown
    let countdown = 3;
    this.io.to(this.room.code).emit("game:starting", countdown);

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.io.to(this.room.code).emit("game:starting", countdown);
      } else {
        clearInterval(countdownInterval);
        this.roomManager.updateRoomStatus(this.room.code, "playing");
        this.startRound();
      }
    }, 1000);
  }

  /**
   * Start a new round
   */
  private startRound(): void {
    this.currentRound++;
    this.answers.clear();
    this.roomManager.resetRoundScores(this.room.code);

    if (this.currentRound > this.questions.length) {
      this.finishGame();
      return;
    }

    this.currentQuestion = this.questions[this.currentRound - 1];
    this.timeRemaining = this.currentQuestion.timeLimit;

    // Update room state
    const room = this.roomManager.getRoom(this.room.code);
    if (room) {
      room.currentRound = this.currentRound;
    }

    // Send question to all players
    // For QCM, we need to hide the correct answer
    const questionForClient = this.sanitizeQuestionForClient(this.currentQuestion);
    this.io.to(this.room.code).emit("game:round_start", this.currentRound, questionForClient);

    // Start timer
    this.startTimer();
  }

  /**
   * Sanitize question before sending to clients (hide answer)
   */
  private sanitizeQuestionForClient(question: Question): Question {
    // Don't send the correct answer to clients for open questions
    if (question.type === "open") {
      return {
        ...question,
        answers: [], // Hide answers
      };
    }
    return question;
  }

  /**
   * Start the round timer
   */
  private startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.timeRemaining--;
      this.io.to(this.room.code).emit("game:time_update", this.timeRemaining);

      if (this.timeRemaining <= 0) {
        this.endRound();
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Submit an answer
   */
  submitAnswer(playerId: string, answerText: string): void {
    if (!this.currentQuestion) return;
    if (this.answers.has(playerId)) return; // Already answered
    if (this.timeRemaining <= 0) return; // Time's up

    const responseTime = this.currentQuestion.timeLimit - this.timeRemaining;

    const answer: Answer = {
      playerId,
      questionId: this.currentQuestion.id,
      answer: answerText,
      timestamp: Date.now(),
      responseTime,
    };

    this.answers.set(playerId, answer);

    // Notify others that player answered (without revealing the answer)
    this.io.to(this.room.code).emit("game:player_answered", playerId);

    // Check if everyone has answered
    const activePlayers = this.room.players.filter(
      (p) => p.isConnected && !this.disconnectedPlayers.has(p.id)
    );

    if (this.answers.size >= activePlayers.length) {
      this.endRound();
    }
  }

  /**
   * End the current round
   */
  private endRound(): void {
    this.stopTimer();

    if (!this.currentQuestion) return;

    // Calculate scores
    const results = this.calculateScores();

    // Update room status
    this.roomManager.updateRoomStatus(this.room.code, "between_rounds");

    // Send results
    this.io.to(this.room.code).emit("game:round_end", results);

    // Show leaderboard after a delay
    setTimeout(() => {
      const leaderboard = this.roomManager.getLeaderboard(this.room.code);
      this.io.to(this.room.code).emit("game:leaderboard", leaderboard);

      // Auto-proceed to next round after showing leaderboard
      if (this.room.settings.showLeaderboardBetweenRounds) {
        setTimeout(() => {
          this.nextRound();
        }, 5000);
      }
    }, 3000);
  }

  /**
   * Calculate scores for the round
   */
  private calculateScores(): RoundResult {
    if (!this.currentQuestion) {
      throw new Error("No current question");
    }

    const correctAnswer = this.getCorrectAnswer();
    const scores: { playerId: string; points: number; total: number }[] = [];
    let winner: Player | undefined;
    let fastestCorrectTime = Infinity;

    // Process each answer
    for (const [playerId, answer] of this.answers) {
      const isCorrect = this.checkAnswer(answer.answer);
      answer.isCorrect = isCorrect;

      let points = 0;
      if (isCorrect) {
        // Base points
        points = this.currentQuestion.points;

        // Speed bonus (up to 50% extra for fastest answers)
        const speedBonus = Math.floor(
          (this.currentQuestion.timeLimit - (answer.responseTime || 0)) /
            this.currentQuestion.timeLimit *
            (this.currentQuestion.points * 0.5)
        );
        points += speedBonus;

        answer.points = points;

        // Track fastest correct answer for winner
        if ((answer.responseTime || Infinity) < fastestCorrectTime) {
          fastestCorrectTime = answer.responseTime || Infinity;
          winner = this.room.players.find((p) => p.id === playerId);
        }

        // Update streak
        const player = this.room.players.find((p) => p.id === playerId);
        if (player) {
          player.streak++;
          // Streak bonus
          if (player.streak >= 3) {
            points += 50 * Math.min(player.streak - 2, 5);
          }
        }
      } else {
        // Reset streak on wrong answer
        const player = this.room.players.find((p) => p.id === playerId);
        if (player) {
          player.streak = 0;
        }
      }

      // Update player score
      const updatedPlayer = this.roomManager.updatePlayerScore(playerId, points);
      if (updatedPlayer) {
        scores.push({
          playerId,
          points,
          total: updatedPlayer.score,
        });
      }
    }

    // Players who didn't answer get 0 points
    for (const player of this.room.players) {
      if (!this.answers.has(player.id)) {
        player.streak = 0;
        scores.push({
          playerId: player.id,
          points: 0,
          total: player.score,
        });
      }
    }

    return {
      roundNumber: this.currentRound,
      question: this.currentQuestion,
      answers: Array.from(this.answers.values()),
      correctAnswer,
      winner,
      scores,
    };
  }

  /**
   * Get the correct answer for the current question
   */
  private getCorrectAnswer(): string {
    if (!this.currentQuestion) return "";

    switch (this.currentQuestion.type) {
      case "qcm":
        return (this.currentQuestion as QCMQuestion).options[
          (this.currentQuestion as QCMQuestion).correctIndex
        ];
      case "open":
        return (this.currentQuestion as OpenQuestion).answers[0];
      case "image":
        return (this.currentQuestion as ImageQuestion).answer;
      case "dictation":
        return (this.currentQuestion as DictationQuestion).answer;
      default:
        return "";
    }
  }

  /**
   * Check if an answer is correct
   */
  private checkAnswer(answer: string): boolean {
    if (!this.currentQuestion) return false;

    const normalizedAnswer = answer.trim().toLowerCase();

    switch (this.currentQuestion.type) {
      case "qcm": {
        const q = this.currentQuestion as QCMQuestion;
        const correctOption = q.options[q.correctIndex].toLowerCase();
        // Accept both the option text and the index
        return (
          normalizedAnswer === correctOption ||
          normalizedAnswer === String(q.correctIndex)
        );
      }
      case "open": {
        const q = this.currentQuestion as OpenQuestion;
        const validAnswers = q.answers.map((a) =>
          q.caseSensitive ? a.trim() : a.trim().toLowerCase()
        );
        const userAnswer = q.caseSensitive ? answer.trim() : normalizedAnswer;
        return validAnswers.includes(userAnswer);
      }
      case "image": {
        const q = this.currentQuestion as ImageQuestion;
        return normalizedAnswer === q.answer.toLowerCase();
      }
      case "dictation": {
        const q = this.currentQuestion as DictationQuestion;
        return normalizedAnswer === q.answer.toLowerCase();
      }
      default:
        return false;
    }
  }

  /**
   * Proceed to the next round
   */
  nextRound(): void {
    if (this.currentRound >= this.questions.length) {
      this.finishGame();
    } else {
      this.startRound();
    }
  }

  /**
   * Finish the game
   */
  private finishGame(): void {
    this.stopTimer();
    this.roomManager.updateRoomStatus(this.room.code, "finished");

    const finalScores = this.roomManager.getLeaderboard(this.room.code);
    this.io.to(this.room.code).emit("game:finished", finalScores);
  }

  /**
   * Handle player disconnect during game
   */
  handlePlayerDisconnect(playerId: string): void {
    this.disconnectedPlayers.add(playerId);

    // Check if remaining players have all answered
    const activePlayers = this.room.players.filter(
      (p) => p.isConnected && !this.disconnectedPlayers.has(p.id)
    );

    if (this.answers.size >= activePlayers.length && activePlayers.length > 0) {
      this.endRound();
    }

    // If only one player left, end the game
    if (activePlayers.length <= 1) {
      this.finishGame();
    }
  }

  /**
   * Handle player reconnect
   */
  handlePlayerReconnect(playerId: string): void {
    this.disconnectedPlayers.delete(playerId);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopTimer();
  }
}
