
import "./globals.css";
import type { ReactNode } from "react";
import AuthGate from "@/lib/AuthGate";
import LocalAiRelayAgent from "@/lib/LocalAiRelayAgent";
import NeuralField from "./dms/NeuralField";
import DepthField from "./dms/DepthField";
import WorkspaceShell from "./WorkspaceShell";
import { StudioProvider } from "@/lib/studioContext";
import { MemoryPipeProvider } from "@/lib/memoryPipe";
import { DirectorProvider } from "@/lib/directorMode";
import DirectorField from "./hud/DirectorField";
import DirectorConsole from "./hud/DirectorConsole";
import KineticHost from "./kinetics/KineticHost";

export const metadata = {
  title: "OmniAI — DarkMisfitStudios",
  description:
    "OmniAI — the AI research and content creation studio for DarkMisfitStudios.",
  openGraph: {
    title: "OmniAI — DarkMisfitStudios",
    description:
      "OmniAI — the AI research and content creation studio for DarkMisfitStudios.",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-[#0b0a14] text-[#e8e6f2]">
        <NeuralField />
        <div className="dms-screen" aria-hidden="true" />
        <AuthGate>
          <LocalAiRelayAgent />
          <DepthField />
          <StudioProvider>
            <MemoryPipeProvider>
              <DirectorProvider>
                <DirectorField />
                <WorkspaceShell>{children}</WorkspaceShell>
                <DirectorConsole />
                <KineticHost />
              </DirectorProvider>
            </MemoryPipeProvider>
          </StudioProvider>
        </AuthGate>
      </body>
    </html>
  );
}
