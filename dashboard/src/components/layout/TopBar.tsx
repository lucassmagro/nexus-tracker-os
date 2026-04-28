"use client";

import { useState } from "react";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

interface Workspace {
  id: string;
  name: string;
}

export default function TopBar({
  workspaces,
  activeId
}: {
  workspaces: Workspace[];
  activeId: string | null;
}) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b"
      style={{
        background: "rgba(9, 9, 11, 0.8)",
        backdropFilter: "blur(12px)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* ── Breadcrumb / Title ──────────────────────────────────── */}
      <div>
        <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--foreground-muted)" }}>
          Dashboard
        </p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Visão Geral
        </h2>
      </div>

      {/* ── Right Actions ───────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-64">
          <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />
        </div>

        {/* Date range badge */}
        <span
          className="text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--surface)",
            color: "var(--foreground-dim)",
            border: "1px solid var(--border)",
          }}
        >
          Últimos 30 dias
        </span>

        {/* Notifications bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: "var(--foreground-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            {/* Notification dot */}
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: "var(--accent)" }}
            />
          </button>

          {showNotifications && (
            <div 
              className="absolute right-0 mt-2 w-80 rounded-xl shadow-2xl border overflow-hidden z-50"
              style={{ 
                background: "var(--surface)",
                borderColor: "var(--border-subtle)" 
              }}
            >
              <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "var(--border-subtle)" }}>
                <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>Notificações</h3>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>0 Novas</span>
              </div>
              <div className="p-6 text-center">
                <svg className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--foreground-muted)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>Tudo limpo por aqui!</p>
                <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>Você não tem novas notificações no momento.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
