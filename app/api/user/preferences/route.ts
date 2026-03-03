import { NextResponse } from "next/server";
import { getServerSession } from "@/auth";
import {
  getUserPreferences,
  upsertUserPreferences,
  type DBUserPreferencesPatch,
} from "@/lib/db";
import taxonomy from "@/data/tag-taxonomy.json";

const VALID_LANGUAGES = new Set(["zh", "en"]);
const VALID_PAGE_SIZES = new Set([10, 20, 50, 100]);
const VALID_CATEGORIES = new Set(taxonomy.categories.map((category) => category.name));

function normalizeResponse(
  prefs: Awaited<ReturnType<typeof getUserPreferences>>
): Record<string, unknown> {
  return {
    language: prefs?.language ?? null,
    page_size: prefs?.page_size ?? null,
    default_detailed: prefs?.default_detailed ?? null,
    focus_categories: prefs?.focus_categories ?? [],
    updated_at: prefs?.updated_at?.toISOString() ?? null,
  };
}

function sanitizeCategories(input: unknown): string[] | null {
  if (input === null) return [];
  if (!Array.isArray(input)) return null;
  const unique = Array.from(
    new Set(input.filter((item): item is string => typeof item === "string"))
  );
  return unique.filter((item) => VALID_CATEGORIES.has(item));
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await getUserPreferences(session.user.id);
  return NextResponse.json(normalizeResponse(preferences));
}

export async function PATCH(request: Request): Promise<NextResponse> {
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

  const patch: DBUserPreferencesPatch = {};

  if ("language" in body) {
    const language = body.language;
    if (language !== null && (typeof language !== "string" || !VALID_LANGUAGES.has(language))) {
      return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    }
    patch.language = language as "zh" | "en" | null;
  }

  if ("page_size" in body) {
    const pageSize = body.page_size;
    if (pageSize !== null && (typeof pageSize !== "number" || !VALID_PAGE_SIZES.has(pageSize))) {
      return NextResponse.json({ error: "Invalid page_size" }, { status: 400 });
    }
    patch.page_size = pageSize as number | null;
  }

  if ("default_detailed" in body) {
    const defaultDetailed = body.default_detailed;
    if (defaultDetailed !== null && typeof defaultDetailed !== "boolean") {
      return NextResponse.json({ error: "Invalid default_detailed" }, { status: 400 });
    }
    patch.default_detailed = defaultDetailed as boolean | null;
  }

  if ("focus_categories" in body) {
    const sanitized = sanitizeCategories(body.focus_categories);
    if (sanitized === null) {
      return NextResponse.json({ error: "Invalid focus_categories" }, { status: 400 });
    }
    patch.focus_categories = sanitized;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid preference fields provided" }, { status: 400 });
  }

  const updated = await upsertUserPreferences(session.user.id, patch);
  return NextResponse.json(normalizeResponse(updated));
}
