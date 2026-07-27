"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Trophy, Zap } from "lucide-react";
import { Card, Avatar, Badge } from "@/components/ui";
import { useGameStore, useRoomStore, usePlayerStore } from "@/stores";
import { useChatStore } from "@/stores/chat-store";
import { useSocket } from "@/hooks";
import { cn } from "@/lib/utils";
import { WorldMap } from "./world-map";
import type { EstimationQuestion, PetitBacQuestion, MathsQuestion, ChronoQuestion, ConsensusQuestion, PokestatsRoundResult as PokestatsRoundResultType, PokemonAttackRoundResult as PokemonAttackRoundResultType, DialedQuestion, PokedexNumberQuestion, FlagQuestion, CapitalQuestion, CountryLocateQuestion, CityLocateQuestion } from "@/types";

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

function LaughButton({ targetPlayerId, roundNumber, myPlayerId }: { targetPlayerId: string; roundNumber: number; myPlayerId: string }) {
  const { sendLaughReaction } = useSocket();
  const reactions = useChatStore((s) => s.reactions);

  const laughCount = reactions.filter(
    (r) => r.targetPlayerId === targetPlayerId && r.roundNumber === roundNumber
  ).length;

  const alreadyLaughed = reactions.some(
    (r) => r.playerId === myPlayerId && r.targetPlayerId === targetPlayerId && r.roundNumber === roundNumber
  );

  if (targetPlayerId === myPlayerId) return null;

  return (
    <button
      onClick={() => {
        if (!alreadyLaughed) sendLaughReaction(targetPlayerId, roundNumber);
      }}
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all",
        alreadyLaughed
          ? "bg-amber-500/20 border border-amber-500/30"
          : "bg-surface-800 border border-surface-700 hover:bg-amber-500/10 hover:border-amber-500/20"
      )}
    >
      <span className="text-sm">😂</span>
      <AnimatePresence>
        {laughCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-amber-400 font-bold"
          >
            {laughCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export function RoundResult() {
  const roundResult = useGameStore((s) => s.roundResult);
  const players = useRoomStore((s) => s.players);
  const petitBacValidationData = useGameStore((s) => s.petitBacValidationData);
  const petitBacValidatedAnswers = useGameStore((s) => s.petitBacValidatedAnswers);
  const pokestatsRoundResult = useGameStore((s) => s.pokestatsRoundResult);
  const pokemonAttackRoundResult = useGameStore((s) => s.pokemonAttackRoundResult);
  const pokemonRoundResult = useGameStore((s) => s.pokemonRoundResult);
  const myPlayerId = usePlayerStore((s) => s.playerId);

  if (!roundResult) return null;
  const myResult = roundResult.scores.find((s) => s.playerId === myPlayerId);
  const isCorrect = myResult && myResult.points > 0;
  const isEstimation = roundResult.question.type === "estimation";
  const isParcours = roundResult.question.type === "parcours";
  const isPetitBac = roundResult.question.type === "petitbac";
  const isGeoQuiz = roundResult.question.type === "geoquiz";
  const isPokeGeo = roundResult.question.type === "pokegeo";
  const isJerseyNumber = roundResult.question.type === "jerseynumber";
  const isChrono = roundResult.question.type === "chrono";
  const isConsensus = roundResult.question.type === "consensus";
  const isPokestats = roundResult.question.type === "pokestats";
  const isPokemonAttack = roundResult.question.type === "pokemonattack";
  const isDialed = roundResult.question.type === "dialed";
  const isPokedexNumber = roundResult.question.type === "pokedexnumber";
  const isFlag = roundResult.question.type === "flag";
  const isCapital = roundResult.question.type === "capital";

  if (roundResult.question.type === "citylocate") {
    return (
      <CityLocateRoundResult
        roundResult={roundResult}
        myPlayerId={myPlayerId}
        myResult={myResult}
      />
    );
  }

  if (roundResult.question.type === "countrylocate") {
    return (
      <CountryLocateRoundResult
        roundResult={roundResult}
        myPlayerId={myPlayerId}
        myResult={myResult}
      />
    );
  }

  if (isDialed) {
    return (
      <DialedRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
      />
    );
  }

  if (isChrono) {
    return (
      <ChronoRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
      />
    );
  }

  if (isConsensus) {
    return (
      <ConsensusRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
      />
    );
  }

  if (isPetitBac) {
    return (
      <PetitBacRoundResult
        roundResult={roundResult}
        players={players}
        myPlayerId={myPlayerId}
        myResult={myResult}
        isCorrect={!!isCorrect}
        petitBacValidationData={petitBacValidationData}
        petitBacValidatedAnswers={petitBacValidatedAnswers}
      />
    );
  }

  if (isPokemonAttack && pokemonAttackRoundResult) {
    return (
      <PokemonAttackRoundResultView
        result={pokemonAttackRoundResult}
        myPlayerId={myPlayerId}
      />
    );
  }

  if (isPokestats && pokestatsRoundResult) {
    return (
      <PokestatsRoundResultView
        result={pokestatsRoundResult}
        myPlayerId={myPlayerId}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Result header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-8 pt-8"
      >
        <motion.div
          className={cn(
            "w-20 h-20 mx-auto rounded-2xl flex items-center justify-center mb-4",
            isCorrect ? "bg-success-500" : "bg-danger-500"
          )}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {isCorrect ? (
            <CheckCircle className="w-10 h-10 text-white" />
          ) : (
            <XCircle className="w-10 h-10 text-white" />
          )}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "text-2xl font-display font-bold",
            isCorrect ? "text-success-400" : "text-danger-400"
          )}
        >
          {isEstimation
            ? isCorrect
              ? "Bien estimé !"
              : "Pas facile !"
            : isParcours
            ? isCorrect
              ? "Bien trouvé !"
              : "Perdu !"
            : isGeoQuiz || isPokeGeo
            ? isCorrect
              ? "Bien localisé !"
              : "Perdu !"
            : isJerseyNumber || isPokedexNumber
            ? isCorrect
              ? "Pile dessus !"
              : myResult && myResult.points > 0
              ? "Pas mal !"
              : "Trop loin !"
            : isConsensus
            ? isCorrect
              ? "Dans le consensus !"
              : "Pas dans la majorité !"
            : isFlag
            ? isCorrect
              ? "Drapeau reconnu !"
              : "Raté !"
            : isCapital
            ? isCorrect
              ? "Bien joué !"
              : "Raté !"
            : isCorrect
            ? "Bonne réponse !"
            : "Raté !"}
        </motion.h2>

        {myResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2"
          >
            {isCorrect ? (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-accent-400" />
                <span className="text-xl font-display font-bold text-surface-100">
                  +{myResult.points} points
                </span>
              </div>
            ) : (
              <span className="text-surface-500">0 points</span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Correct answer */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="mb-6">
          <div className="text-center">
            <p className="text-sm text-surface-400 mb-2">
              {isEstimation
                ? "Le vrai prix :"
                : isParcours
                ? "Le joueur était :"
                : isGeoQuiz
                ? "La ville était :"
                : isPokeGeo
                ? "Le lieu était :"
                : isJerseyNumber
                ? "Le vrai numéro :"
                : isPokedexNumber
                ? "Le vrai numéro Pokédex :"
                : isConsensus
                ? "Réponse la plus populaire :"
                : isFlag
                ? "Le pays était :"
                : isCapital
                ? "La capitale était :"
                : "La bonne réponse était :"}
            </p>
            {(isFlag || isCapital) && (
              <div className="flex justify-center mb-2">
                <div className="w-20 aspect-[3/2] rounded-lg overflow-hidden border border-surface-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(roundResult.question as FlagQuestion | CapitalQuestion).flagUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <p className="text-2xl font-display font-bold text-surface-100">
              {roundResult.correctAnswer}
            </p>
            {isEstimation && (
              <p className="text-xs text-surface-500 mt-1">
                {(roundResult.question as EstimationQuestion).productName}
              </p>
            )}
            {isPokedexNumber && (
              <p className="text-xs text-surface-500 mt-1">
                {(roundResult.question as PokedexNumberQuestion).nameFr}
              </p>
            )}
            {(isFlag || isCapital) && (
              <p className="text-xs text-surface-500 mt-1">
                {(roundResult.question as FlagQuestion | CapitalQuestion).continent}
              </p>
            )}
          </div>
        </Card>
        {/* Pokémon reveal image */}
        {pokemonRoundResult?.imageUrl && roundResult.question.type === "pokemon" && (
          <div className="flex justify-center mt-4">
            <div className="relative w-40 h-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pokemonRoundResult.imageUrl}
                alt={pokemonRoundResult.nameFr || "Pokémon"}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Winner of the round */}
      {roundResult.winner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card variant="gradient" className="mb-6">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-6 h-6 text-accent-400" />
              <div className="flex items-center gap-2">
                <Avatar emoji={roundResult.winner.avatar} size="sm" />
                <span className="font-medium text-surface-100">
                  {roundResult.winner.name}
                </span>
              </div>
              <Badge variant="warning" size="sm">
                {isEstimation || isPokedexNumber
                  ? "Le plus proche !"
                  : isGeoQuiz
                  ? "Globe-trotteur !"
                  : isChrono
                  ? "Le plus précis !"
                  : isConsensus
                  ? "Le plus rapide !"
                  : "Le plus rapide !"}
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* All players results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex-1"
      >
        <h3 className="text-sm font-medium text-surface-400 mb-3">
          Résultats de la manche
        </h3>
        <div className="space-y-2">
          {roundResult.scores
            .sort((a, b) => b.points - a.points)
            .map((score, index) => {
              const player = players.find((p) => p.id === score.playerId);
              if (!player) return null;

              const answer = roundResult.answers.find(
                (a) => a.playerId === score.playerId
              );

              return (
                <motion.div
                  key={score.playerId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    "bg-surface-900 border border-surface-800",
                    score.playerId === myPlayerId && "border-brand-500/40"
                  )}
                >
                  <Avatar emoji={player.avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-surface-100 truncate">
                        {player.name}
                      </span>
                      {answer?.isCorrect && (
                        <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />
                      )}
                    </div>
                    {answer && (
                      <p
                        className={cn(
                          "text-sm truncate",
                          answer.isCorrect ? "text-success-400" : "text-surface-500"
                        )}
                      >
                        {isChrono
                          ? (() => {
                              const measured = parseInt(answer.answer, 10);
                              const target = (roundResult.question as ChronoQuestion).targetDuration;
                              if (isNaN(measured)) return "Pas de réponse";
                              const diff = measured - target;
                              const sign = diff >= 0 ? "+" : "";
                              return `${(measured / 1000).toFixed(3)}s (${sign}${diff}ms)`;
                            })()
                          : isEstimation
                          ? (() => {
                              const guess = parseFloat(answer.answer.replace(",", "."));
                              const real = (roundResult.question as EstimationQuestion).correctValue;
                              const unit = (roundResult.question as EstimationQuestion).unit;
                              if (isNaN(guess)) return "Pas de réponse";
                              const dev = Math.round(Math.abs(guess - real) / real * 100);
                              return `${guess.toLocaleString("fr-FR")} ${unit} (${dev}% d'écart)`;
                            })()
                          : roundResult.question.type === "maths"
                          ? (() => {
                              const idx = parseInt(answer.answer, 10);
                              const opts = (roundResult.question as MathsQuestion).options;
                              return (!isNaN(idx) && opts && opts[idx]) ? opts[idx] : (answer.answer || "Pas de réponse");
                            })()
                          : isJerseyNumber || isPokedexNumber
                          ? (answer.answer ? `N°${answer.answer}` : "Pas de réponse")
                          : answer.answer || "Pas de réponse"}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {answer && !answer.isCorrect && (
                      <LaughButton
                        targetPlayerId={score.playerId}
                        roundNumber={roundResult.roundNumber}
                        myPlayerId={myPlayerId}
                      />
                    )}
                    <span
                      className={cn(
                        "font-display font-bold",
                        score.points > 0 ? "text-success-400" : "text-surface-500"
                      )}
                    >
                      +{score.points}
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// COUNTRY LOCATE ROUND RESULT
// ==========================================

interface CountryLocateRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
}

function CountryLocateRoundResult({ roundResult, myPlayerId, myResult }: CountryLocateRoundResultProps) {
  const q = roundResult.question as CountryLocateQuestion;
  const entries = useMemo(
    () => [...(roundResult.countryLocate ?? [])].sort((a, b) => b.points - a.points),
    [roundResult.countryLocate]
  );
  const mine = entries.find((e) => e.playerId === myPlayerId);
  const isCorrect = !!mine?.correct;

  const pins = useMemo(
    () =>
      entries
        .filter((e) => e.lat !== null && e.lng !== null)
        .map((e) => ({
          lat: e.lat as number,
          lng: e.lng as number,
          emoji: e.playerAvatar,
          correct: e.correct,
          highlight: e.playerId === myPlayerId,
        })),
    [entries, myPlayerId]
  );

  // Zoom wide enough to show near misses around the answer.
  const focus = useMemo(() => ({ lat: q.lat, lng: q.lng, span: 90 }), [q.lat, q.lng]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4 overflow-y-auto"
    >
      <div className="text-center pt-4 mb-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-8 aspect-[3/2] rounded overflow-hidden border border-surface-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.flagUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-display font-bold text-surface-100">{q.countryName}</h2>
        </div>
        <p className={cn("text-sm font-medium", isCorrect ? "text-success-400" : "text-danger-400")}>
          {isCorrect ? "Pile dessus !" : mine && mine.points > 0 ? "Pas loin !" : "Complètement à côté !"}
          {myResult && (
            <span className="text-surface-400 font-normal"> · +{myResult.points} pts</span>
          )}
        </p>
      </div>

      <WorldMap
        className="h-64 shrink-0"
        correctCca3={q.cca3}
        pins={pins}
        focus={focus}
      />

      <div className="mt-4">
        <h3 className="text-sm font-medium text-surface-400 mb-2">Résultats de la manche</h3>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800",
                entry.playerId === myPlayerId && "border-brand-500/40"
              )}
            >
              <Avatar emoji={entry.playerAvatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-surface-100 truncate">{entry.playerName}</span>
                  {entry.correct && <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />}
                </div>
                <p className={cn("text-sm truncate", entry.correct ? "text-success-400" : "text-surface-500")}>
                  {entry.lat === null
                    ? "Pas de réponse"
                    : entry.correct
                    ? "Dans le bon pays"
                    : `${entry.guessedName ?? "En pleine mer"} · ${entry.distanceKm?.toLocaleString("fr-FR")} km`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!entry.correct && entry.lat !== null && (
                  <LaughButton
                    targetPlayerId={entry.playerId}
                    roundNumber={roundResult.roundNumber}
                    myPlayerId={myPlayerId}
                  />
                )}
                <span className={cn("font-display font-bold", entry.points > 0 ? "text-success-400" : "text-surface-500")}>
                  +{entry.points}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// CITY LOCATE ROUND RESULT
// ==========================================

interface CityLocateRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
}

function CityLocateRoundResult({ roundResult, myPlayerId, myResult }: CityLocateRoundResultProps) {
  const q = roundResult.question as CityLocateQuestion;
  const entries = useMemo(
    () => [...(roundResult.cityLocate ?? [])].sort((a, b) => b.points - a.points),
    [roundResult.cityLocate]
  );
  const mine = entries.find((e) => e.playerId === myPlayerId);

  // The answer is drawn last so it sits on top of the players' pins.
  const pins = useMemo(
    () => [
      ...entries
        .filter((e) => e.lat !== null && e.lng !== null)
        .map((e) => ({
          lat: e.lat as number,
          lng: e.lng as number,
          emoji: e.playerAvatar,
          correct: e.correct,
          highlight: e.playerId === myPlayerId,
        })),
      { lat: q.lat, lng: q.lng, target: true },
    ],
    [entries, myPlayerId, q.lat, q.lng]
  );

  // Centred on the answer, zoomed out just enough to keep your own pin in frame —
  // seeing how far off you were is half the fun.
  const focus = useMemo(() => {
    const dLng = mine?.lng != null ? Math.abs(mine.lng - q.lng) : 0;
    const dLat = mine?.lat != null ? Math.abs(mine.lat - q.lat) : 0;
    return {
      lat: q.lat,
      lng: q.lng,
      span: Math.min(200, Math.max(40, Math.max(dLng, dLat * 1.6) * 2.4)),
    };
  }, [mine, q.lat, q.lng]);

  const verdict = !mine || mine.lat === null
    ? "Pas de réponse"
    : mine.correct
    ? "Pile dessus !"
    : mine.sameCountry
    ? "Le bon pays !"
    : mine.points > 0
    ? "Pas loin !"
    : "Complètement à côté !";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4 overflow-y-auto"
    >
      <div className="text-center pt-4 mb-3">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-8 aspect-[3/2] rounded overflow-hidden border border-surface-700">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.flagUrl} alt="" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-display font-bold text-surface-100">{q.cityName}</h2>
        </div>
        <p className="text-xs text-surface-500 mb-1">{q.countryName}</p>
        <p className={cn("text-sm font-medium", mine?.points ? "text-success-400" : "text-danger-400")}>
          {verdict}
          {mine?.distanceKm !== null && mine?.distanceKm !== undefined && (
            <span className="text-surface-400 font-normal"> · à {mine.distanceKm.toLocaleString("fr-FR")} km</span>
          )}
          {myResult && <span className="text-surface-400 font-normal"> · +{myResult.points} pts</span>}
        </p>
      </div>

      <WorldMap className="h-64 shrink-0" correctCca3={q.cca3} pins={pins} focus={focus} />

      <div className="mt-4">
        <h3 className="text-sm font-medium text-surface-400 mb-2">Résultats de la manche</h3>
        <div className="space-y-2">
          {entries.map((entry, index) => (
            <motion.div
              key={entry.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800",
                entry.playerId === myPlayerId && "border-brand-500/40"
              )}
            >
              <Avatar emoji={entry.playerAvatar} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-surface-100 truncate">{entry.playerName}</span>
                  {entry.correct && <CheckCircle className="w-4 h-4 text-success-400 shrink-0" />}
                </div>
                <p className={cn("text-sm truncate", entry.correct ? "text-success-400" : "text-surface-500")}>
                  {entry.lat === null
                    ? "Pas de réponse"
                    : `${entry.distanceKm?.toLocaleString("fr-FR")} km${
                        entry.sameCountry ? " · dans le bon pays" : entry.guessedName ? ` · ${entry.guessedName}` : " · en pleine mer"
                      }`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!entry.correct && entry.lat !== null && (
                  <LaughButton
                    targetPlayerId={entry.playerId}
                    roundNumber={roundResult.roundNumber}
                    myPlayerId={myPlayerId}
                  />
                )}
                <span className={cn("font-display font-bold", entry.points > 0 ? "text-success-400" : "text-surface-500")}>
                  +{entry.points}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// PETIT BAC ROUND RESULT
// ==========================================

interface PetitBacRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
  petitBacValidationData: ReturnType<typeof useGameStore.getState>["petitBacValidationData"];
  petitBacValidatedAnswers: ReturnType<typeof useGameStore.getState>["petitBacValidatedAnswers"];
}

function PetitBacRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
  petitBacValidationData,
  petitBacValidatedAnswers,
}: PetitBacRoundResultProps) {
  const q = roundResult.question as PetitBacQuestion;

  // Parse all player answers from JSON
  const parsedAnswers = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const answer of roundResult.answers) {
      try {
        map[answer.playerId] = JSON.parse(answer.answer);
      } catch {
        map[answer.playerId] = {};
      }
    }
    return map;
  }, [roundResult.answers]);

  // Build player info list (sorted by score)
  const sortedScores = [...roundResult.scores].sort((a, b) => b.points - a.points);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Compact header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-4 pt-4"
      >
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center">
            <span className="text-xl font-display font-black text-white">
              {q.letter}
            </span>
          </div>
          <div className="text-left">
            <h2
              className={cn(
                "text-lg font-display font-bold",
                isCorrect ? "text-success-400" : "text-danger-400"
              )}
            >
              {isCorrect ? "Bien joué !" : "Pas facile !"}
            </h2>
            {myResult && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-accent-400" />
                <span className="text-base font-display font-bold text-surface-100">
                  +{myResult.points} pts
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Winner */}
      {roundResult.winner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <Card variant="gradient">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-5 h-5 text-accent-400" />
              <Avatar emoji={roundResult.winner.avatar} size="sm" />
              <span className="font-medium text-surface-100">
                {roundResult.winner.name}
              </span>
              <Badge variant="warning" size="sm">
                Meilleur score !
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Category-by-category answers */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3"
      >
        {q.categories.map((category, catIdx) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + catIdx * 0.06 }}
            className="rounded-xl bg-surface-900 border border-surface-800 overflow-hidden"
          >
            {/* Category header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/50 border-b border-surface-800">
              <span className="text-sm">
                {PETITBAC_CATEGORY_ICONS[category] || "📝"}
              </span>
              <span className="text-xs font-medium text-surface-300">
                {category}
              </span>
            </div>

            {/* Player answers for this category */}
            <div className="divide-y divide-surface-800/50">
              {sortedScores.map((score) => {
                const player = players.find((p) => p.id === score.playerId);
                if (!player) return null;

                const answer = (parsedAnswers[score.playerId]?.[category] || "").trim();
                const isValidated = petitBacValidatedAnswers?.[category]?.includes(score.playerId) ?? false;

                return (
                  <div
                    key={score.playerId}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5",
                      score.playerId === myPlayerId && "bg-brand-500/5"
                    )}
                  >
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-xs text-surface-400 w-14 truncate shrink-0">
                      {player.name}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm truncate",
                        !answer
                          ? "text-surface-600 italic"
                          : isValidated
                          ? "text-surface-100"
                          : "text-surface-500 line-through"
                      )}
                    >
                      {answer || "—"}
                    </span>
                    {answer && (
                      <span className="shrink-0 flex items-center gap-1">
                        {isValidated ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-success-400" />
                            <span className="text-xs font-bold text-success-400">
                              30
                            </span>
                          </>
                        ) : (
                          <>
                            <LaughButton
                              targetPlayerId={score.playerId}
                              roundNumber={roundResult.roundNumber}
                              myPlayerId={myPlayerId}
                            />
                            <XCircle className="w-4 h-4 text-danger-400/60" />
                          </>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Score summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-3"
      >
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {sortedScores.map((score) => {
            const player = players.find((p) => p.id === score.playerId);
            if (!player) return null;
            return (
              <div
                key={score.playerId}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                  "bg-surface-900 border border-surface-800",
                  score.playerId === myPlayerId && "border-brand-500/40"
                )}
              >
                <Avatar emoji={player.avatar} size="sm" />
                <span className="text-xs text-surface-400">{player.name}</span>
                <span
                  className={cn(
                    "text-sm font-display font-bold",
                    score.points > 0 ? "text-success-400" : "text-surface-500"
                  )}
                >
                  +{score.points}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// CHRONO ROUND RESULT
// ==========================================

interface ChronoRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
}

function ChronoRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
}: ChronoRoundResultProps) {
  const q = roundResult.question as ChronoQuestion;
  const sortedScores = [...roundResult.scores].sort((a, b) => b.points - a.points);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-6 pt-6"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-700 flex items-center justify-center">
            <span className="text-2xl">⏱️</span>
          </div>
          <div className="text-left">
            <h2
              className={cn(
                "text-lg font-display font-bold",
                isCorrect ? "text-success-400" : "text-danger-400"
              )}
            >
              {isCorrect ? "Bien chronométré !" : "Pas facile !"}
            </h2>
            {myResult && (
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-accent-400" />
                <span className="text-base font-display font-bold text-surface-100">
                  +{myResult.points} pts
                </span>
              </div>
            )}
          </div>
        </div>

        <Card className="inline-block">
          <p className="text-sm text-surface-400">Cible</p>
          <p className="text-2xl font-display font-bold text-orange-400">
            {(q.targetDuration / 1000).toFixed(3)}s
          </p>
        </Card>
      </motion.div>

      {/* Winner */}
      {roundResult.winner && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <Card variant="gradient">
            <div className="flex items-center justify-center gap-3">
              <Trophy className="w-5 h-5 text-accent-400" />
              <Avatar emoji={roundResult.winner.avatar} size="sm" />
              <span className="font-medium text-surface-100">
                {roundResult.winner.name}
              </span>
              <Badge variant="warning" size="sm">
                Gagnant !
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Player results */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex-1 space-y-2"
      >
        {sortedScores.map((score, index) => {
          const player = players.find((p) => p.id === score.playerId);
          if (!player) return null;

          const answer = roundResult.answers.find((a) => a.playerId === score.playerId);
          const measured = answer ? parseInt(answer.answer, 10) : NaN;
          const diff = !isNaN(measured) ? measured - q.targetDuration : null;

          return (
            <motion.div
              key={score.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                "bg-surface-900 border border-surface-800",
                score.playerId === myPlayerId && "border-brand-500/40"
              )}
            >
              {index === 0 && score.points > 0 && (
                <span className="text-lg">🏆</span>
              )}
              <Avatar emoji={player.avatar} size="sm" />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-surface-100 truncate block">
                  {player.name}
                </span>
                {!isNaN(measured) ? (
                  <span className={cn(
                    "text-sm",
                    answer?.isCorrect ? "text-success-400" : "text-surface-500"
                  )}>
                    {(measured / 1000).toFixed(3)}s
                    {diff !== null && (
                      <span className="ml-1 text-xs">
                        ({diff >= 0 ? "+" : ""}{diff}ms)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-sm text-surface-600">Pas de réponse</span>
                )}
              </div>
              <span
                className={cn(
                  "font-display font-bold",
                  score.points > 0 ? "text-success-400" : "text-surface-500"
                )}
              >
                +{score.points}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// CONSENSUS ROUND RESULT
// ==========================================

interface ConsensusRoundResultProps {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult: { playerId: string; points: number; total: number } | undefined;
  isCorrect: boolean;
}

function ConsensusRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
  isCorrect,
}: ConsensusRoundResultProps) {
  // Group answers
  const answerGroups = useMemo(() => {
    const groups = new Map<string, { rawAnswer: string; playerIds: string[]; isWinning: boolean }>();

    for (const answer of roundResult.answers) {
      const normalized = answer.answer
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      if (!normalized) continue;

      if (!groups.has(normalized)) {
        groups.set(normalized, { rawAnswer: answer.answer.trim(), playerIds: [], isWinning: false });
      }
      groups.get(normalized)!.playerIds.push(answer.playerId);
    }

    // Find max group size
    let maxSize = 0;
    for (const [, group] of groups) {
      if (group.playerIds.length > maxSize) maxSize = group.playerIds.length;
    }

    // Mark winners
    for (const [, group] of groups) {
      if (group.playerIds.length === maxSize && maxSize > 0) {
        group.isWinning = true;
      }
    }

    // Sort: winning first, then by size desc
    return Array.from(groups.values()).sort((a, b) => {
      if (a.isWinning !== b.isWinning) return a.isWinning ? -1 : 1;
      return b.playerIds.length - a.playerIds.length;
    });
  }, [roundResult.answers]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-6 pt-6"
      >
        <div className={cn(
          "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3",
          isCorrect ? "bg-success-500" : "bg-danger-500"
        )}>
          {isCorrect ? (
            <CheckCircle className="w-8 h-8 text-white" />
          ) : (
            <XCircle className="w-8 h-8 text-white" />
          )}
        </div>
        <h2
          className={cn(
            "text-xl font-display font-bold",
            isCorrect ? "text-success-400" : "text-danger-400"
          )}
        >
          {isCorrect ? "Dans le consensus !" : "Pas dans la majorité !"}
        </h2>
        {myResult && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Zap className="w-4 h-4 text-accent-400" />
            <span className="text-base font-display font-bold text-surface-100">
              +{myResult.points} pts
            </span>
          </div>
        )}
      </motion.div>

      {/* Answer groups */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex-1 overflow-y-auto space-y-3"
      >
        {answerGroups.map((group, groupIdx) => (
          <motion.div
            key={groupIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + groupIdx * 0.1 }}
            className={cn(
              "rounded-xl overflow-hidden border",
              group.isWinning
                ? "bg-success-500/10 border-success-500/30"
                : "bg-surface-900 border-surface-800"
            )}
          >
            {/* Group header */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2.5",
              group.isWinning ? "bg-success-500/10" : "bg-surface-800/50"
            )}>
              {group.isWinning && <span className="text-lg">🏆</span>}
              <span className={cn(
                "font-display font-bold text-lg",
                group.isWinning ? "text-success-400" : "text-surface-300"
              )}>
                &ldquo;{group.rawAnswer}&rdquo;
              </span>
              <span className="text-xs text-surface-500 ml-auto">
                {group.playerIds.length} joueur{group.playerIds.length > 1 ? "s" : ""}
              </span>
              {group.isWinning && (
                <Badge variant="success" size="sm">
                  Gagnant !
                </Badge>
              )}
            </div>

            {/* Players in this group */}
            <div className="divide-y divide-surface-800/50">
              {group.playerIds.map((pid) => {
                const player = players.find((p) => p.id === pid);
                const score = roundResult.scores.find((s) => s.playerId === pid);
                if (!player) return null;

                return (
                  <div
                    key={pid}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2",
                      pid === myPlayerId && "bg-brand-500/5"
                    )}
                  >
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-sm text-surface-300 flex-1">
                      {player.name}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-display font-bold",
                        (score?.points ?? 0) > 0 ? "text-success-400" : "text-surface-500"
                      )}
                    >
                      +{score?.points ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Players who didn't answer */}
        {(() => {
          const answeredIds = new Set(roundResult.answers.map((a) => a.playerId));
          const noAnswer = players.filter((p) => !answeredIds.has(p.id));
          if (noAnswer.length === 0) return null;

          return (
            <div className="rounded-xl bg-surface-900 border border-surface-800 overflow-hidden">
              <div className="px-4 py-2 bg-surface-800/50">
                <span className="text-xs text-surface-500">Pas de réponse</span>
              </div>
              <div className="divide-y divide-surface-800/50">
                {noAnswer.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 px-4 py-2">
                    <Avatar emoji={player.avatar} size="sm" />
                    <span className="text-sm text-surface-500">{player.name}</span>
                    <span className="text-sm font-display font-bold text-surface-500 ml-auto">+0</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// POKEMON STATS ROUND RESULT
// ==========================================

const POKESTATS_TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-400", Fire: "bg-orange-500", Water: "bg-blue-500",
  Electric: "bg-yellow-400", Grass: "bg-green-500", Ice: "bg-cyan-300",
  Fighting: "bg-red-700", Poison: "bg-purple-500", Ground: "bg-amber-600",
  Flying: "bg-indigo-300", Psychic: "bg-pink-500", Bug: "bg-lime-500",
  Rock: "bg-yellow-700", Ghost: "bg-purple-700", Dragon: "bg-indigo-600",
  Dark: "bg-stone-700", Steel: "bg-slate-400", Fairy: "bg-pink-300",
};

function PokestatsRoundResultView({
  result,
  myPlayerId,
}: {
  result: PokestatsRoundResultType;
  myPlayerId: string;
}) {
  const myResult = result.playerResults.find((r) => r.playerId === myPlayerId);
  const imageUrl = `/images/pokemon/${result.pokemonId}.png`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-4 pb-4 overflow-y-auto"
    >
      {/* Pokémon reveal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center pt-4 mb-4"
      >
        {/* Pokémon image */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-32 h-32 mx-auto mb-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={result.nameFr}
            className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.3)]"
          />
        </motion.div>

        {/* Pokémon name */}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-display font-bold text-yellow-400 mb-1"
        >
          {result.nameFr}
        </motion.h2>
        {result.nameFr !== result.nameEn && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-surface-400"
          >
            {result.nameEn}
          </motion.p>
        )}

        {/* Type badges + info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-3"
        >
          {result.typesFr.map((t, i) => (
            <span
              key={i}
              className={cn(
                "text-xs font-bold px-2.5 py-0.5 rounded-full text-white",
                POKESTATS_TYPE_COLORS[result.types[i]] || "bg-surface-600"
              )}
            >
              {t}
            </span>
          ))}
          <span className="text-xs text-surface-500">
            Gen {result.generation}
          </span>
          {result.abilitiesFr[0] && (
            <span className="text-xs text-surface-500">
              {result.abilitiesFr[0]}
            </span>
          )}
        </motion.div>

        {/* My result */}
        {myResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-3"
          >
            {myResult.found ? (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-accent-400" />
                <span className="text-xl font-display font-bold text-surface-100">
                  +{myResult.points} pts
                </span>
              </div>
            ) : (
              <span className="text-surface-500">Pas trouvé</span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Player results */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="space-y-1.5"
      >
        {result.playerResults.map((pr, i) => (
          <motion.div
            key={pr.playerId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 + i * 0.1 }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border",
              pr.found
                ? "bg-lime-500/10 border-lime-500/20"
                : "bg-surface-900/50 border-surface-800"
            )}
          >
            <Avatar emoji={pr.playerAvatar} size="sm" />
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm font-medium truncate block",
                pr.playerId === myPlayerId ? "text-yellow-400" : "text-surface-200"
              )}>
                {pr.playerName}
              </span>
              <span className="text-[10px] text-surface-500">
                {pr.found
                  ? `${pr.hintsUsed} indice${pr.hintsUsed !== 1 ? "s" : ""}`
                  : "Pas trouvé"}
              </span>
            </div>
            <span className={cn(
              "text-sm font-display font-bold",
              pr.found ? "text-lime-400" : "text-surface-600"
            )}>
              +{pr.points}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// POKEMON ATTACK ROUND RESULT
// ==========================================

const ATTACK_TYPE_COLORS: Record<string, string> = {
  Normal: "bg-gray-400",
  Feu: "bg-orange-500",
  Eau: "bg-blue-500",
  "Électrik": "bg-yellow-400",
  Plante: "bg-green-500",
  Glace: "bg-cyan-300",
  Combat: "bg-red-700",
  Poison: "bg-purple-500",
  Sol: "bg-amber-600",
  Vol: "bg-indigo-300",
  Psy: "bg-pink-500",
  Insecte: "bg-lime-500",
  Roche: "bg-yellow-700",
  Spectre: "bg-purple-700",
  Dragon: "bg-indigo-600",
  "Ténèbres": "bg-stone-700",
  Acier: "bg-slate-400",
  "Fée": "bg-pink-300",
};

function PokemonAttackRoundResultView({
  result,
  myPlayerId,
}: {
  result: PokemonAttackRoundResultType;
  myPlayerId: string;
}) {
  const players = useRoomStore((s) => s.players);
  const myResult = result.playerResults.find((r) => r.playerId === myPlayerId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-4 pb-4 overflow-y-auto"
    >
      {/* Attack reveal */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center pt-4 mb-4"
      >
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl mb-2"
        >
          ⚔️
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-2xl font-display font-bold text-brand-300 mb-1"
        >
          {result.nameFr}
        </motion.h2>
        {result.nameFr !== result.nameEn && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-surface-400"
          >
            {result.nameEn}
          </motion.p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-3"
        >
          <span
            className={cn(
              "text-xs font-bold px-2.5 py-0.5 rounded-full text-white",
              ATTACK_TYPE_COLORS[result.attackType] || "bg-surface-600"
            )}
          >
            {result.attackType}
          </span>
          <span className="text-xs text-surface-500">{result.category}</span>
          {result.power && (
            <span className="text-xs text-surface-500">
              Puissance {result.power}
            </span>
          )}
          <span className="text-xs text-surface-500">PP {result.pp}</span>
        </motion.div>

        {myResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-3"
          >
            {myResult.found ? (
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-accent-400" />
                <span className="text-xl font-display font-bold text-surface-100">
                  +{myResult.points} pts
                </span>
              </div>
            ) : (
              <span className="text-surface-500">Pas trouvé</span>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Player results */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="space-y-1.5"
      >
        {result.playerResults.map((pr, i) => {
          const player = players.find((p) => p.id === pr.playerId);
          return (
            <motion.div
              key={pr.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 + i * 0.1 }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border",
                pr.found
                  ? "bg-lime-500/10 border-lime-500/20"
                  : "bg-surface-900/50 border-surface-800"
              )}
            >
              <Avatar emoji={player?.avatar || "❓"} size="sm" />
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "text-sm font-medium truncate block",
                  pr.playerId === myPlayerId ? "text-yellow-400" : "text-surface-200"
                )}>
                  {player?.name || "?"}
                </span>
                <span className="text-[10px] text-surface-500">
                  {pr.found
                    ? `${pr.hintsUsed} indice${pr.hintsUsed !== 1 ? "s" : ""}`
                    : "Pas trouvé"}
                </span>
              </div>
              <span className={cn(
                "text-sm font-display font-bold",
                pr.found ? "text-lime-400" : "text-surface-600"
              )}>
                +{pr.points}
              </span>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ==========================================
// DIALED ROUND RESULT (Color Memory)
// ==========================================

function DialedRoundResult({
  roundResult,
  players,
  myPlayerId,
  myResult,
}: {
  roundResult: NonNullable<ReturnType<typeof useGameStore.getState>["roundResult"]>;
  players: ReturnType<typeof useRoomStore.getState>["players"];
  myPlayerId: string;
  myResult?: { playerId: string; points: number; total: number };
}) {
  const q = roundResult.question as DialedQuestion;
  const targetColor = `hsl(${q.targetH}, ${q.targetS}%, ${q.targetL}%)`;
  const myNote = myResult ? myResult.points : 0;
  const myAnswer = roundResult.answers.find((a) => a.playerId === myPlayerId);
  let myGuessColor: string | null = null;
  if (myAnswer) {
    try {
      const parsed = JSON.parse(myAnswer.answer);
      myGuessColor = `hsl(${parsed.h}, ${parsed.s}%, ${parsed.l}%)`;
    } catch { /* ignore */ }
  }

  const sortedScores = useMemo(
    () => [...roundResult.scores].sort((a, b) => b.points - a.points),
    [roundResult.scores]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full px-5 pb-4"
    >
      {/* Result header with note /100 */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="text-center mb-6 pt-8"
      >
        <motion.div
          className="text-5xl font-display font-bold text-surface-100 mb-1"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {myNote}<span className="text-2xl text-surface-400">/100</span>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={cn(
            "text-lg font-display font-semibold",
            myNote >= 80 ? "text-success-400" : myNote >= 50 ? "text-accent-400" : "text-danger-400"
          )}
        >
          {myNote >= 90 ? "Incroyable !" : myNote >= 70 ? "Bien vu !" : myNote >= 40 ? "Pas mal !" : "Difficile !"}
        </motion.p>
      </motion.div>

      {/* Color comparison: target vs guess */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="mb-6">
          <div className="flex items-center justify-center gap-4">
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-xl border-2 border-surface-600 mx-auto mb-2"
                style={{ backgroundColor: targetColor }}
              />
              <p className="text-xs text-surface-400">Cible</p>
            </div>
            {myGuessColor && (
              <>
                <span className="text-surface-600 text-2xl">&rarr;</span>
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-xl border-2 border-surface-600 mx-auto mb-2"
                    style={{ backgroundColor: myGuessColor }}
                  />
                  <p className="text-xs text-surface-400">Toi</p>
                </div>
              </>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Player rankings with /100 notes */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="flex-1 overflow-y-auto"
      >
        <p className="text-xs text-surface-500 uppercase tracking-wide mb-3 font-semibold">
          Classement du round
        </p>
        <div className="space-y-2">
          {sortedScores.map((score, index) => {
            const player = players.find((p) => p.id === score.playerId);
            if (!player) return null;
            const isMe = score.playerId === myPlayerId;
            const answer = roundResult.answers.find((a) => a.playerId === score.playerId);
            let playerGuessColor: string | null = null;
            if (answer) {
              try {
                const parsed = JSON.parse(answer.answer);
                playerGuessColor = `hsl(${parsed.h}, ${parsed.s}%, ${parsed.l}%)`;
              } catch { /* ignore */ }
            }

            return (
              <motion.div
                key={score.playerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl",
                  isMe ? "bg-brand-500/10 border border-brand-500/20" : "bg-surface-900 border border-surface-800"
                )}
              >
                <span className="text-sm font-bold text-surface-400 w-5 text-center">
                  {index + 1}
                </span>
                <Avatar emoji={player.avatar} size="sm" />
                {playerGuessColor && (
                  <div
                    className="w-8 h-8 rounded-lg border border-surface-600 shrink-0"
                    style={{ backgroundColor: playerGuessColor }}
                  />
                )}
                <span className={cn(
                  "flex-1 text-sm font-medium truncate",
                  isMe ? "text-brand-300" : "text-surface-200"
                )}>
                  {player.name}
                </span>
                <span className={cn(
                  "font-display font-bold text-sm",
                  score.points >= 80 ? "text-success-400" : score.points >= 50 ? "text-accent-400" : "text-surface-300"
                )}>
                  {score.points}/100
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
