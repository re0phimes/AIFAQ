import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const adminIds = (process.env.ADMIN_GITHUB_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async jwt({ token, profile }) {
      if (profile?.id) {
        token.githubId = String(profile.id);
        token.role = adminIds.includes(String(profile.id)) ? "admin" : "user";
        // Upsert user and load tier from DB
        const { upsertUser } = await import("@/lib/db");
        token.tier = await upsertUser(String(profile.id), String(profile.login ?? "")) as "free" | "premium";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.githubId as string;
        session.user.role = token.role as "admin" | "user";
        session.user.tier = (token.tier as "free" | "premium") ?? "free";
      }
      return session;
    },
  },
});
