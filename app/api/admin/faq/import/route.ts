import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/auth";
import {
  createImportRecord,
  updateImportStatus,
  createFaqItem,
  updateFaqStatus,
  getPublishedFaqItems,
} from "@/lib/db";
import { parseFileToMarkdown } from "@/lib/ocr";
import { generateQAPairs, judgeQAPairs } from "@/lib/import-pipeline";
import { analyzeFAQ } from "@/lib/ai";
import { waitUntil } from "@vercel/functions";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authed = await verifyAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 4MB)" }, { status: 400 });
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();
  const formatHint = formData.get("format") as string | null;
  const fileType = formatHint || ext || "txt";

  if (!["md", "txt", "pdf"].includes(fileType)) {
    return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
  }

  const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await createImportRecord(importId, filename, fileType);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  waitUntil(processImport(importId, buffer, filename, file.type || `text/${fileType}`));

  return NextResponse.json({
    importId,
    status: "processing",
    fileType,
    message: "文件已接收，正在处理...",
  }, { status: 202 });
}

async function processImport(
  importId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<void> {
  try {
    await updateImportStatus(importId, "parsing");
    const markdownText = await parseFileToMarkdown(buffer, filename, mimeType);

    if (!markdownText.trim()) {
      await updateImportStatus(importId, "failed", { error_msg: "文件内容为空" });
      return;
    }

    await updateImportStatus(importId, "generating");
    const existingTags = [...new Set(
      (await getPublishedFaqItems()).flatMap((item) => item.tags)
    )];
    const qaPairs = await generateQAPairs(markdownText, existingTags);

    if (qaPairs.length === 0) {
      await updateImportStatus(importId, "completed", { total_qa: 0, passed_qa: 0 });
      return;
    }

    await updateImportStatus(importId, "judging", { total_qa: qaPairs.length });

    const documentSummary = markdownText.slice(0, 2000);
    const judgeResult = await judgeQAPairs(qaPairs, documentSummary);

    const passedPairs = qaPairs.filter((_, i) =>
      judgeResult.results[i]?.verdict === "pass"
    );

    await updateImportStatus(importId, "enriching", {
      total_qa: qaPairs.length,
      passed_qa: passedPairs.length,
    });

    for (const qa of passedPairs) {
      try {
        const item = await createFaqItem(qa.question, qa.answer);
        await updateFaqStatus(item.id, "processing");

        const result = await analyzeFAQ(qa.question, qa.answer, existingTags);
        await updateFaqStatus(item.id, "review", {
          answer: result.answer,
          answer_brief: result.answer_brief,
          answer_en: result.answer_en,
          answer_brief_en: result.answer_brief_en,
          question_en: result.question_en,
          tags: result.tags,
          categories: result.categories,
          references: result.references,
          images: result.images,
        });
      } catch (err) {
        console.error(`Failed to process QA: ${qa.question}`, err);
      }
    }

    await updateImportStatus(importId, "completed", {
      total_qa: qaPairs.length,
      passed_qa: passedPairs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await updateImportStatus(importId, "failed", { error_msg: message });
  }
}
