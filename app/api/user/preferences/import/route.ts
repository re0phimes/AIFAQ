import { NextResponse } from "next/server";
import { getServerSession } from "@/auth";
import { importUserPreferences } from "@/lib/db";
import { expandPrimaryCategoryKeys } from "@/lib/taxonomy";
import type { PrimaryCategoryKey } from "@/src/types/faq";

const VALID_LANGUAGES = new Set(["zh", "en"]);
const VALID_PAGE_SIZES = new Set([10, 20, 50, 100]);

function sanitizeCategories(input: unknown): PrimaryCategoryKey[] | null {
  if (input === null) return [];
  if (!Array.isArray(input)) return null;
  const normalized = input
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => expandPrimaryCategoryKeys(item));
  return Array.from(new Set(normalized));
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!("snapshot" in body) || typeof body.snapshot !== "object" || body.snapshot === null) {
    return NextResponse.json({ error: "snapshot is required" }, { status: 400 });
  }
  const snapshot = body.snapshot as Record<string, unknown>;

  const language = snapshot.language;
  if (language !== undefined && language !== null) {
    if (typeof language !== "string" || !VALID_LANGUAGES.has(language)) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
  }

  const pageSize = snapshot.page_size;
  if (pageSize !== undefined && pageSize !== null) {
    if (typeof pageSize !== "number" || !VALID_PAGE_SIZES.has(pageSize)) {
      return NextResponse.json({ error: "Invalid page_size" }, { status: 400 });
    }
  }

  const defaultDetailed = snapshot.default_detailed;
  if (defaultDetailed !== undefined && defaultDetailed !== null) {
    if (typeof defaultDetailed !== "boolean") {
      return NextResponse.json({ error: "Invalid default_detailed" }, { status: 400 });
    }
  }

  let focusCategories: PrimaryCategoryKey[] | undefined;
  if ("focus_categories" in snapshot) {
    const sanitized = sanitizeCategories(snapshot.focus_categories);
    if (sanitized === null) {
      return NextResponse.json({ error: "Invalid focus_categories" }, { status: 400 });
    }
    focusCategories = sanitized;
  }

  const updatedAt = snapshot.updated_at;
  if (updatedAt !== undefined && updatedAt !== null && typeof updatedAt !== "string") {
    return NextResponse.json({ error: "Invalid updated_at" }, { status: 400 });
  }

  const merged = await importUserPreferences(session.user.id, {
    language: (language as "zh" | "en" | null | undefined) ?? undefined,
    page_size: (pageSize as number | null | undefined) ?? undefined,
    default_detailed: (defaultDetailed as boolean | null | undefined) ?? undefined,
    focus_categories: focusCategories,
    updated_at: (updatedAt as string | null | undefined) ?? undefined,
  });

  const normalizedFocusCategories = Array.from(
    new Set(
      (merged.focus_categories ?? [])
        .flatMap((category) => expandPrimaryCategoryKeys(category))
    )
  );

  return NextResponse.json({
    language: merged.language,
    page_size: merged.page_size,
    default_detailed: merged.default_detailed,
    focus_categories: normalizedFocusCategories,
    updated_at: merged.updated_at.toISOString(),
  });
}
