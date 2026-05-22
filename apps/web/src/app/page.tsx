"use client";

import { SessionProvider } from "@/providers/session";
import { ChatPanel } from "@/components/ChatPanel";
import { ClaudeStatus } from "@/components/ClaudeStatus";
import { PreviewPanel } from "@/components/PreviewPanel";
import { StatusPanel } from "@/components/StatusPanel";

const PREVIEW_URL = process.env.NEXT_PUBLIC_PREVIEW_URL ?? "http://localhost:4000";

export default function Home() {
  return (
    <SessionProvider previewUrl={PREVIEW_URL}>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            <span className="app-logo">🔧 PickFix</span>
            <span className="app-tagline">Point, pick, fix</span>
          </div>
          <div className="app-header-right">
            <ClaudeStatus />
            <span className="app-env-badge">MVP</span>
          </div>
        </header>
        <main className="app-main">
          <div className="panel panel-left">
            <ChatPanel />
          </div>
          <div className="panel panel-center">
            <PreviewPanel />
          </div>
          <div className="panel panel-right">
            <StatusPanel />
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
