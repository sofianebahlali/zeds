"use client";

import { AnimatePresence } from "framer-motion";
import { useCurrentScreen, useConnectionStatus } from "@/stores";
import { useSocket } from "@/hooks";
import {
  HomeScreen,
  CreateRoomScreen,
  JoinRoomScreen,
  LobbyScreen,
  GameScreen,
  ScoreboardScreen,
  ErrorScreen,
  ReconnectingScreen,
} from "@/features";
import { NotificationContainer, LoadingOverlay } from "@/components/layout";

export default function Home() {
  const currentScreen = useCurrentScreen();
  const { isReconnecting } = useConnectionStatus();

  // Initialize socket connection handlers
  useSocket();

  // Handle reconnection screen priority
  if (isReconnecting && currentScreen !== "home") {
    return (
      <>
        <NotificationContainer />
        <LoadingOverlay />
        <ReconnectingScreen />
      </>
    );
  }

  // Errors are shown as notifications — no longer hijack the screen.
  // ErrorScreen is accessible via currentScreen === "error" in the
  // AnimatePresence below, so truly fatal errors can still use it.

  return (
    <>
      <NotificationContainer />
      <LoadingOverlay />

      <AnimatePresence mode="wait">
        {currentScreen === "home" && <HomeScreen key="home" />}
        {currentScreen === "create" && <CreateRoomScreen key="create" />}
        {currentScreen === "join" && <JoinRoomScreen key="join" />}
        {currentScreen === "lobby" && <LobbyScreen key="lobby" />}
        {currentScreen === "game" && <GameScreen key="game" />}
        {currentScreen === "scoreboard" && <ScoreboardScreen key="scoreboard" />}
        {currentScreen === "error" && <ErrorScreen key="error" />}
        {currentScreen === "reconnecting" && <ReconnectingScreen key="reconnecting" />}
      </AnimatePresence>
    </>
  );
}
