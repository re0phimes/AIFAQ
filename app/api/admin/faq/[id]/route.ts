import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import { getFaqItemById, updateFaqLevel, updateFaqStatus, getPublishedFaqItems } from "@/lib/db";
import { analyzeFAQ } from "@/lib/ai";
import { extractCandidateImages } from "@/lib/image-extractor";
import { waitUntil } from "@vercel/functions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authed = await verifyAdmin();
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
  if (body.action === "set_level") {
    if (![1, 2].includes(body.level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    await updateFaqLevel(numId, body.level as 1 | 2);
    const updated = await getFaqItemById(numId);
    return NextResponse.json(updated);
  }

  // Review workflow actions
  if (body.action === "publish") {
    await updateFaqStatus(numId, "published", {
      reviewed_at: new Date(),
      reviewed_by: "admin",
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reject") {
    await updateFaqStatus(numId, "rejected", {
      reviewed_at: new Date(),
      reviewed_by: "admin",
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "unpublish") {
    await updateFaqStatus(numId, "review", {
      reviewed_at: new Date(),
      reviewed_by: "admin",
    });
    return NextResponse.json({ ok: true });
  }

  // Manual edit
  if (
    body.question ||
    body.answer ||
    body.tags ||
    body.references ||
    "categories" in body ||
    "primary_category" in body ||
    "secondary_category" in body ||
    "topics" in body ||
    "tool_stack" in body
  ) {
    await updateFaqStatus(numId, body.status ?? item.status, {
      answer: body.answer ?? item.answer ?? undefined,
      tags: body.tags ?? item.tags,
      categories: body.categories ?? item.categories,
      primary_category:
        "primary_category" in body ? body.primary_category : item.primary_category,
      secondary_category:
        "secondary_category" in body ? body.secondary_category : item.secondary_category,
      topics: "topics" in body ? body.topics : item.topics,
      tool_stack: "tool_stack" in body ? body.tool_stack : item.tool_stack,
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

    // Extract candidate images from existing references (available on retry)
    const item = await getFaqItemById(id);
    const candidateImages = item?.references?.length
      ? await extractCandidateImages(item.references.map(r => ({ type: r.type, url: r.url })))
      : [];

    const result = await analyzeFAQ(question, answerRaw, existingTags, candidateImages);
    await updateFaqStatus(id, "review", {
      answer: result.answer,
      answer_brief: result.answer_brief,
      answer_en: result.answer_en,
      answer_brief_en: result.answer_brief_en,
      question_en: result.question_en,
      tags: result.tags,
      categories: item?.categories ?? [],
      primary_category: result.primary_category,
      secondary_category: result.secondary_category,
      topics: result.topics,
      tool_stack: result.tool_stack,
      references: result.references,
      images: result.images,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateFaqStatus(id, "failed", { error_message: message });
  }
}
