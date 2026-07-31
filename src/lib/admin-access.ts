export function adminAccessDecision(session: {
  user?: { id?: string; role?: "USER" | "ADMIN" };
} | null | undefined) {
  if (!session?.user?.id) return { allowed: false as const, redirectTo: "/login" };
  if (session.user.role !== "ADMIN") return { allowed: false as const, redirectTo: "/" };
  return { allowed: true as const };
}
