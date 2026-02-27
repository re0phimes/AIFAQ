import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";
import { getFaqItemById, updateFaqStatus, getPublishedFaqItems } from "@/lib/db";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  const item = await getFaqItemById(numId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Retry: re-trigger AI analysis
  if (body.action === "retry") {
    await updateFaqStatus(numId, "pending");
    waitUntil(retryAnalysis(numId, item.question, item.answer_raw));
    return NextResponse.json({ ok: true });
  }

  // Review workflow actions
  if (body.action === "publish") {
    await updateFaqStatus(numId, "published");
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reject") {
    await updateFaqStatus(numId, "rejected");
    return NextResponse.json({ ok: true });
  }
  if (body.action === "unpublish") {
    await updateFaqStatus(numId, "review");
    return NextResponse.json({ ok: true });
  }

  // Manual edit
  if (body.question || body.answer || body.tags || body.references) {
    await updateFaqStatus(numId, body.status ?? item.status, {
      answer: body.answer ?? item.answer ?? undefined,
      tags: body.tags ?? item.tags,
      references: body.references ?? item.references,
    });
    const updated = await getFaqItemById(numId);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "No valid action" }, { status: 400 });
}

async function retryAnalysis(id: number, question: string, answerRaw: string): Promise<void> {
  try {
    await updateFaqStatus(id, "processing");
    const readyItems = await getPublishedFaqItems();
    const existingTags = [...new Set(readyItems.flatMap((i) => i.tags))];
    const result = await analyzeFAQ(question, answerRaw, existingTags);
    await updateFaqStatus(id, "review", {
      answer: result.answer,
      tags: result.tags,
      categories: result.categories,
      references: result.references,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateFaqStatus(id, "failed", { error_message: message });
  }
}
