import { NextResponse } from "next/server";
import { getServerSession } from "@/auth";
import { sql } from "@vercel/postgres";
import { initDB } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const faqId = parseInt(id);
  if (isNaN(faqId)) {
    return NextResponse.json({ error: "Invalid FAQ ID" }, { status: 400 });
  }

  try {
    await initDB();
    const body = await request.json();
    const { status } = body;

    if (!['learning', 'mastered'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateFields: string[] = [`learning_status = $3`, `updated_at = NOW()`];
    if (status === 'learning') {
      updateFields.push(`last_viewed_at = NOW()`);
    }

    await sql.query(
      `UPDATE user_favorites
       SET ${updateFields.join(', ')}
       WHERE user_id = $1 AND faq_id = $2`,
      [session.user.id, faqId, status]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update status:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
