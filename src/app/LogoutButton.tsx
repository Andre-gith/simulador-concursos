"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm text-neutral-400">
      Sair
    </button>
  );
}
