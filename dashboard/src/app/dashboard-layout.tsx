import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import PageTransition from "@/components/layout/PageTransition";
import { getUserWorkspaces, getActiveWorkspaceId } from "@/lib/workspace-session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspaces = await getUserWorkspaces();
  const activeId = await getActiveWorkspaceId();

  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar-width)" }}>
        <TopBar workspaces={workspaces} activeId={activeId} />
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
