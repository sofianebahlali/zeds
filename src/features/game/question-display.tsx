"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle, Tag, MapPin, Eye, Gamepad2, Flag as FlagIcon, Landmark, Globe2, Building2, Link2, XCircle, LockKeyhole } from "lucide-react";
import Image from "next/image";
import { Button, Card, Input, TimerProgress, Badge, Avatar } from "@/components/ui";
import { useGameStore, useRoomStore } from "@/stores";
import { useSocket } from "@/hooks";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { WorldMap } from "./world-map";
import type { OpenQuestion, EstimationQuestion, ParcoursQuestion, PetitBacQuestion, GeoQuizQuestion, LangueQuestion, MathsQuestion, GuessGameQuestion, JerseyNumberQuestion, FutCardQuestion, ChronoQuestion, ConsensusQuestion, DialedQuestion, PokeGeoQuestion, PokemonTranslateQuestion, PokedexNumberQuestion, FlagQuestion, CapitalQuestion, CountryLocateQuestion, CityLocateQuestion, GeoDifficulty, FootballConnectionQuestion, MysteryCareerQuestion, MissingClubQuestion } from "@/types";
import { GEO_DIFFICULTY_LABELS } from "@/types";

export function QuestionDisplay() {
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const hasAnswered = useGameStore((s) => s.hasAnswered);
  const answeredPlayers = useGameStore((s) => s.answeredPlayers);
  const footballConnectionGuessResult = useGameStore((s) => s.footballConnectionGuessResult);
  const footballConnectionAttemptsRemaining = useGameStore((s) => s.footballConnectionAttemptsRemaining);
  const footballConnectionCooldownUntil = useGameStore((s) => s.footballConnectionCooldownUntil);
  const footballConnectionFoundPlayers = useGameStore((s) => s.footballConnectionFoundPlayers);
  const mysteryCareerGuessResult = useGameStore((s) => s.mysteryCareerGuessResult);
  const mysteryCareerAttemptsRemaining = useGameStore((s) => s.mysteryCareerAttemptsRemaining);
  const mysteryCareerCooldownUntil = useGameStore((s) => s.mysteryCareerCooldownUntil);
  const mysteryCareerFoundPlayers = useGameStore((s) => s.mysteryCareerFoundPlayers);
  const players = useRoomStore((s) => s.players);
  const { submitAnswer, submitFootballConnectionGuess, submitMysteryCareerGuess } = useSocket();

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [priceGuess, setPriceGuess] = useState("");
  const [parcoursAnswer, setParcoursAnswer] = useState("");
  const [petitBacAnswers, setPetitBacAnswers] = useState<Record<string, string>>({});
  const [geoQuizAnswer, setGeoQuizAnswer] = useState("");
  const [pokeGeoAnswer, setPokeGeoAnswer] = useState("");
  const [langueLanguage, setLangueLanguage] = useState("");
  const [langueMeaning, setLangueMeaning] = useState("");
  const [guessGameAnswer, setGuessGameAnswer] = useState("");
  const [jerseyGuess, setJerseyGuess] = useState("");
  const [futCardAnswer, setFutCardAnswer] = useState("");
  const [chronoStartTime, setChronoStartTime] = useState<number | null>(null);
  const [chronoStopped, setChronoStopped] = useState(false);
  const [consensusAnswer, setConsensusAnswer] = useState("");
  const [translateAnswer, setTranslateAnswer] = useState("");
  const [dialedH, setDialedH] = useState(180);
  const [dialedS, setDialedS] = useState(50);
  const [dialedL, setDialedL] = useState(50);
  const [dialedSubmitted, setDialedSubmitted] = useState(false);
  const [pokedexGuess, setPokedexGuess] = useState("");
  const [flagAnswer, setFlagAnswer] = useState("");
  const [capitalAnswer, setCapitalAnswer] = useState("");
  const [footballConnectionGuess, setFootballConnectionGuess] = useState("");
  const [mysteryCareerGuess, setMysteryCareerGuess] = useState("");
  const [missingClubAnswer, setMissingClubAnswer] = useState("");
  const [locatePick, setLocatePick] = useState<{ lat: number; lng: number; cca3: string | null; name: string | null } | null>(null);

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

  // Reset state between rounds
  useEffect(() => {
    setSelectedOption(null);
    setTextAnswer("");
    setPriceGuess("");
    setParcoursAnswer("");
    setPetitBacAnswers({});
    setGeoQuizAnswer("");
    setPokeGeoAnswer("");
    setTranslateAnswer("");
    setLangueLanguage("");
    setLangueMeaning("");
    setGuessGameAnswer("");
    setJerseyGuess("");
    setFutCardAnswer("");
    setChronoStartTime(null);
    setChronoStopped(false);
    setConsensusAnswer("");
    setDialedH(180);
    setDialedS(50);
    setDialedL(50);
    setDialedSubmitted(false);
    setPokedexGuess("");
    setFlagAnswer("");
    setCapitalAnswer("");
    setFootballConnectionGuess("");
    setMysteryCareerGuess("");
    setMissingClubAnswer("");
    setLocatePick(null);
  }, [currentQuestion?.id]);

  if (!currentQuestion) return null;

  const totalTime = currentQuestion.timeLimit;

  const handleSubmit = () => {
    if (hasAnswered) return;

    if (currentQuestion.type === "maths" && selectedOption !== null) {
      submitAnswer(String(selectedOption));
    } else if (currentQuestion.type === "estimation" && priceGuess.trim()) {
      submitAnswer(priceGuess.trim());
        } else if (currentQuestion.type === "parcours" && parcoursAnswer.trim()) {
      submitAnswer(parcoursAnswer.trim());
    } else if (currentQuestion.type === "petitbac") {
      submitAnswer(JSON.stringify(petitBacAnswers));
    } else if (currentQuestion.type === "geoquiz" && geoQuizAnswer.trim()) {
      submitAnswer(geoQuizAnswer.trim());
    } else if (currentQuestion.type === "pokegeo" && pokeGeoAnswer.trim()) {
      submitAnswer(pokeGeoAnswer.trim());
    } else if (currentQuestion.type === "langue" && (langueLanguage.trim() || langueMeaning.trim())) {
      submitAnswer(JSON.stringify({ language: langueLanguage.trim(), meaning: langueMeaning.trim() }));
    } else if (currentQuestion.type === "guessgame" && guessGameAnswer.trim()) {
      submitAnswer(guessGameAnswer.trim());
    } else if (currentQuestion.type === "jerseynumber" && jerseyGuess.trim()) {
      submitAnswer(jerseyGuess.trim());
    } else if (currentQuestion.type === "futcard" && futCardAnswer.trim()) {
      submitAnswer(futCardAnswer.trim());
    } else if (currentQuestion.type === "missingclub" && missingClubAnswer.trim()) {
      submitAnswer(missingClubAnswer.trim());
    } else if (currentQuestion.type === "pokemontranslate" && translateAnswer.trim()) {
      submitAnswer(translateAnswer.trim());
    } else if (currentQuestion.type === "consensus" && consensusAnswer.trim()) {
      submitAnswer(consensusAnswer.trim());
    } else if (currentQuestion.type === "pokedexnumber" && pokedexGuess.trim()) {
      submitAnswer(pokedexGuess.trim());
    } else if (currentQuestion.type === "flag" && flagAnswer.trim()) {
      submitAnswer(flagAnswer.trim());
    } else if (currentQuestion.type === "capital" && capitalAnswer.trim()) {
      submitAnswer(capitalAnswer.trim());
    } else if ((currentQuestion.type === "countrylocate" || currentQuestion.type === "citylocate") && locatePick) {
      submitAnswer(JSON.stringify({ lat: locatePick.lat, lng: locatePick.lng, cca3: locatePick.cca3 }));
    } else if (currentQuestion.type === "dialed") {
      submitAnswer(JSON.stringify({ h: dialedH, s: dialedS, l: dialedL }));
      setDialedSubmitted(true);
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
      {/* Timer — hidden during Chrono rounds (players must estimate time) */}
      {currentQuestion.type !== "chrono" && (
        <div className="mb-6">
          <TimerProgress
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            showTime
          />
        </div>
      )}

      {/* Question */}
      <div className="flex-1 flex flex-col">
        {currentQuestion.type === "maths" && (
          <MultipleChoiceQuestionView
            question={currentQuestion as MathsQuestion}
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

        {currentQuestion.type === "parcours" && (
          <ParcoursQuestionView
            question={currentQuestion as ParcoursQuestion}
            answer={parcoursAnswer}
            hasAnswered={hasAnswered}
            onChange={setParcoursAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "footballconnection" && (
          <FootballConnectionQuestionView
            question={currentQuestion as FootballConnectionQuestion}
            guess={footballConnectionGuess}
            hasAnswered={hasAnswered}
            attemptsRemaining={footballConnectionAttemptsRemaining}
            cooldownUntil={footballConnectionCooldownUntil}
            result={footballConnectionGuessResult}
            foundPlayers={footballConnectionFoundPlayers}
            onChange={setFootballConnectionGuess}
            onSubmit={() => {
              if (submitFootballConnectionGuess(footballConnectionGuess)) {
                setFootballConnectionGuess("");
              }
            }}
          />
        )}

        {currentQuestion.type === "mysterycareer" && (
          <MysteryCareerQuestionView
            question={currentQuestion as MysteryCareerQuestion}
            guess={mysteryCareerGuess}
            hasAnswered={hasAnswered}
            attemptsRemaining={mysteryCareerAttemptsRemaining}
            cooldownUntil={mysteryCareerCooldownUntil}
            result={mysteryCareerGuessResult}
            foundPlayers={mysteryCareerFoundPlayers}
            onChange={setMysteryCareerGuess}
            onSubmit={() => {
              if (submitMysteryCareerGuess(mysteryCareerGuess)) {
                setMysteryCareerGuess("");
              }
            }}
          />
        )}

        {currentQuestion.type === "missingclub" && (
          <MissingClubQuestionView
            question={currentQuestion as MissingClubQuestion}
            answer={missingClubAnswer}
            hasAnswered={hasAnswered}
            onChange={setMissingClubAnswer}
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

        {currentQuestion.type === "pokegeo" && (
          <PokeGeoQuestionView
            question={currentQuestion as PokeGeoQuestion}
            answer={pokeGeoAnswer}
            hasAnswered={hasAnswered}
            onChange={setPokeGeoAnswer}
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

        {currentQuestion.type === "guessgame" && (
          <GuessGameQuestionView
            question={currentQuestion as GuessGameQuestion}
            answer={guessGameAnswer}
            hasAnswered={hasAnswered}
            onChange={setGuessGameAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "jerseynumber" && (
          <JerseyNumberQuestionView
            question={currentQuestion as JerseyNumberQuestion}
            guess={jerseyGuess}
            hasAnswered={hasAnswered}
            onChange={setJerseyGuess}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "futcard" && (
          <FutCardQuestionView
            question={currentQuestion as FutCardQuestion}
            answer={futCardAnswer}
            hasAnswered={hasAnswered}
            onChange={setFutCardAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "chrono" && (
          <ChronoQuestionView
            question={currentQuestion as ChronoQuestion}
            hasAnswered={hasAnswered}
            chronoStartTime={chronoStartTime}
            chronoStopped={chronoStopped}
            onStart={() => setChronoStartTime(Date.now())}
            onStop={() => {
              if (chronoStartTime && !chronoStopped) {
                const elapsed = Date.now() - chronoStartTime;
                setChronoStopped(true);
                submitAnswer(String(elapsed));
              }
            }}
          />
        )}

        {currentQuestion.type === "consensus" && (
          <ConsensusQuestionView
            question={currentQuestion as ConsensusQuestion}
            answer={consensusAnswer}
            hasAnswered={hasAnswered}
            onChange={setConsensusAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "pokemontranslate" && (
          <PokemonTranslateQuestionView
            question={currentQuestion as PokemonTranslateQuestion}
            answer={translateAnswer}
            hasAnswered={hasAnswered}
            onChange={setTranslateAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "dialed" && (
          <DialedQuestionView
            question={currentQuestion as DialedQuestion}
            h={dialedH}
            s={dialedS}
            l={dialedL}
            onChangeH={setDialedH}
            onChangeS={setDialedS}
            onChangeL={setDialedL}
            hasAnswered={hasAnswered}
            submitted={dialedSubmitted}
            onSubmit={handleSubmit}
            timeRemaining={timeRemaining}
          />
        )}

        {currentQuestion.type === "pokedexnumber" && (
          <PokedexNumberQuestionView
            question={currentQuestion as PokedexNumberQuestion}
            guess={pokedexGuess}
            hasAnswered={hasAnswered}
            onChange={setPokedexGuess}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "flag" && (
          <FlagQuestionView
            question={currentQuestion as FlagQuestion}
            answer={flagAnswer}
            hasAnswered={hasAnswered}
            onChange={setFlagAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "capital" && (
          <CapitalQuestionView
            question={currentQuestion as CapitalQuestion}
            answer={capitalAnswer}
            hasAnswered={hasAnswered}
            onChange={setCapitalAnswer}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "countrylocate" && (
          <CountryLocateQuestionView
            question={currentQuestion as CountryLocateQuestion}
            pick={locatePick}
            hasAnswered={hasAnswered}
            onPick={setLocatePick}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "citylocate" && (
          <CityLocateQuestionView
            question={currentQuestion as CityLocateQuestion}
            pick={locatePick}
            hasAnswered={hasAnswered}
            onPick={setLocatePick}
            onSubmit={handleSubmit}
          />
        )}

        {currentQuestion.type === "open" && (
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
          {currentQuestion.type === "footballconnection" || currentQuestion.type === "mysterycareer"
            ? `${answeredPlayers.length}/${players.length} ont trouvé`
            : `${answeredPlayers.length}/${players.length} ont répondu`}
        </p>
      </div>
    </motion.div>
  );
}

function FootballConnectionQuestionView({
  question,
  guess,
  hasAnswered,
  attemptsRemaining,
  cooldownUntil,
  result,
  foundPlayers,
  onChange,
  onSubmit,
}: {
  question: FootballConnectionQuestion;
  guess: string;
  hasAnswered: boolean;
  attemptsRemaining: number;
  cooldownUntil: number;
  result: ReturnType<typeof useGameStore.getState>["footballConnectionGuessResult"];
  foundPlayers: ReturnType<typeof useGameStore.getState>["footballConnectionFoundPlayers"];
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const coolingDown = cooldownUntil > now;
  const difficultyLabel = {
    easy: "Accessible",
    medium: "Connaisseur",
    hard: "Expert",
  }[question.difficulty];

  const clueIcon = (kind: FootballConnectionQuestion["left"]["kind"]) => {
    if (kind === "club") return <Building2 className="w-6 h-6" />;
    if (kind === "country") return <Globe2 className="w-6 h-6" />;
    return <span className="text-lg font-black">Aa</span>;
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center mb-5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="primary" size="sm">{difficultyLabel}</Badge>
          <span className="text-xs text-surface-500">
            {question.answerCount > 1
              ? `${question.answerCount} réponses possibles`
              : "1 réponse possible"}
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100">
          Trouve le joueur qui fait la connexion
        </h2>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4 mb-5">
        {[question.left, question.right].map((clue, index) => (
          <div key={`${clue.kind}-${clue.label}`} className="contents">
            {index === 1 && (
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-brand-400" />
                </div>
              </div>
            )}
            <Card className="min-w-0">
              <div className="h-full min-h-28 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-surface-800 text-brand-400 flex items-center justify-center">
                  {clueIcon(clue.kind)}
                </div>
                <p className={cn(
                  "font-display font-bold text-surface-100 break-words max-w-full",
                  clue.kind === "initial" ? "text-3xl tracking-[0.15em]" : "text-base sm:text-lg"
                )}>
                  {clue.label}
                </p>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {hasAnswered ? (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-success-500/40 bg-success-500/10 p-4 text-center mb-4"
          >
            <CheckCircle className="w-7 h-7 text-success-400 mx-auto mb-2" />
            <p className="font-bold text-success-300">
              {result?.normalizedPlayerName ?? "Connexion trouvée !"}
            </p>
            {result?.points !== undefined && (
              <p className="text-sm text-success-400 mt-1">+{result.points} points</p>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-auto">
            {result && !result.correct && (
              <div className="flex items-center justify-center gap-2 text-danger-400 text-sm mb-3">
                <XCircle className="w-4 h-4" />
                {attemptsRemaining > 0 ? "Pas ce joueur. Réessaie !" : "Plus d’essais disponibles"}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={guess}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder="Prénom et/ou nom du joueur"
                autoComplete="off"
                disabled={attemptsRemaining <= 0}
              />
              <Button
                size="icon-lg"
                onClick={onSubmit}
                disabled={!guess.trim() || attemptsRemaining <= 0 || coolingDown}
                aria-label="Proposer ce joueur"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-500 mt-2 px-1">
              <span>{attemptsRemaining} essai{attemptsRemaining > 1 ? "s" : ""}</span>
              {coolingDown && <span>Prochain essai dans un instant…</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {foundPlayers.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {foundPlayers.map((entry) => (
            <Badge key={entry.playerId} variant={entry.isFirst ? "warning" : "success"} size="sm">
              {entry.isFirst ? "⚡ " : "✓ "}{entry.playerName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MysteryCareerQuestionView({
  question,
  guess,
  hasAnswered,
  attemptsRemaining,
  cooldownUntil,
  result,
  foundPlayers,
  onChange,
  onSubmit,
}: {
  question: MysteryCareerQuestion;
  guess: string;
  hasAnswered: boolean;
  attemptsRemaining: number;
  cooldownUntil: number;
  result: ReturnType<typeof useGameStore.getState>["mysteryCareerGuessResult"];
  foundPlayers: ReturnType<typeof useGameStore.getState>["mysteryCareerFoundPlayers"];
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

  const coolingDown = cooldownUntil > now;
  const remainingClues = Math.max(0, question.totalClubs - question.clubs.length);
  const availablePoints = question.points + Math.min(150, remainingClues * 20);
  const difficultyLabel = {
    easy: "Accessible",
    medium: "Connaisseur",
    hard: "Expert",
  }[question.difficulty];

  const years = (from: string | null, to: string | null) => {
    if (!from && !to) return "Dates inconnues";
    if (from === to || !to) return from ?? to ?? "";
    return `${from}–${to}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="warning" size="sm">{difficultyLabel}</Badge>
          <span className="text-xs font-semibold text-accent-400">
            {availablePoints} points disponibles
          </span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100">
          À qui appartient cette carrière ?
        </h2>
        <p className="text-xs text-surface-500 mt-1">
          Un nouveau club apparaît toutes les {question.revealInterval} secondes
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mb-4 pr-1">
        <div className="relative pl-7">
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-500 via-emerald-500 to-surface-700" />
          <AnimatePresence initial={false}>
            {question.clubs.map((club, index) => (
              <motion.div
                key={`${club.teamId}-${club.order}`}
                initial={{ opacity: 0, x: -16, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                className="relative mb-2"
              >
                <div className="absolute -left-[21px] top-4 w-3 h-3 rounded-full bg-amber-400 border-2 border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
                <div className="rounded-xl border border-surface-700 bg-surface-900 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold text-surface-100 truncate">{club.name}</span>
                    </div>
                    <span className="text-xs font-mono text-surface-400 shrink-0">
                      {years(club.fromYear, club.toYear)}
                    </span>
                  </div>
                  {(club.appearances !== null || club.goals !== null) && (
                    <p className="text-[11px] text-surface-500 mt-1 pl-6">
                      {club.appearances !== null ? `${club.appearances} apparitions` : ""}
                      {club.appearances !== null && club.goals !== null ? " • " : ""}
                      {club.goals !== null ? `${club.goals} buts` : ""}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {remainingClues > 0 && (
            <div className="relative">
              <div className="absolute -left-[22px] top-3 w-4 h-4 rounded-full bg-surface-800 border border-surface-600" />
              <div className="rounded-xl border border-dashed border-surface-700 bg-surface-900/40 px-3 py-2 text-xs text-surface-500 flex items-center gap-2">
                <LockKeyhole className="w-4 h-4" />
                {remainingClues} club{remainingClues > 1 ? "s" : ""} encore masqué{remainingClues > 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {hasAnswered ? (
          <motion.div
            key="found"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-success-500/40 bg-success-500/10 p-3 text-center"
          >
            <CheckCircle className="w-6 h-6 text-success-400 mx-auto mb-1" />
            <p className="font-bold text-success-300">
              {result?.normalizedPlayerName ?? "Joueur trouvé !"}
            </p>
            {result?.points !== undefined && (
              <p className="text-sm text-success-400">+{result.points} points</p>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {result && !result.correct && (
              <div className="flex items-center justify-center gap-2 text-danger-400 text-sm mb-2">
                <XCircle className="w-4 h-4" />
                {attemptsRemaining > 0 ? "Pas ce joueur. Réessaie !" : "Plus d’essais disponibles"}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={guess}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
                placeholder="Nom du joueur…"
                autoComplete="off"
                autoFocus
                disabled={attemptsRemaining <= 0}
              />
              <Button
                size="icon-lg"
                onClick={onSubmit}
                disabled={!guess.trim() || attemptsRemaining <= 0 || coolingDown}
                aria-label="Proposer ce joueur"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-500 mt-2 px-1">
              <span>{attemptsRemaining} essai{attemptsRemaining > 1 ? "s" : ""}</span>
              {coolingDown && <span>Prochain essai dans un instant…</span>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {foundPlayers.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {foundPlayers.map((entry) => (
            <Badge key={entry.playerId} variant={entry.isFirst ? "warning" : "success"} size="sm">
              {entry.isFirst ? "⚡ " : "✓ "}{entry.playerName}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function MissingClubQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: {
  question: MissingClubQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const difficultyLabel = {
    easy: "Accessible",
    medium: "Connaisseur",
    hard: "Expert",
  }[question.difficulty];
  const years = (from: string | null, to: string | null) => {
    if (!from && !to) return "Dates inconnues";
    if (from === to || !to) return from ?? to ?? "";
    return `${from}–${to}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Badge variant="primary" size="sm">{difficultyLabel}</Badge>
          {question.sportingCountry && (
            <Badge variant="default" size="sm">{question.sportingCountry}</Badge>
          )}
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100">
          Quel club manque dans la carrière de
        </h2>
        <p className="text-2xl font-display font-black text-cyan-400 mt-1">
          {question.playerName} ?
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mb-4 pr-1">
        <div className="relative pl-7">
          <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-surface-700" />
          {question.clubs.map((club, index) => {
            const hidden = index === question.missingIndex;
            return (
              <motion.div
                key={`${club.teamId}-${club.order}-${index}`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                className="relative mb-2"
              >
                <div className={cn(
                  "absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2",
                  hidden
                    ? "bg-cyan-400 border-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
                    : "bg-surface-600 border-surface-500"
                )} />
                <div className={cn(
                  "rounded-xl px-3 py-2.5 flex items-center justify-between gap-3",
                  hidden
                    ? "border-2 border-dashed border-cyan-500/60 bg-cyan-500/10"
                    : "border border-surface-700 bg-surface-900"
                )}>
                  <div className="min-w-0 flex items-center gap-2">
                    {hidden
                      ? <LockKeyhole className="w-4 h-4 text-cyan-400 shrink-0" />
                      : <Building2 className="w-4 h-4 text-surface-500 shrink-0" />}
                    <span className={cn(
                      "font-semibold truncate",
                      hidden ? "text-cyan-300 tracking-wider" : "text-surface-100"
                    )}>
                      {hidden ? "CLUB MANQUANT" : club.name}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-surface-400 shrink-0">
                    {years(club.fromYear, club.toYear)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {hasAnswered ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-center"
        >
          <CheckCircle className="w-6 h-6 text-brand-400 mx-auto mb-1" />
          <p className="text-xs text-surface-400">Réponse verrouillée</p>
          <p className="font-bold text-surface-100">{answer}</p>
        </motion.div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={answer}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Nom du club…"
            autoComplete="off"
            autoFocus
          />
          <Button
            size="icon-lg"
            onClick={onSubmit}
            disabled={!answer.trim()}
            aria-label="Valider ce club"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface MultipleChoiceQuestionViewProps {
  question: MathsQuestion;
  selectedOption: number | null;
  hasAnswered: boolean;
  onSelect: (index: number) => void;
}

function MultipleChoiceQuestionView({
  question,
  selectedOption,
  hasAnswered,
  onSelect,
}: MultipleChoiceQuestionViewProps) {
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
// POKEDEX NUMBER QUESTION VIEW
// ==========================================

interface PokedexNumberQuestionViewProps {
  question: PokedexNumberQuestion;
  guess: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function PokedexNumberQuestionView({
  question,
  guess,
  hasAnswered,
  onChange,
  onSubmit,
}: PokedexNumberQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Pokémon image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center mb-3"
      >
        <div className="w-40 h-40 rounded-2xl overflow-hidden bg-surface-800/50 flex items-center justify-center">
          <img
            src={question.imageUrl}
            alt={question.nameFr}
            className="w-full h-full object-contain p-2"
          />
        </div>
      </motion.div>

      {/* Pokémon name */}
      <div className="mb-4 text-center">
        <h2 className="text-xl font-display font-bold text-surface-100">
          {question.nameFr}
        </h2>
        <p className="text-surface-500 text-sm">{question.nameEn}</p>
        <p className="text-surface-400 text-sm mt-2">Quel est son numéro dans le Pokédex ?</p>
      </div>

      {/* Number input */}
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
                    N°{guess}
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
                  const val = e.target.value.replace(/[^\d]/g, "");
                  onChange(val);
                }}
                onKeyDown={handleKeyDown}
                placeholder="N°..."
                inputMode="numeric"
                autoFocus
                autoComplete="off"
                className="text-center text-2xl font-display font-bold"
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={!guess.trim()}
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
  const petitBacStop = useGameStore((s) => s.petitBacStopTriggered);
  const [stopCountdown, setStopCountdown] = useState<number | null>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // When stop is triggered, start visual countdown and auto-submit
  useEffect(() => {
    if (!petitBacStop || hasAnswered) return;
    setStopCountdown(petitBacStop.countdown);
    const interval = setInterval(() => {
      setStopCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          // Auto-submit when countdown reaches 0
          onSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [petitBacStop, hasAnswered]);

  const handleCategoryChange = (category: string, value: string) => {
    onChange({ ...answers, [category]: value });
  };

  const filledCount = question.categories.filter(
    (cat) => (answers[cat] || "").trim().length > 0
  ).length;

  return (
    <>
      {/* STOP banner */}
      <AnimatePresence>
        {petitBacStop && !hasAnswered && stopCountdown !== null && stopCountdown > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-20 left-4 right-4 z-50 flex justify-center"
          >
            <div className="bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg text-center">
              <div className="text-2xl font-display font-black">STOP !</div>
              <div className="text-sm opacity-90">
                {petitBacStop.playerName} a soumis — <span className="font-bold">{stopCountdown}s</span> restantes
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
// POKEGEO QUESTION VIEW (Pokémon GeoGuessr)
// ==========================================

interface PokeGeoQuestionViewProps {
  question: PokeGeoQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function PokeGeoQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: PokeGeoQuestionViewProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [question.imageUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">🗺️</span>
          <span className="text-xs font-medium text-surface-300">PokéGeo</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quel est ce lieu Pokémon ?
        </h2>
      </div>

      {/* Screenshot */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-3"
        >
          <div className="w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden bg-surface-800 shadow-lg">
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-surface-500 gap-2">
                <Gamepad2 className="w-8 h-8 text-surface-600" />
                <span className="text-xs">Image indisponible</span>
              </div>
            ) : (
              <img
                src={question.imageUrl}
                alt="Lieu Pokémon à deviner"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </motion.div>
      )}


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
              placeholder="Nom du lieu..."
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
              disabled={!languageAnswer.trim() || !meaningAnswer.trim()}
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
// GUESS THE GAME QUESTION VIEW
// ==========================================

interface GuessGameQuestionViewProps {
  question: GuessGameQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function GuessGameQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: GuessGameQuestionViewProps) {
  const [imageError, setImageError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImageError(false);
  }, [question.imageUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🎮</span>
          <span className="text-xs font-medium text-surface-300">Guess the Game</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quel est ce jeu vidéo ?
        </h2>
      </div>

      {/* Screenshot */}
      {question.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center mb-4"
        >
          <div className="w-full max-w-md aspect-video rounded-2xl overflow-hidden bg-surface-800 shadow-lg">
            {imageError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-surface-500 gap-2">
                <Gamepad2 className="w-8 h-8 text-surface-600" />
                <span className="text-xs">Image indisponible</span>
              </div>
            ) : (
              <img
                src={question.imageUrl}
                alt="Screenshot de jeu vidéo"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        </motion.div>
      )}

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
              ref={inputRef}
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nom du jeu..."
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
// JERSEY NUMBER QUESTION VIEW
// ==========================================

interface JerseyNumberQuestionViewProps {
  question: JerseyNumberQuestion;
  guess: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function JerseyNumberQuestionView({
  question,
  guess,
  hasAnswered,
  onChange,
  onSubmit,
}: JerseyNumberQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      {/* Player info */}
      <div className="mb-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center mb-4 shadow-lg"
        >
          <span className="text-4xl">👕</span>
        </motion.div>

        <h2 className="text-2xl sm:text-3xl font-display font-bold text-surface-100 mb-3">
          {question.playerName}
        </h2>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Badge variant="default" size="sm">
            {question.team}
          </Badge>
          <Badge variant="default" size="sm">
            {question.position}
          </Badge>
          {question.league && (
            <Badge variant="default" size="sm">
              {question.league}
            </Badge>
          )}
        </div>

        <p className="text-surface-400 text-sm mt-3">
          Quel est son numéro de maillot ?
        </p>
      </div>

      {/* Number input */}
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
                  <p className="text-2xl font-display font-bold text-surface-100">
                    N°{guess}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-surface-400">
                N°
              </span>
              <Input
                value={guess}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d]/g, "");
                  if (val === "" || (parseInt(val, 10) >= 0 && parseInt(val, 10) <= 99)) {
                    onChange(val);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="0"
                inputMode="numeric"
                autoFocus
                autoComplete="off"
                className="text-center text-2xl font-display font-bold pl-12"
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={!guess.trim()}
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
// FUT CARD QUESTION VIEW
// ==========================================

const FUT_CARD_COLORS: Record<string, { bg: string; accent: string }> = {
  gold_rare: { bg: "from-yellow-700 via-yellow-600 to-amber-500", accent: "text-yellow-200" },
  icon: { bg: "from-yellow-900 via-amber-800 to-yellow-700", accent: "text-yellow-300" },
  toty: { bg: "from-blue-900 via-blue-800 to-indigo-700", accent: "text-blue-200" },
  tots: { bg: "from-indigo-800 via-blue-700 to-cyan-600", accent: "text-cyan-200" },
  totw: { bg: "from-gray-900 via-gray-800 to-gray-700", accent: "text-amber-300" },
  headliners: { bg: "from-red-900 via-red-800 to-rose-700", accent: "text-red-200" },
  future_stars: { bg: "from-purple-900 via-purple-800 to-fuchsia-700", accent: "text-purple-200" },
  sbc: { bg: "from-indigo-900 via-purple-800 to-violet-700", accent: "text-violet-200" },
  flashback: { bg: "from-cyan-900 via-teal-800 to-emerald-700", accent: "text-teal-200" },
  eoae: { bg: "from-emerald-900 via-green-800 to-lime-700", accent: "text-emerald-200" },
  potm: { bg: "from-amber-800 via-orange-700 to-amber-600", accent: "text-amber-200" },
  fut_birthday: { bg: "from-pink-800 via-fuchsia-700 to-purple-600", accent: "text-pink-200" },
  futties: { bg: "from-pink-700 via-rose-600 to-pink-500", accent: "text-pink-100" },
  rulebreakers: { bg: "from-orange-900 via-red-800 to-orange-700", accent: "text-orange-200" },
  record_breaker: { bg: "from-blue-900 via-indigo-800 to-blue-700", accent: "text-blue-200" },
  hero: { bg: "from-teal-900 via-cyan-800 to-teal-700", accent: "text-teal-200" },
  winter_wildcards: { bg: "from-sky-900 via-blue-800 to-sky-700", accent: "text-sky-200" },
  showdown: { bg: "from-red-800 via-orange-700 to-red-600", accent: "text-red-200" },
  objetivos: { bg: "from-green-800 via-emerald-700 to-green-600", accent: "text-green-200" },
  otw: { bg: "from-gray-800 via-slate-700 to-gray-600", accent: "text-orange-300" },
};

/** Maps club names from question data to logo filenames in /images/clubs/ */
const CLUB_LOGO_SLUGS: Record<string, string> = {
  "AC Milan": "ac-milan",
  "AS Monaco": "as-monaco",
  "Al Ittihad": "al-ittihad",
  "Al Nassr": "al-nassr",
  "Arsenal": "arsenal",
  "Aston Villa": "aston-villa",
  "Bayern Munich": "bayern-munich",
  "Burnley": "burnley",
  "Chelsea": "chelsea",
  "D.C. United": "dc-united",
  "Everton": "everton",
  "FC Barcelona": "fc-barcelona",
  "Inter Milan": "inter-milan",
  "Juventus": "juventus",
  "LA Galaxy": "la-galaxy",
  "Leeds United": "leeds-united",
  "Leicester City": "leicester-city",
  "Lille": "lille",
  "Liverpool": "liverpool",
  "Los Angeles FC": "los-angeles-fc",
  "Manchester City": "manchester-city",
  "Manchester United": "manchester-united",
  "Napoli": "napoli",
  "Newcastle": "newcastle",
  "OGC Nice": "ogc-nice",
  "Olympique Lyonnais": "olympique-lyonnais",
  "PSV": "psv",
  "Paris Saint-Germain": "paris-saint-germain",
  "Piemonte Calcio": "piemonte-calcio",
  "Rangers": "rangers",
  "Real Madrid": "real-madrid",
  "Sevilla FC": "sevilla-fc",
  "Stoke City": "stoke-city",
  "Tottenham Hotspur": "tottenham-hotspur",
  "Villarreal": "villarreal",
  "West Ham United": "west-ham-united",
  "Wolverhampton": "wolverhampton",
};

const FUT_CARD_TYPE_LABELS: Record<string, string> = {
  gold_rare: "Gold Rare",
  icon: "Icon",
  toty: "TOTY",
  tots: "TOTS",
  totw: "TOTW",
  headliners: "Headliners",
  future_stars: "Future Stars",
  sbc: "SBC",
  flashback: "Flashback",
  eoae: "End of an Era",
  potm: "POTM",
  fut_birthday: "FUT Birthday",
  futties: "FUTTIES",
  rulebreakers: "Rulebreakers",
  record_breaker: "Record Breaker",
  hero: "Hero",
  winter_wildcards: "Winter Wildcards",
  showdown: "Showdown",
  objetivos: "Objetivos",
  otw: "OTW",
};

interface FutCardQuestionViewProps {
  question: FutCardQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function FutCardQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: FutCardQuestionViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = FUT_CARD_COLORS[question.cardType] || FUT_CARD_COLORS.gold_rare;
  const cardTypeLabel = FUT_CARD_TYPE_LABELS[question.cardType] || question.cardType;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const stats = question.stats;

  return (
    <>
      {/* Header */}
      <div className="mb-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🃏</span>
          <span className="text-xs font-medium text-surface-300">Devine la Carte FUT</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quel joueur se cache derrière cette carte ?
        </h2>
      </div>

      {/* FUT Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotateY: -10 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex justify-center mb-4"
      >
        <div className={cn(
          "relative w-56 sm:w-64 rounded-2xl overflow-hidden shadow-2xl border border-white/10",
          "bg-gradient-to-br",
          colors.bg
        )}>
          {/* Card type badge */}
          <div className="absolute top-2 right-2 z-10">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm",
              colors.accent
            )}>
              {cardTypeLabel}
            </span>
          </div>

          {/* FIFA edition */}
          <div className="absolute top-2 left-2 z-10">
            <span className="text-[10px] font-medium text-white/50 px-2 py-0.5 rounded-full bg-black/20">
              {question.fifaEdition}
            </span>
          </div>

          <div className="p-4 pt-8">
            {/* Rating + Position */}
            <div className="flex items-start gap-2 mb-3">
              <div className="text-left">
                <div className={cn("text-4xl font-display font-black leading-none", colors.accent)}>
                  {question.rating}
                </div>
                <div className={cn("text-sm font-bold mt-0.5", colors.accent)}>
                  {question.position}
                </div>
              </div>

              {/* Player silhouette */}
              <div className="flex-1 flex justify-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-black/20 border border-white/10 flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-16 h-16 sm:w-20 sm:h-20 opacity-30" fill="currentColor">
                    <circle cx="32" cy="20" r="12" className="text-white/60" />
                    <ellipse cx="32" cy="52" rx="20" ry="14" className="text-white/60" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Club logo */}
            <div className="flex items-center justify-center mb-3">
              {CLUB_LOGO_SLUGS[question.club] ? (
                <img
                  src={`/images/clubs/${CLUB_LOGO_SLUGS[question.club]}.png`}
                  alt=""
                  className="w-8 h-8 object-contain drop-shadow-lg"
                />
              ) : (
                <span className={cn("text-xs font-semibold", colors.accent)}>
                  {question.club}
                </span>
              )}
            </div>

            {/* Player name hidden */}
            <div className="text-center mb-3">
              <div className="inline-flex items-center gap-1 px-4 py-1 rounded-lg bg-black/30 border border-white/10">
                <span className="text-lg font-display font-bold text-white/40 tracking-widest">? ? ?</span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 px-2">
              {(question.position === "GK" ? [
                { label: "DIV", value: stats.pac },
                { label: "HAN", value: stats.sho },
                { label: "KIC", value: stats.pas },
                { label: "REF", value: stats.dri },
                { label: "SPD", value: stats.def },
                { label: "POS", value: stats.phy },
              ] : [
                { label: "PAC", value: stats.pac },
                { label: "SHO", value: stats.sho },
                { label: "PAS", value: stats.pas },
                { label: "DRI", value: stats.dri },
                { label: "DEF", value: stats.def },
                { label: "PHY", value: stats.phy },
              ]).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/50">{label}</span>
                  <span className={cn(
                    "text-sm font-display font-black",
                    value >= 90 ? "text-green-300" :
                    value >= 80 ? "text-lime-300" :
                    value >= 70 ? colors.accent :
                    "text-white/60"
                  )}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

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
              ref={inputRef}
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
// CHRONO QUESTION VIEW
// ==========================================

interface ChronoQuestionViewProps {
  question: ChronoQuestion;
  hasAnswered: boolean;
  chronoStartTime: number | null;
  chronoStopped: boolean;
  onStart: () => void;
  onStop: () => void;
}

function ChronoQuestionView({
  question,
  hasAnswered,
  chronoStartTime,
  chronoStopped,
  onStart,
  onStop,
}: ChronoQuestionViewProps) {
  const [displayElapsed, setDisplayElapsed] = useState<number | null>(null);
  useEffect(() => {
    if (chronoStartTime && chronoStopped) {
      setDisplayElapsed(Date.now() - chronoStartTime);
    } else {
      setDisplayElapsed(null);
    }
  }, [chronoStartTime, chronoStopped]);

  return (
    <>
      {/* Header */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-3">
          <span className="text-lg">⏱️</span>
          <span className="text-xs font-medium text-surface-300">Chronomètre</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 mb-2">
          Mesure exactement
        </h2>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-orange-500/20 to-red-700/20 border border-orange-500/30"
        >
          <span className="text-4xl sm:text-5xl font-display font-black text-orange-400">
            {question.label}
          </span>
        </motion.div>
      </div>

      {/* Action area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {!chronoStartTime && !hasAnswered && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-full"
          >
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onStart}
              className="py-8 text-2xl font-display font-bold"
            >
              START
            </Button>
            <p className="text-sm text-surface-500 text-center mt-3">
              Appuie sur START puis STOP quand tu penses que le temps est écoulé
            </p>
          </motion.div>
        )}

        {chronoStartTime && !chronoStopped && !hasAnswered && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-full"
          >
            <div className="text-center mb-6">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-6xl mb-2"
              >
                ⏱️
              </motion.div>
              <p className="text-lg text-surface-400">
                Le chrono tourne...
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onStop}
              className="py-8 text-2xl font-display font-bold bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
            >
              STOP
            </Button>
          </motion.div>
        )}

        {(chronoStopped || hasAnswered) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Tu as mesuré :</p>
                  <p className="text-2xl font-display font-bold text-surface-100">
                    {displayElapsed !== null
                      ? `${(displayElapsed / 1000).toFixed(3)}s`
                      : "..."}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </>
  );
}

// ==========================================
// CONSENSUS QUESTION VIEW
// ==========================================

interface ConsensusQuestionViewProps {
  question: ConsensusQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function ConsensusQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: ConsensusQuestionViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🤝</span>
          <span className="text-xs font-medium text-surface-300">Consensus</span>
        </div>
        <Badge variant="default" size="sm" className="ml-2">
          {question.category}
        </Badge>
      </div>

      {/* Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card variant="gradient" className="text-center">
          <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-balance">
            {question.prompt}
          </h2>
          <p className="text-sm text-surface-500 mt-2">
            Pense comme les autres joueurs !
          </p>
        </Card>
      </motion.div>

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
              ref={inputRef}
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ta réponse..."
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
// DIALED QUESTION VIEW (Color Memory Game)
// ==========================================

interface DialedQuestionViewProps {
  question: DialedQuestion;
  h: number;
  s: number;
  l: number;
  onChangeH: (v: number) => void;
  onChangeS: (v: number) => void;
  onChangeL: (v: number) => void;
  hasAnswered: boolean;
  submitted: boolean;
  onSubmit: () => void;
  timeRemaining: number;
}

function DialedQuestionView({
  question,
  h, s, l,
  onChangeH, onChangeS, onChangeL,
  hasAnswered,
  submitted,
  onSubmit,
  timeRemaining,
}: DialedQuestionViewProps) {
  const memDuration = question.memorizeDuration || 5;
  const totalTime = question.timeLimit;
  const elapsed = totalTime - timeRemaining;
  const isMemorizing = elapsed < memDuration;

  const targetColor = `hsl(${question.targetH}, ${question.targetS}%, ${question.targetL}%)`;
  const guessColor = `hsl(${h}, ${s}%, ${l}%)`;

  return (
    <>
      <div className="text-center mb-4">
        <AnimatePresence mode="wait">
          {isMemorizing ? (
            <motion.div
              key="memorize"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p className="text-lg font-display font-bold text-surface-100">
                Mémorise cette couleur !
              </p>
              <p className="text-sm text-surface-400 mt-1">
                {Math.max(0, Math.ceil(memDuration - elapsed))}s restantes
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="guess"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <p className="text-lg font-display font-bold text-surface-100">
                Reproduis la couleur !
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-4 mb-6">
        <motion.div
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-2 border-surface-700 shadow-lg flex items-center justify-center overflow-hidden"
          style={{
            backgroundColor: isMemorizing ? targetColor : "transparent",
          }}
          animate={{
            scale: isMemorizing ? [1, 1.02, 1] : 1,
          }}
          transition={{ duration: 1.5, repeat: isMemorizing ? Infinity : 0 }}
        >
          {!isMemorizing && (
            <div className="text-center">
              <div className="text-3xl mb-1">&#x2753;</div>
              <span className="text-xs text-surface-500">Cible</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: isMemorizing ? 0.3 : 1, scale: 1 }}
          className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl border-2 border-surface-600 shadow-lg flex items-center justify-center"
          style={{ backgroundColor: guessColor }}
        >
          {isMemorizing && (
            <span className="text-xs text-white/60 font-medium drop-shadow">Ton choix</span>
          )}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        {hasAnswered || submitted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Card className="inline-block">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-success-400" />
                <div className="text-left">
                  <p className="text-sm text-surface-400">Couleur envoyée !</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-8 h-8 rounded-lg border border-surface-600"
                      style={{ backgroundColor: guessColor }}
                    />
                    <span className="text-sm text-surface-300 font-mono">
                      H:{h} S:{s} L:{l}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isMemorizing ? 0.4 : 1, y: 0 }}
            className="space-y-4"
          >
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-surface-300 uppercase tracking-wide">
                  Teinte (H)
                </label>
                <span className="text-xs text-surface-400 font-mono">{h}°</span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                value={h}
                onChange={(e) => onChangeH(Number(e.target.value))}
                disabled={isMemorizing}
                className="w-full h-3 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-300 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{
                  background: "linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))",
                }}
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-surface-300 uppercase tracking-wide">
                  Saturation (S)
                </label>
                <span className="text-xs text-surface-400 font-mono">{s}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={s}
                onChange={(e) => onChangeS(Number(e.target.value))}
                disabled={isMemorizing}
                className="w-full h-3 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-300 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(${h},0%,${l}%), hsl(${h},100%,${l}%))`,
                }}
              />
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-surface-300 uppercase tracking-wide">
                  Luminosité (L)
                </label>
                <span className="text-xs text-surface-400 font-mono">{l}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={l}
                onChange={(e) => onChangeL(Number(e.target.value))}
                disabled={isMemorizing}
                className="w-full h-3 rounded-full appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface-300 [&::-webkit-slider-thumb]:cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(${h},${s}%,0%), hsl(${h},${s}%,50%), hsl(${h},${s}%,100%))`,
                }}
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onSubmit}
              disabled={isMemorizing}
              rightIcon={<Send className="w-5 h-5" />}
            >
              Valider ma couleur
            </Button>
          </motion.div>
        )}
      </div>
    </>
  );
}

// ==========================================
// POKEMON TRANSLATE QUESTION
// ==========================================

interface PokemonTranslateQuestionViewProps {
  question: PokemonTranslateQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function PokemonTranslateQuestionView({
  question,
  answer,
  hasAnswered,
  onChange,
  onSubmit,
}: PokemonTranslateQuestionViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <span className="text-lg">🌐</span>
          <span className="text-xs font-medium text-surface-300">Traduis le Pokémon</span>
        </div>
        <h2 className="text-base sm:text-lg font-display font-bold text-surface-100 text-balance">
          Comment s&apos;appelle ce Pokémon en français ?
        </h2>
      </div>

      {/* All 3 language names */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-2.5 mb-6"
      >
        {([
          { flag: "🇬🇧", label: "Anglais", name: question.nameEn },
          { flag: "🇩🇪", label: "Allemand", name: question.nameDe },
          { flag: "🇯🇵", label: "Japonais", name: question.nameJa },
        ] as const).map((lang, i) => (
          <motion.div
            key={lang.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.3 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-800/80 border border-surface-700"
          >
            <span className="text-2xl">{lang.flag}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-surface-500 block">{lang.label}</span>
              <span className="text-xl font-display font-bold text-surface-100">{lang.name}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Input */}
      <div className="mt-auto space-y-3">
        {hasAnswered ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-800 border border-surface-700"
          >
            <CheckCircle className="w-5 h-5 text-success-500" />
            <span className="text-surface-300 font-medium">Réponse envoyée !</span>
          </motion.div>
        ) : (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Nom français du Pokémon..."
              value={answer}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-1"
              autoComplete="off"
            />
            <Button
              variant="primary"
              size="md"
              onClick={onSubmit}
              disabled={!answer.trim()}
              rightIcon={<Send className="w-4 h-4" />}
            >
              OK
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ==========================================
// GEOGRAPHY MODES
// ==========================================

function GeoDifficultyBadge({ difficulty, points }: { difficulty: GeoDifficulty; points: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-[11px] font-medium border",
          difficulty === "easy"
            ? "bg-success-500/10 border-success-500/30 text-success-400"
            : difficulty === "medium"
            ? "bg-accent-500/10 border-accent-500/30 text-accent-400"
            : "bg-danger-500/10 border-danger-500/30 text-danger-400"
        )}
      >
        {GEO_DIFFICULTY_LABELS[difficulty]}
      </span>
      <span className="text-[11px] text-surface-500">{points} pts</span>
    </div>
  );
}

interface FlagQuestionViewProps {
  question: FlagQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function FlagQuestionView({ question, answer, hasAnswered, onChange, onSubmit }: FlagQuestionViewProps) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [question.flagUrl]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div className="mb-3 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <FlagIcon className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-medium text-surface-300">Devine le drapeau</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quel est ce pays ?
        </h2>
      </div>

      <motion.div
        key={question.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex justify-center mb-3"
      >
        <div className="w-full max-w-xs aspect-[3/2] rounded-2xl overflow-hidden bg-surface-800 border border-surface-700 shadow-lg">
          {imageError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-surface-500 gap-2">
              <FlagIcon className="w-8 h-8 text-surface-600" />
              <span className="text-xs">Drapeau indisponible</span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={question.flagUrl}
              alt="Drapeau à identifier"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          )}
        </div>
      </motion.div>

      <GeoDifficultyBadge difficulty={question.difficulty} points={question.points} />

      <div className="flex-1 flex flex-col justify-end mt-4">
        {hasAnswered ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
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
              placeholder="Nom du pays..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
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

interface CapitalQuestionViewProps {
  question: CapitalQuestion;
  answer: string;
  hasAnswered: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

function CapitalQuestionView({ question, answer, hasAnswered, onChange, onSubmit }: CapitalQuestionViewProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <>
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800 border border-surface-700 mb-2">
          <Landmark className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-xs font-medium text-surface-300">Devine la capitale</span>
        </div>
        <h2 className="text-lg sm:text-xl font-display font-bold text-surface-100 text-balance">
          Quelle est la capitale de…
        </h2>
      </div>

      <motion.div
        key={question.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 mb-3"
      >
        <div className="w-28 aspect-[3/2] rounded-xl overflow-hidden border border-surface-700 shadow-lg bg-surface-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.flagUrl} alt="" className="w-full h-full object-cover" />
        </div>
        <p className="text-2xl sm:text-3xl font-display font-bold text-surface-100 text-center text-balance">
          {question.countryName}
        </p>
        <span className="text-xs text-surface-500">{question.continent}</span>
      </motion.div>

      <GeoDifficultyBadge difficulty={question.difficulty} points={question.points} />

      <div className="flex-1 flex flex-col justify-end mt-4">
        {hasAnswered ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
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
              placeholder="Nom de la capitale..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
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

interface CityLocateQuestionViewProps {
  question: CityLocateQuestion;
  pick: { lat: number; lng: number; cca3: string | null; name: string | null } | null;
  hasAnswered: boolean;
  onPick: (pick: { lat: number; lng: number; cca3: string | null; name: string | null }) => void;
  onSubmit: () => void;
}

function CityLocateQuestionView({ question, pick, hasAnswered, onPick, onSubmit }: CityLocateQuestionViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 border border-surface-700 mb-1.5">
          <Building2 className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-xs font-medium text-surface-300">Localise la ville</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-balance">
          {question.cityName}
        </h2>
        {question.countryHint && (
          <p className="text-xs text-surface-500 mt-0.5">{question.countryHint}</p>
        )}
        <div className="mt-1">
          <GeoDifficultyBadge difficulty={question.difficulty} points={question.points} />
        </div>
      </div>

      {/* Same aspect box as the country mode: the whole world stays visible on a phone. */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full aspect-[360/216] max-h-full">
          <WorldMap
            className="h-full"
            selectedCca3={pick?.cca3 ?? null}
            pins={pick ? [{ lat: pick.lat, lng: pick.lng, highlight: true }] : []}
            onPick={hasAnswered ? undefined : onPick}
          />
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <div
          className={cn(
            "flex items-center justify-center gap-2 h-9 px-3 rounded-xl border text-sm",
            pick
              ? "bg-surface-800 border-surface-700 text-surface-100"
              : "bg-surface-900 border-dashed border-surface-700 text-surface-500"
          )}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {pick
              ? pick.name ?? "En pleine mer…"
              : "Zoome et touche l'endroit exact"}
          </span>
        </div>

        {hasAnswered ? (
          <div className="flex items-center justify-center gap-2 text-success-400 h-12">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Épingle plantée</span>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSubmit}
            disabled={!pick}
            rightIcon={<Send className="w-5 h-5" />}
          >
            Valider mon épingle
          </Button>
        )}
      </div>
    </div>
  );
}

interface CountryLocateQuestionViewProps {
  question: CountryLocateQuestion;
  pick: { lat: number; lng: number; cca3: string | null; name: string | null } | null;
  hasAnswered: boolean;
  onPick: (pick: { lat: number; lng: number; cca3: string | null; name: string | null }) => void;
  onSubmit: () => void;
}

function CountryLocateQuestionView({ question, pick, hasAnswered, onPick, onSubmit }: CountryLocateQuestionViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="mb-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800 border border-surface-700 mb-1.5">
          <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-surface-300">Localise le pays</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-8 aspect-[3/2] rounded overflow-hidden border border-surface-700 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={question.flagUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-surface-100 text-balance">
            {question.countryName}
          </h2>
        </div>
        <div className="mt-1">
          <GeoDifficultyBadge difficulty={question.difficulty} points={question.points} />
        </div>
      </div>

      {/* The map keeps the world's aspect ratio so no space is wasted on letterboxing. */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full aspect-[360/216] max-h-full">
          <WorldMap
            className="h-full"
            selectedCca3={pick?.cca3 ?? null}
            pins={pick ? [{ lat: pick.lat, lng: pick.lng, highlight: true }] : []}
            onPick={hasAnswered ? undefined : onPick}
          />
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <div
          className={cn(
            "flex items-center justify-center gap-2 h-9 px-3 rounded-xl border text-sm",
            pick
              ? "bg-surface-800 border-surface-700 text-surface-100"
              : "bg-surface-900 border-dashed border-surface-700 text-surface-500"
          )}
        >
          <MapPin className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {pick ? pick.name ?? "En pleine mer…" : "Touche la carte pour placer ton point"}
          </span>
        </div>

        {hasAnswered ? (
          <div className="flex items-center justify-center gap-2 text-success-400 h-12">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Position envoyée</span>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onSubmit}
            disabled={!pick}
            rightIcon={<Send className="w-5 h-5" />}
          >
            Valider ma position
          </Button>
        )}
      </div>
    </div>
  );
}
