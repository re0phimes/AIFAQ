import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "user";
      tier: "free" | "premium";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string;
    role?: "admin" | "user";
    tier?: "free" | "premium";
  }
}
