import { redirect } from "next/navigation";
import { getServerSession } from "@/auth";
import { cookies } from "next/headers";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/');
  }

  // Get language preference from cookie or default to 'zh'
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('aifaq-lang');
  const lang = (langCookie?.value === 'en' ? 'en' : 'zh') as "zh" | "en";

  // Fetch favorites on server
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}/api/user/favorites`, {
    headers: {
      cookie: `next-auth.session-token=${session.user.id}` // Simplified for demo
    },
    cache: 'no-store'
  });

  const data = await res.json();

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8">
      <ProfileClient
        favorites={data.favorites || []}
        stats={data.stats || { total: 0, unread: 0, learning: 0, mastered: 0, stale: 0 }}
        lang={lang}
      />
    </main>
  );
}
