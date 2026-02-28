import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { initDB, getUserFavorites } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDB();
    const faqIds = await getUserFavorites(session.user.id);
    return NextResponse.json({ favorites: faqIds });
  } catch (err) {
    console.error("Get favorites error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
