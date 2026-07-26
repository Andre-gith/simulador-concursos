import { HomeHeader } from "@/components/home/HomeHeader";

export function AppShell({
  children,
  isAuthenticated,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  isAdmin?: boolean;
}) {
  return (
    <div className="min-h-screen bg-[#f6f4ed] text-slate-950">
      <HomeHeader isAuthenticated={isAuthenticated} isAdmin={isAdmin} />
      {children}
    </div>
  );
}
