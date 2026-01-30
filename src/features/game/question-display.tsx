"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle } from "lucide-react";
import { Button, Card, Input, TimerProgress, Badge, Avatar } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import type { QCMQuestion, OpenQuestion } from "@/types";

export function QuestionDisplay() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const answeredPlayers = useGameStore((s) => s.answeredPlayers);
  const players = useRoomStore((s) => s.players);
  const { submitAnswer } = useSocket();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");

  if (!currentQuestion) return null;

  const totalTime = currentQuestion.timeLimit;

  const handleSubmit = () => {
    if (hasAnswered) return;

    if (currentQuestion.type === "qcm" && selectedOption !== null) {
      submitAnswer(String(selectedOption));
    } else if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim());
    }
  };

  const handleOptionSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedOption(index);
    // Auto-submit for QCM
    submitAnswer(String(index));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col h-full px-4 pb-4"
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
                  opacity: hasPlayerAnswered ? 1 : 0.5,
                }}
                className="relative"
              >
                <Avatar
                  emoji={player.avatar}
                  size="sm"
                  status={hasPlayerAnswered ? "answered" : undefined}
                />
                {hasPlayerAnswered && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -bottom-1 -right-1 w-4 h-4 bg-brand-500 rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="w-3 h-3 text-white" />
                  </motion.div>
                )}
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
      <Card variant="glass" className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
          {question.question}
        </h2>
      </Card>

      {/* Options grid */}
      <div className="grid grid-cols-1 gap-3 flex-1">
        {question.options.map((option, index) => (
          <motion.button
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(index)}
            disabled={hasAnswered}
            className={cn(
              "p-4 rounded-2xl text-left",
              "border-2 transition-all duration-200",
              "flex items-center gap-4",
              "min-h-[64px]",
              selectedOption === index
                ? "border-brand-500 bg-brand-500/20"
                : "border-surface-700 bg-surface-900/80 hover:border-surface-600",
              hasAnswered && selectedOption !== index && "opacity-50"
            )}
          >
            <span
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "font-bold text-lg shrink-0",
                selectedOption === index
                  ? "bg-brand-500 text-white"
                  : "bg-surface-800 text-surface-400"
              )}
            >
              {String.fromCharCode(65 + index)}
            </span>
            <span className="text-lg text-white">{option}</span>
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
              Réponse envoyée !
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

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
      {/* Question text */}
      <Card variant="glass" className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
          {question.question}
        </h2>
      </Card>

      {/* Answer input */}
      <div className="flex-1 flex flex-col justify-end">
        {hasAnswered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card variant="glass" className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Ta réponse :</p>
                  <p className="text-lg font-medium text-white">{answer}</p>
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
              variant="glass"
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
