"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button, Input, Card, AvatarSelector, Avatar } from "@/components/ui";
import { ScreenContainer, PageHeader } from "@/components/layout";
import { useUIStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { AVATARS } from "@/types";
import { cn } from "@/lib/utils";

export function JoinRoomScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const savedName = usePlayerStore((s) => s.playerName);
  const savedAvatar = usePlayerStore((s) => s.avatar);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setPlayerAvatar = usePlayerStore((s) => s.setAvatar);

  const [step, setStep] = useState<"code" | "profile">("code");
  const [code, setCode] = useState(["", "", "", ""]);
  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState(savedAvatar);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { joinRoom } = useSocket();

  // Auto-focus first input
  useEffect(() => {
    if (step === "code") {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleCodeChange = (index: number, value: string) => {
    // Only accept alphanumeric
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (char.length > 1) return;

    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);

    // Auto-advance to next input
    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);

    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);

    // Focus appropriate input
    const focusIndex = Math.min(pasted.length, 3);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleContinue = () => {
    if (code.every((c) => c)) {
      setStep("profile");
    }
  };

  const handleJoin = () => {
    if (!name.trim()) return;

    setPlayerName(name);
    setPlayerAvatar(avatar);
    joinRoom(code.join(""), name.trim(), avatar);
  };

  const isCodeValid = code.every((c) => c);
  const isNameValid = name.trim().length >= 2;

  return (
    <ScreenContainer>
      <div className="w-full max-w-md mx-auto">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => (step === "profile" ? setStep("code") : setScreen("home"))}
          className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </motion.button>

        {step === "code" ? (
          <>
            {/* Code Entry */}
            <PageHeader
              title="Rejoindre"
              subtitle="Entre le code de la room"
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card variant="glass" className="space-y-8">
                {/* Code inputs */}
                <div className="flex justify-center gap-3">
                  {code.map((char, index) => (
                    <motion.input
                      key={index}
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="text"
                      maxLength={1}
                      value={char}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className={cn(
                        "w-16 h-20 text-center text-3xl font-bold",
                        "rounded-2xl",
                        "bg-surface-800 border-2",
                        "text-white",
                        "focus:outline-none focus:ring-4",
                        "transition-all duration-200",
                        char
                          ? "border-brand-500 focus:ring-brand-500/20"
                          : "border-surface-700 focus:border-brand-500 focus:ring-brand-500/20"
                      )}
                    />
                  ))}
                </div>

                {/* Continue button */}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleContinue}
                  disabled={!isCodeValid}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  Continuer
                </Button>
              </Card>
            </motion.div>
          </>
        ) : (
          <>
            {/* Profile Setup */}
            <PageHeader
              title="Ton profil"
              subtitle={`Room: ${code.join("")}`}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card variant="glass" className="space-y-6">
                {/* Avatar preview */}
                <div className="flex justify-center">
                  <motion.div
                    key={avatar}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Avatar emoji={avatar} size="xl" />
                  </motion.div>
                </div>

                {/* Avatar selector */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-3">
                    Choisis ton avatar
                  </label>
                  <AvatarSelector
                    avatars={AVATARS}
                    selected={avatar}
                    onSelect={setAvatar}
                  />
                </div>

                {/* Name input */}
                <Input
                  label="Ton pseudo"
                  placeholder="Entre ton pseudo..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={20}
                  variant="glass"
                />

                {/* Join button */}
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onClick={handleJoin}
                  disabled={!isNameValid}
                >
                  Rejoindre la partie
                </Button>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </ScreenContainer>
  );
}
