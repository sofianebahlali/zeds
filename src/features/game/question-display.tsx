"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle, Tag } from "lucide-react";
import Image from "next/image";
import { Button, Card, Input, TimerProgress, Badge, Avatar } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { QCMQuestion, OpenQuestion, EstimationQuestion } from "@/types";

export function QuestionDisplay() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const answeredPlayers = useGameStore((s) => s.answeredPlayers);
  const players = useRoomStore((s) => s.players);
  const { submitAnswer } = useSocket();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [priceGuess, setPriceGuess] = useState("");

  if (!currentQuestion) return null;

  const totalTime = currentQuestion.timeLimit;

  const handleSubmit = () => {
    if (hasAnswered) return;

    if (currentQuestion.type === "qcm" && selectedOption !== null) {
      submitAnswer(String(selectedOption));
    } else if (currentQuestion.type === "estimation" && priceGuess.trim()) {
      submitAnswer(priceGuess.trim());
    } else if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim());
    }
  };

  const handleOptionSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedOption(index);
    submitAnswer(String(index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Timer */}
      <div className="mb-6">
        <TimerProgress
          timeRemaining={timeRemaining}
          totalTime={totalTime}
          showTime
        />
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col">
        {currentQuestion.type === "qcm" && (
          <QCMQuestionView
            question={currentQuestion as QCMQuestion}
            selectedOption={selectedOption}
            hasAnswered={hasAnswered}
            onSelect={handleOptionSelect}
          />
        )}

        {currentQuestion.type === "estimation" && (
          <EstimationQuestionView
            question={currentQuestion as EstimationQuestion}
            guess={priceGuess}
            hasAnswered={hasAnswered}
            onChange={setPriceGuess}
            onSubmit={handleSubmit}
          />
        )}

        {(currentQuestion.type === "open" ||
          currentQuestion.type === "image" ||
          currentQuestion.type === "dictation") && (
          <OpenQuestionView
            question={currentQuestion as OpenQuestion}
            answer={textAnswer}
            hasAnswered={hasAnswered}
            onChange={setTextAnswer}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* Players who answered */}
      <div className="mt-4">
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {players.map((player) => {
            const hasPlayerAnswered = answeredPlayers.includes(player.id);
            return (
              <motion.div
                key={player.id}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: hasPlayerAnswered ? 1 : 0.8,
                  opacity: hasPlayerAnswered ? 1 : 0.4,
                }}
                className="relative"
              >
                <Avatar
                  emoji={player.avatar}
                  size="sm"
                  status={hasPlayerAnswered ? "answered" : undefined}
                />
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-xs text-surface-500 mt-2">
          {answeredPlayers.length}/{players.length} ont répondu
        </p>
      </div>
    </motion.div>
  );
}

interface QCMQuestionViewProps {
  question: QCMQuestion;
  selectedOption: number | null;
  hasAnswered: boolean;
  onSelect: (index: number) => void;
}

function QCMQuestionView({
  question,
  selectedOption,
  hasAnswered,
  onSelect,
}: QCMQuestionViewProps) {
  return (
    <>
      {/* Question text */}
      <div className="mb-6 py-6">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-center text-balance">
          {question.question}
        </h2>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 gap-3 flex-1">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08 }}
            onClick={() => onSelect(index)}
            disabled={hasAnswered}
            className={cn(
              "p-4 rounded-xl text-left",
              "border transition-colors duration-150",
              "flex items-center gap-4",
              "min-h-[60px]",
              selectedOption === index
                ? "border-brand-500 bg-brand-500/10"
                : "border-surface-700 bg-surface-900 hover:border-surface-500",
              hasAnswered && selectedOption !== index && "opacity-40"
            )}
          >
            <span
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center",
                "font-bold text-sm shrink-0",
                selectedOption === index
                  ? "bg-brand-500 text-white"
                  : "bg-surface-800 text-surface-400"
              )}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="text-base text-surface-100">{option}</span>
          </motion.button>
        ))}
      </div>

      {/* Answered indicator */}
      <AnimatePresence>
        {hasAnswered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 flex justify-center"
          >
            <Badge variant="primary" size="lg">
              <CheckCircle className="w-4 h-4 mr-1" />
              Réponse envoyée
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ==========================================
// ESTIMATION QUESTION VIEW (Le Juste Prix)
// ==========================================

interface EstimationQuestionViewProps {
  question: EstimationQuestion;
  guess: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function EstimationQuestionView({
  question,
  guess,
  hasAnswered,
  onChange,
  onSubmit,
}: EstimationQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const formattedGuess = guess
    ? `${parseFloat(guess.replace(",", ".")).toLocaleString("fr-FR")} ${question.unit}`
    : "";

  return (
    <>
      {/* Product image */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-4"
        >
          <div className="w-48 h-48 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-lg">
            <img
              src={question.imageUrl}
              alt={question.productName}
              className="w-full h-full object-contain p-2"
            />
          </div>
        </motion.div>
      )}

      {/* Product name & question */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <Tag className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-surface-300 capitalize">
            {question.category}
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          {question.productName}
        </h2>
        <p className="text-surface-400 text-sm mt-1">{question.question}</p>
      </div>

      {/* Price input */}
      <div className="flex-1 flex flex-col justify-end">
        {hasAnswered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Ton estimation :</p>
                  <p className="text-2xl font-display font-bold text-surface-100">
                    {formattedGuess}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Input
                value={guess}
                onChange={(e) => {
                  // Only allow numbers, dots, and commas
                  const val = e.target.value.replace(/[^\d.,]/g, "");
                  onChange(val);
                }}
                onKeyDown={handleKeyDown}
                placeholder="0"
                inputMode="decimal"
                autoFocus
                autoComplete="off"
                className="text-center text-2xl font-display font-bold pr-10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-surface-400">
                {question.unit}
              </span>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={!guess.trim()}
              rightIcon={<Send className="w-5 h-5" />}
            >
              Valider mon prix
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ==========================================
// OPEN QUESTION VIEW
// ==========================================

interface OpenQuestionViewProps {
  question: OpenQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function OpenQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: OpenQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div className="mb-6 py-6">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-center text-balance">
          {question.question}
        </h2>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        {hasAnswered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Ta réponse :</p>
                  <p className="text-lg font-medium text-surface-100">{answer}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <Input
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tape ta réponse..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={!answer.trim()}
              rightIcon={<Send className="w-5 h-5" />}
            >
              Valider
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
