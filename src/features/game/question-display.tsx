"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle, Tag, Volume2, RotateCcw, MapPin, Eye } from "lucide-react";
import Image from "next/image";
import { Button, Card, Input, TimerProgress, Badge, Avatar } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import type { QCMQuestion, OpenQuestion, EstimationQuestion, DictationQuestion, ParcoursQuestion, PetitBacQuestion, GeoQuizQuestion, LangueQuestion, MathsQuestion } from "@/types";

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
  const [dictationAnswer, setDictationAnswer] = useState("");
  const [parcoursAnswer, setParcoursAnswer] = useState("");
  const [petitBacAnswers, setPetitBacAnswers] = useState<Record<string, string>>({});
  const [geoQuizAnswer, setGeoQuizAnswer] = useState("");
  const [langueLanguage, setLangueLanguage] = useState("");
  const [langueMeaning, setLangueMeaning] = useState("");

  // Ref to access latest petitBac answers in the auto-submit effect
  const petitBacAnswersRef = useRef(petitBacAnswers);
  petitBacAnswersRef.current = petitBacAnswers;

  // Auto-submit petitBac answers when timer expires (before server starts validation)
  useEffect(() => {
    if (
      currentQuestion?.type === "petitbac" &&
      timeRemaining === 0 &&
      !hasAnswered
    ) {
      const socket = getSocket();
      const answers = JSON.stringify(petitBacAnswersRef.current);
      socket.emit("game:submit_answer", answers);
      useGameStore.getState().submitAnswer(answers);
    }
  }, [timeRemaining, currentQuestion?.type, hasAnswered]);

  if (!currentQuestion) return null;

  const totalTime = currentQuestion.timeLimit;

  const handleSubmit = () => {
    if (hasAnswered) return;

    if ((currentQuestion.type === "qcm" || currentQuestion.type === "maths") && selectedOption !== null) {
      submitAnswer(String(selectedOption));
    } else if (currentQuestion.type === "estimation" && priceGuess.trim()) {
      submitAnswer(priceGuess.trim());
    } else if (currentQuestion.type === "dictation" && dictationAnswer.trim()) {
      submitAnswer(dictationAnswer.trim());
    } else if (currentQuestion.type === "parcours" && parcoursAnswer.trim()) {
      submitAnswer(parcoursAnswer.trim());
    } else if (currentQuestion.type === "petitbac") {
      submitAnswer(JSON.stringify(petitBacAnswers));
    } else if (currentQuestion.type === "geoquiz" && geoQuizAnswer.trim()) {
      submitAnswer(geoQuizAnswer.trim());
    } else if (currentQuestion.type === "langue" && (langueLanguage.trim() || langueMeaning.trim())) {
      submitAnswer(JSON.stringify({ language: langueLanguage.trim(), meaning: langueMeaning.trim() }));
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
        {(currentQuestion.type === "qcm" || currentQuestion.type === "maths") && (
          <QCMQuestionView
            question={currentQuestion as QCMQuestion | MathsQuestion}
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

        {currentQuestion.type === "dictation" && (
          <DictationQuestionView
            question={currentQuestion as DictationQuestion}
            answer={dictationAnswer}
            hasAnswered={hasAnswered}
            onChange={setDictationAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "parcours" && (
          <ParcoursQuestionView
            question={currentQuestion as ParcoursQuestion}
            answer={parcoursAnswer}
            hasAnswered={hasAnswered}
            onChange={setParcoursAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "geoquiz" && (
          <GeoQuizQuestionView
            question={currentQuestion as GeoQuizQuestion}
            answer={geoQuizAnswer}
            hasAnswered={hasAnswered}
            onChange={setGeoQuizAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "langue" && (
          <LangueQuestionView
            question={currentQuestion as LangueQuestion}
            languageAnswer={langueLanguage}
            meaningAnswer={langueMeaning}
            hasAnswered={hasAnswered}
            onLanguageChange={setLangueLanguage}
            onMeaningChange={setLangueMeaning}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "petitbac" && (
          <PetitBacQuestionView
            question={currentQuestion as PetitBacQuestion}
            answers={petitBacAnswers}
            hasAnswered={hasAnswered}
            onChange={setPetitBacAnswers}
            onSubmit={handleSubmit}
          />
        )}

        {(currentQuestion.type === "open" ||
          currentQuestion.type === "image") && (
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
  question: QCMQuestion | MathsQuestion;
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

// ==========================================
// DICTATION QUESTION VIEW
// ==========================================

interface DictationQuestionViewProps {
  question: DictationQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function DictationQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: DictationQuestionViewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const audioSrc = `/audio/dictation/${question.audioFile}`;

  const playAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(audioSrc);
      audio.addEventListener("canplaythrough", () => setAudioLoaded(true));
      audio.addEventListener("playing", () => setIsPlaying(true));
      audio.addEventListener("ended", () => setIsPlaying(false));
      audio.addEventListener("error", () => setAudioLoaded(false));
      audioRef.current = audio;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    setPlayCount((c) => c + 1);
  }, [audioSrc]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-6 py-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-4">
          <span className="text-lg">🎧</span>
          <span className="text-xs font-medium text-surface-300">Dictée</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-balance">
          Écoute et écris ce que tu entends
        </h2>
      </div>

      {/* Audio controls */}
      <div className="flex justify-center gap-3 mb-6">
        <Button
          variant={playCount === 0 ? "primary" : "secondary"}
          size="lg"
          onClick={playAudio}
          disabled={isPlaying}
          leftIcon={
            playCount === 0 ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <RotateCcw className="w-5 h-5" />
            )
          }
        >
          {isPlaying
            ? "Lecture..."
            : playCount === 0
            ? "Écouter la dictée"
            : "Réécouter"}
        </Button>
      </div>

      {/* Answer input */}
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
                  <p className="text-sm text-surface-400">Ta dictée :</p>
                  <p className="text-base font-medium text-surface-100">{answer}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Écris la phrase ici..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              rows={3}
              className={cn(
                "w-full rounded-xl px-4 py-3 text-base resize-none",
                "bg-surface-900 border border-surface-700",
                "text-surface-100 placeholder:text-surface-600",
                "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent",
                "transition-colors duration-150"
              )}
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

// ==========================================
// PARCOURS QUESTION VIEW (Career Path)
// ==========================================

interface ParcoursQuestionViewProps {
  question: ParcoursQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function ParcoursQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: ParcoursQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">⚽</span>
          <span className="text-xs font-medium text-surface-300">Parcours</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quel joueur est passé par ces clubs ?
        </h2>
      </div>

      {/* Club timeline */}
      <div className="flex-1 overflow-y-auto mb-4">
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-surface-700" />

          {question.clubs.map((club, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative flex items-center gap-3 mb-3 last:mb-0"
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "absolute -left-5 w-3 h-3 rounded-full border-2",
                  index === 0
                    ? "bg-green-500 border-green-400"
                    : index === question.clubs.length - 1
                    ? "bg-brand-500 border-brand-400"
                    : "bg-surface-600 border-surface-500"
                )}
              />

              {/* Club card */}
              <div
                className={cn(
                  "flex-1 flex items-center justify-between",
                  "px-4 py-3 rounded-xl",
                  "bg-surface-900 border border-surface-700",
                  "hover:border-surface-600 transition-colors"
                )}
              >
                <span className="font-medium text-surface-100 text-sm sm:text-base">
                  {club.name}
                </span>
                <span className="text-xs sm:text-sm text-surface-400 font-mono ml-3 shrink-0">
                  {club.years}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Answer input */}
      <div>
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
          <div className="space-y-3">
            <Input
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom du joueur..."
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

// ==========================================
// PETIT BAC QUESTION VIEW
// ==========================================

const PETITBAC_CATEGORY_ICONS: Record<string, string> = {
  "Prénom": "👤",
  "Pokémon": "⚡",
  "Joueur de foot": "⚽",
  "Plat": "🍽️",
  "Métier": "💼",
  "Fruit/Légume": "🍎",
  "Film": "🎬",
  "Partie du corps/os": "🦴",
};

interface PetitBacQuestionViewProps {
  question: PetitBacQuestion;
  answers: Record<string, string>;
  hasAnswered: boolean;
  onChange: (answers: Record<string, string>) => void;
  onSubmit: () => void;
}

function PetitBacQuestionView({
  question,
  answers,
  hasAnswered,
  onChange,
  onSubmit,
}: PetitBacQuestionViewProps) {
  const handleCategoryChange = (category: string, value: string) => {
    onChange({ ...answers, [category]: value });
  };

  const filledCount = question.categories.filter(
    (cat) => (answers[cat] || "").trim().length > 0
  ).length;

  return (
    <>
      {/* Header with letter */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">🔤</span>
          <span className="text-xs font-medium text-surface-300">Petit Bac</span>
        </div>
        <div className="flex justify-center mb-2">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center shadow-lg"
          >
            <span className="text-4xl font-display font-black text-white">
              {question.letter}
            </span>
          </motion.div>
        </div>
        <p className="text-surface-400 text-sm">
          Trouve un mot commençant par <span className="font-bold text-cyan-400">{question.letter}</span> pour chaque catégorie
        </p>
      </div>

      {/* Category inputs */}
      <div className="flex-1 overflow-y-auto mb-4 -mx-1 px-1">
        {hasAnswered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <Card className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Réponses envoyées</p>
                  <p className="text-lg font-medium text-surface-100">
                    {filledCount}/{question.categories.length} catégories
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {question.categories.map((category, index) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 text-center text-lg shrink-0">
                  {PETITBAC_CATEGORY_ICONS[category] || "📝"}
                </div>
                <div className="flex-1">
                  <label className="text-xs text-surface-400 mb-0.5 block">
                    {category}
                  </label>
                  <input
                    type="text"
                    value={answers[category] || ""}
                    onChange={(e) => handleCategoryChange(category, e.target.value)}
                    placeholder={`${question.letter}...`}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-sm",
                      "bg-surface-900 border border-surface-700",
                      "text-surface-100 placeholder:text-surface-600",
                      "focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent",
                      "transition-colors duration-150"
                    )}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Submit button */}
      {!hasAnswered && (
        <div>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSubmit}
            rightIcon={<Send className="w-5 h-5" />}
          >
            Valider ({filledCount}/{question.categories.length})
          </Button>
        </div>
      )}
    </>
  );
}

// ==========================================
// GEOQUIZ QUESTION VIEW
// ==========================================

interface GeoQuizQuestionViewProps {
  question: GeoQuizQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function GeoQuizQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: GeoQuizQuestionViewProps) {
  const [imageError, setImageError] = useState(false);

  // Reset image error state when question changes
  useEffect(() => {
    setImageError(false);
  }, [question.imageUrl]);

  const geoQuizHint = useGameStore((s) => s.geoQuizHint);
  const { useGeoQuizHint } = useSocket();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleUseHint = () => {
    if (!geoQuizHint) {
      useGeoQuizHint();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">🌍</span>
          <span className="text-xs font-medium text-surface-300">GeoQuiz</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Dans quelle ville se trouve ce lieu ?
        </h2>
      </div>

      {/* Place image */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-3"
        >
          <div className="w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden bg-surface-800 shadow-lg">
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-surface-500 gap-2">
                <MapPin className="w-8 h-8 text-surface-600" />
                <span className="text-xs">Image indisponible</span>
              </div>
            ) : (
              <img
                src={question.imageUrl}
                alt="Lieu à deviner"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Hint */}
      <AnimatePresence>
        {geoQuizHint ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-3"
          >
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30">
              <MapPin className="w-4 h-4 text-sky-400" />
              <span className="text-sm text-sky-300">{geoQuizHint}</span>
              <Badge variant="warning" size="sm">-50%</Badge>
            </div>
          </motion.div>
        ) : !hasAnswered ? (
          <motion.div className="mb-3 flex justify-center">
            <button
              onClick={handleUseHint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-800 border border-surface-700 hover:border-sky-500/50 transition-colors"
            >
              <Eye className="w-4 h-4 text-sky-400" />
              <span className="text-sm text-surface-300">Indice</span>
              <span className="text-xs text-surface-500">(points /2)</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Answer input */}
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
          <div className="space-y-3">
            <Input
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom de la ville..."
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

// ==========================================
// LANGUE QUESTION VIEW (Devine la Langue)
// ==========================================

/** Renders a sentence with the target word highlighted in rose bold */
function HighlightedSentence({
  sentence,
  targetWord,
  className,
}: {
  sentence: string;
  targetWord: string;
  className?: string;
}) {
  const idx = sentence.indexOf(targetWord);
  if (idx === -1) {
    // Fallback: just show the whole sentence
    return <span className={className}>{sentence}</span>;
  }
  const before = sentence.slice(0, idx);
  const after = sentence.slice(idx + targetWord.length);
  return (
    <span className={className}>
      {before}
      <span className="font-bold text-rose-400">{targetWord}</span>
      {after}
    </span>
  );
}

interface LangueQuestionViewProps {
  question: LangueQuestion;
  languageAnswer: string;
  meaningAnswer: string;
  hasAnswered: boolean;
  onLanguageChange: (value: string) => void;
  onMeaningChange: (value: string) => void;
  onSubmit: () => void;
}

function LangueQuestionView({
  question,
  languageAnswer,
  meaningAnswer,
  hasAnswered,
  onLanguageChange,
  onMeaningChange,
  onSubmit,
}: LangueQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const isNonLatin = question.script === "non-latin";

  return (
    <>
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">🗣️</span>
          <span className="text-xs font-medium text-surface-300">Devine la Langue</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quelle langue ? Que signifie le mot en gras ?
        </h2>
      </div>

      {/* Sentence display */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex flex-col items-center gap-3 mb-6 px-4 py-5 rounded-2xl bg-surface-800/60 border border-surface-700"
      >
        {/* Native script line */}
        <HighlightedSentence
          sentence={question.sentence}
          targetWord={question.targetWord}
          className={cn(
            "text-center leading-relaxed text-surface-100",
            isNonLatin ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          )}
        />
        {/* Transliteration line (only for non-latin scripts) */}
        {isNonLatin && question.sentenceTransliteration && question.targetWordTransliteration && (
          <HighlightedSentence
            sentence={question.sentenceTransliteration}
            targetWord={question.targetWordTransliteration}
            className="text-base sm:text-lg text-surface-400 text-center leading-relaxed italic"
          />
        )}
      </motion.div>

      {/* Two input fields */}
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
                  <p className="text-sm text-surface-400">Tes réponses :</p>
                  <p className="text-base font-medium text-surface-100">
                    Langue : {languageAnswer || "(vide)"}
                  </p>
                  <p className="text-base font-medium text-surface-100">
                    Sens : {meaningAnswer || "(vide)"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Langue</label>
              <Input
                value={languageAnswer}
                onChange={(e) => onLanguageChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Japonais, Arabe..."
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className="text-xs text-surface-400 mb-1 block">Signification</label>
              <Input
                value={meaningAnswer}
                onChange={(e) => onMeaningChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Que signifie le mot en gras ?"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={!languageAnswer.trim() && !meaningAnswer.trim()}
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
