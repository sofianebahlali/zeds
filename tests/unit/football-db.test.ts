import { afterAll, describe, expect, it } from "vitest";
import {
  closeFootballDb,
  findFootballConnections,
  findFootballPlayer,
  getFootballConnectionCandidates,
  getFootballDatabaseSummary,
  getMysteryCareerCandidates,
  getMissingClubCandidates,
} from "../../server/football-db";

describe("football database", () => {
  afterAll(() => closeFootballDb());

  it("contains a reusable career graph and a sizeable connection bank", () => {
    const summary = getFootballDatabaseSummary();
    expect(summary.players).toBeGreaterThanOrEqual(10_000);
    expect(summary.clubs).toBeGreaterThanOrEqual(2_000);
    expect(summary.careerSpells).toBeGreaterThanOrEqual(100_000);
    expect(summary.granularStatRows).toBeGreaterThanOrEqual(100_000);
    expect(summary.connections).toBeGreaterThanOrEqual(10_000);
  });

  it("supports every promised connection format and never creates country-country", () => {
    for (const format of ["club_club", "club_country", "initials"] as const) {
      const questions = getFootballConnectionCandidates({
        formats: [format],
        preferredDifficulty: "mixed",
        limit: 100,
      });
      expect(questions).toHaveLength(100);
      expect(questions.every((question) => question.format === format)).toBe(true);
      expect(questions.every((question) => question.answers.length > 0)).toBe(true);
      expect(questions.some(
        (question) => question.left.kind === "country" && question.right.kind === "country"
      )).toBe(false);
    }
  });

  it("contains the three reference answers", () => {
    const hasAnswer = (left: string, right: string, player: string) =>
      findFootballConnections(left, right).some((question) =>
        question.answers.some((answer) => answer.playerName === player)
      );

    expect(
      hasAnswer("Real Madrid", "Manchester United", "Cristiano Ronaldo")
      || hasAnswer("Manchester United", "Real Madrid", "Cristiano Ronaldo")
    ).toBe(true);
    expect(hasAnswer("Manchester United", "Allemagne", "Bastian Schweinsteiger")).toBe(true);
    expect(hasAnswer("L", "M", "Lionel Messi")).toBe(true);
  });

  it("serves player profiles with club totals when available", () => {
    const ronaldo = findFootballPlayer("cr7");
    expect(ronaldo?.displayName).toBe("Cristiano Ronaldo");
    expect(ronaldo?.birthDate).toBe("1985-02-05");
    expect(ronaldo?.clubs.some(
      (club) => club.name === "Real Madrid" && (club.goals ?? 0) > 300
    )).toBe(true);
  });

  it("builds sizeable, chronological mystery careers from recorded appearances", () => {
    const questions = getMysteryCareerCandidates({
      preferredDifficulty: "mixed",
      limit: 100,
    });

    expect(questions).toHaveLength(100);
    for (const question of questions) {
      expect(question.type).toBe("mysterycareer");
      expect(question.playerName).toBeTruthy();
      expect(question.aliases).toContain(question.playerName);
      expect(question.clubs.length).toBeGreaterThanOrEqual(3);
      expect(question.totalClubs).toBe(question.clubs.length);
      expect(question.clubs.every((club) => (club.appearances ?? 0) > 0)).toBe(true);
      expect(question.clubs.map((club) => club.order)).toEqual(
        question.clubs.map((_, index) => index)
      );
    }
  });

  it("builds missing-club cards with one interior gap and private aliases", () => {
    const questions = getMissingClubCandidates({
      preferredDifficulty: "mixed",
      limit: 100,
    });

    expect(questions).toHaveLength(100);
    for (const question of questions) {
      expect(question.type).toBe("missingclub");
      expect(question.missingIndex).toBeGreaterThan(0);
      expect(question.missingIndex).toBeLessThan(question.clubs.length - 1);
      expect(question.missingClubName).toBe(question.clubs[question.missingIndex].name);
      expect(question.acceptedAnswers).toContain(question.missingClubName);
      expect(question.clubs[question.missingIndex].appearances).toBeGreaterThanOrEqual(3);
    }
  });
});
