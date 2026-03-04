import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessFaqLevel } from "@/lib/faq-level-access";
import { getFaqItemById, initDB, toggleFavorite } from "@/lib/db";

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
    const item = await getFaqItemById(faqId);
    if (!item) {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }
    const viewer = {
      role: session.user.role,
      tier: session.user.tier,
    } as const;
    if (!canAccessFaqLevel(viewer, item.level ?? 1)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isFavorited = await toggleFavorite(session.user.id, faqId);
    return NextResponse.json({ favorited: isFavorited });
  } catch (err) {
    console.error("Favorite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
