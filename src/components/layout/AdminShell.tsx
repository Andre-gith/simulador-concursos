import { AppShell } from "@/components/layout/AppShell";
import { isLiteDeployment } from "@/lib/deployment-mode";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const lite = isLiteDeployment();
  return (
    <AppShell isAuthenticated isAdmin>
      <div className="admin-surface min-h-[calc(100vh-4rem)]">
        {lite && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"><strong>Modo Lite</strong> · Automações em segundo plano desabilitadas. Importações manuais continuam disponíveis.</p>}
        {children}
      </div>
    </AppShell>
  );
}
