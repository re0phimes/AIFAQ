import NextAuth from "next-auth";
import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GitHub from "next-auth/providers/github";

const adminIds = (process.env.ADMIN_GITHUB_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const authOptions = {
  providers: [GitHub],
  callbacks: {
    async jwt({ token, profile }: { token: JWT; profile?: Record<string, unknown> | null }) {
      const profileData = profile ?? undefined;
      const profileId =
        typeof profileData?.id === "number" || typeof profileData?.id === "string"
          ? String(profileData.id)
          : undefined;
      const profileLogin =
        typeof profileData?.login === "string" ? profileData.login : "";

      if (profileId) {
        token.githubId = profileId;
        token.role = adminIds.includes(profileId) ? "admin" : "user";
        // Upsert user and load tier from DB
        const { upsertUser } = await import("@/lib/db");
        const tier = await upsertUser(profileId, profileLogin);
        token.tier = tier === "premium" ? "premium" : "free";
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.githubId ?? "";
        session.user.role = token.role ?? "user";
        session.user.tier = token.tier ?? "free";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

// NextAuth v5 compatibility: export getServerSession as an alias to auth()
export const getServerSession = auth;
