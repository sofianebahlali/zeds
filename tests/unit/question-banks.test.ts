import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { getQuestions, getTotalCount, getThemeCounts, closeDb } from "../../server/question-db";

const QUESTIONS_DIR = path.resolve(__dirname, "../../data/questions");

const bankFiles = fs
  .readdirSync(QUESTIONS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("question bank files", () => {
  it("ships at least the banks the modes rely on", () => {
    expect(bankFiles.length).toBeGreaterThan(10);
  });

  it.each(bankFiles)("%s is valid JSON and not empty", (file) => {
    const raw = fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      expect(parsed.length, file).toBeGreaterThan(0);
    } else {
      expect(Object.keys(parsed).length, file).toBeGreaterThan(0);
    }
  });

  it("no longer ships a bank for a retired mode", () => {
    expect(bankFiles).not.toContain("dictation.json");
  });

  it("gives every question in an array-shaped bank an id and a type", () => {
    for (const file of bankFiles) {
      const parsed = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf-8"));
      if (!Array.isArray(parsed)) continue;
      // Some banks are plain data pools (countries, cities, word lists) rather
      // than question objects.
      const first = parsed[0] as unknown;
      const looksLikeQuestions =
        typeof first === "object" && first !== null && "type" in first && "id" in first;
      if (!looksLikeQuestions) continue;

      const ids = parsed.map((q: { id: string }) => q.id);
      expect(new Set(ids).size, `${file} has duplicate ids`).toBe(ids.length);
      for (const q of parsed as { id: string; type: string }[]) {
        expect(q.id, file).toBeTruthy();
        expect(q.type, file).toBeTruthy();
      }
    }
  });

  it("never references a retired question type", () => {
    for (const file of bankFiles) {
      const raw = fs.readFileSync(path.join(QUESTIONS_DIR, file), "utf-8");
      for (const retired of ['"type": "dictation"', '"type": "qcm"', '"type": "image"']) {
        expect(raw.includes(retired), `${file} still contains ${retired}`).toBe(false);
      }
    }
  });
});

describe("SQLite question bank", () => {
  // The native module is not always buildable (CI runners, mismatched ABI), and
  // the app is designed to fall back to its in-code pool. Both paths are valid;
  // what matters is that neither throws.
  const available = getTotalCount() > 0;

  it("answers about its size without throwing, present or not", () => {
    expect(() => getTotalCount()).not.toThrow();
    expect(getTotalCount()).toBeGreaterThanOrEqual(0);
  });

  it("returns an array whether or not the database is there", () => {
    const questions = getQuestions({ count: 5 });
    expect(Array.isArray(questions)).toBe(true);
    if (!available) expect(questions).toEqual([]);
  });

  it("hands out open questions only, now that QCM is gone", () => {
    if (!available) return;
    const questions = getQuestions({ count: 20 });

    for (const q of questions) {
      expect(q.type).toBe("open");
      expect(q.question).toBeTruthy();
      expect(q.answers.length).toBeGreaterThan(0);
      expect(q.answers[0]).toBeTruthy();
      expect(q.caseSensitive).toBe(false);
      expect(q.timeLimit).toBeGreaterThan(0);
      expect(q.points).toBeGreaterThan(0);
      expect(q.id).toMatch(/^db_\d+$/);
    }
  });

  it("honours the exclusion list so a session never repeats a question", () => {
    if (!available) return;
    const first = getQuestions({ count: 5 });
    const excluded = new Set(first.map((q) => Number(q.id.replace("db_", ""))));

    const second = getQuestions({ count: 5, excludeIds: excluded });
    for (const q of second) {
      expect(excluded.has(Number(q.id.replace("db_", "")))).toBe(false);
    }
  });

  it("never returns more than it was asked for", () => {
    if (!available) return;
    expect(getQuestions({ count: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("reports theme counts without throwing", () => {
    expect(() => getThemeCounts()).not.toThrow();
    const counts = getThemeCounts();
    for (const n of Object.values(counts)) expect(n).toBeGreaterThan(0);
  });

  it("closes cleanly, twice if need be", () => {
    expect(() => {
      closeDb();
      closeDb();
    }).not.toThrow();
  });
});
