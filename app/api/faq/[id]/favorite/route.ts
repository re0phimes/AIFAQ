import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { initDB, toggleFavorite } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isInteger(faqId) || faqId <= 0) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    await initDB();
    const isFavorited = await toggleFavorite(session.user.id, faqId);
    return NextResponse.json({ favorited: isFavorited });
  } catch (err) {
    console.error("Favorite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
