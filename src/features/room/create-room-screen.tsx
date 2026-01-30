"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button, Input, Card, AvatarSelector, Avatar } from "@/components/ui";
import { ScreenContainer, PageHeader } from "@/components/layout";
import { useUIStore, usePlayerStore } from "@/stores";
import { useSocket } from "@/hooks";
import { AVATARS } from "@/types";

export function CreateRoomScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const savedName = usePlayerStore((s) => s.playerName);
  const savedAvatar = usePlayerStore((s) => s.avatar);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setPlayerAvatar = usePlayerStore((s) => s.setAvatar);

  const [name, setName] = useState(savedName);
  const [avatar, setAvatar] = useState(savedAvatar);
  const { createRoom } = useSocket();

  const handleCreate = () => {
    if (!name.trim()) return;

    setPlayerName(name);
    setPlayerAvatar(avatar);
    createRoom(name.trim(), avatar);
  };

  const isValid = name.trim().length >= 2;

  return (
    <ScreenContainer>
      <div className="w-full max-w-md mx-auto">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => setScreen("home")}
          className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </motion.button>

        {/* Header */}
        <PageHeader
          title="Créer une partie"
          subtitle="Configure ton profil et lance la partie"
        />

        {/* Profile setup */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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

            {/* Create button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleCreate}
              disabled={!isValid}
              leftIcon={<Sparkles className="w-5 h-5" />}
            >
              Créer la room
            </Button>
          </Card>
        </motion.div>

        {/* Tips */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center text-sm text-surface-500 mt-6"
        >
          Tu recevras un code à partager avec tes amis
        </motion.p>
      </div>
    </ScreenContainer>
  );
}
