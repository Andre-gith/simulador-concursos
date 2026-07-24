import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "USER" | "ADMIN";
  }
  interface Session {
    user: {
      id: string;
      role: "USER" | "ADMIN";
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: "USER" | "ADMIN";
  }
}
