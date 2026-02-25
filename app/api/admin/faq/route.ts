import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth";
import { createFaqItem, getAllFaqItems, getReadyFaqItems, updateFaqStatus } from "@/lib/db";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function GET(): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getAllFaqItems();
  return NextResponse.json(items);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await getAuthStatus();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { question, answer } = await request.json();
  if (!question?.trim() || !answer?.trim()) {
    return NextResponse.json({ error: "问题和答案不能为空" }, { status: 400 });
  }

  const item = await createFaqItem(question.trim(), answer.trim());

  // Async AI analysis via waitUntil
  waitUntil(processAIAnalysis(item.id, question.trim(), answer.trim()));

  return NextResponse.json(item, { status: 201 });
}

async function processAIAnalysis(id: number, question: string, answerRaw: string): Promise<void> {
  try {
    await updateFaqStatus(id, "processing");

    // Get existing tags for consistency
    const readyItems = await getReadyFaqItems();
    const existingTags = [...new Set(readyItems.flatMap((item) => item.tags))];

    const result = await analyzeFAQ(question, answerRaw, existingTags);

    await updateFaqStatus(id, "ready", {
      answer: result.answer,
      tags: result.tags,
      references: result.references,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateFaqStatus(id, "failed", { error_message: message });
  }
}
