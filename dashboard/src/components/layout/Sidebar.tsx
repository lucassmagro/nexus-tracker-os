import { getUserWorkspaces, getActiveWorkspaceId } from "@/lib/workspace-session";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import SidebarNav from "./SidebarNav";

export default async function Sidebar() {
  const workspaces = await getUserWorkspaces();
  const activeId = await getActiveWorkspaceId();

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col border-r"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--surface)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div className="px-6 py-6 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Nexus OS
        </h2>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <SidebarNav />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            US
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
              Usuário Nexus
            </p>
            <p className="text-xs truncate" style={{ color: "var(--foreground-muted)" }}>
              Plano Pro
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
