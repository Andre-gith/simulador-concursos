import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { adminAccessDecision } from "./admin-access";

export { adminAccessDecision } from "./admin-access";

type AdminSession = Session & {
  user: Session["user"] & {
    id: string;
    role: "ADMIN";
  };
};

export async function requireAdmin() {
  const session = await auth();
  const decision = adminAccessDecision(session);
  if (!decision.allowed) redirect(decision.redirectTo);
  return session as unknown as AdminSession;
}
