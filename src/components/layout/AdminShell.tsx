import { AppShell } from "@/components/layout/AppShell";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell isAuthenticated isAdmin>
      <div className="admin-surface min-h-[calc(100vh-4rem)]">{children}</div>
    </AppShell>
  );
}
