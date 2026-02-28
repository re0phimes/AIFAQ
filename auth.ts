import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

const adminIds = (process.env.ADMIN_GITHUB_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.id) {
        token.githubId = String(profile.id);
        token.role = adminIds.includes(String(profile.id)) ? "admin" : "user";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.githubId as string;
        session.user.role = token.role as "admin" | "user";
      }
      return session;
    },
  },
});
