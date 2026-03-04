/**
 * fix-version-offset.ts
 *
 * Backfill script for historical FAQ version offset caused by first-review bump.
 *
 * Modes:
 * - --dry-run (default): analyze and report only
 * - --apply: execute transactional fixes
 */

import { sql } from "@vercel/postgres";
import { initDB } from "../../lib/db";

type Mode = "dry-run" | "apply";

interface FaqRow {
  id: number;
  current_version: number;
  last_updated_at: string | null;
}

interface VersionAggRow {
  faq_id: number;
  count: number;
  min_version: number | null;
  max_version: number | null;
}

interface VersionFixItem {
  faq_id: number;
  strategy: "decrement_current_only" | "shift_versions_and_decrement_current";
  before_current_version: number;
  after_current_version: number;
  version_count: number;
  min_version: number | null;
  max_version: number | null;
}

interface ManualReviewItem {
  faq_id: number;
  reason: string;
  current_version: number;
  version_count: number;
  min_version: number | null;
  max_version: number | null;
}

interface SkippedItem {
  faq_id: number;
  reason: string;
}

interface Report {
  mode: Mode;
  fixed: VersionFixItem[];
  manual_review: ManualReviewItem[];
  skipped: SkippedItem[];
}

function parseMode(argv: string[]): Mode {
  if (argv.includes("--apply")) return "apply";
  return "dry-run";
}

function printUsage(): void {
  console.log(`Usage: faq:fix-version-offset [--dry-run] [--apply]

Options:
  --dry-run   Analyze only, print report (default)
  --apply     Execute fixes in DB
`);
}

function isContinuousRange(minVersion: number, maxVersion: number, count: number): boolean {
  return maxVersion - minVersion + 1 === count;
}

async function loadFaqRows(): Promise<Map<number, FaqRow>> {
  const result = await sql`
    SELECT id, current_version, last_updated_at
    FROM faq_items
    WHERE current_version >= 2
    ORDER BY id ASC
  `;

  const map = new Map<number, FaqRow>();
  for (const row of result.rows) {
    map.set(row.id as number, {
      id: row.id as number,
      current_version: row.current_version as number,
      last_updated_at: (row.last_updated_at as string | null) ?? null,
    });
  }
  return map;
}

async function loadVersionAgg(): Promise<Map<number, VersionAggRow>> {
  const result = await sql`
    SELECT faq_id, COUNT(*)::int AS count, MIN(version)::int AS min_version, MAX(version)::int AS max_version
    FROM faq_versions
    GROUP BY faq_id
  `;

  const map = new Map<number, VersionAggRow>();
  for (const row of result.rows) {
    map.set(row.faq_id as number, {
      faq_id: row.faq_id as number,
      count: Number(row.count),
      min_version: row.min_version === null ? null : Number(row.min_version),
      max_version: row.max_version === null ? null : Number(row.max_version),
    });
  }
  return map;
}

function classify(
  faq: FaqRow,
  agg: VersionAggRow | undefined
): { fix?: VersionFixItem; manual?: ManualReviewItem; skip?: SkippedItem } {
  const versionCount = agg?.count ?? 0;
  const minVersion = agg?.min_version ?? null;
  const maxVersion = agg?.max_version ?? null;

  if (faq.current_version < 2) {
    return {
      skip: { faq_id: faq.id, reason: "current_version_lt_2" },
    };
  }

  // Classic first-review mis-bump: v2 with no history rows.
  if (faq.current_version === 2 && versionCount === 0) {
    return {
      fix: {
        faq_id: faq.id,
        strategy: "decrement_current_only",
        before_current_version: faq.current_version,
        after_current_version: faq.current_version - 1,
        version_count: versionCount,
        min_version: minVersion,
        max_version: maxVersion,
      },
    };
  }

  if (versionCount === 0) {
    return {
      manual: {
        faq_id: faq.id,
        reason: "no_versions_but_current_gt_2",
        current_version: faq.current_version,
        version_count: versionCount,
        min_version: minVersion,
        max_version: maxVersion,
      },
    };
  }

  if (minVersion === null || maxVersion === null) {
    return {
      manual: {
        faq_id: faq.id,
        reason: "invalid_version_aggregate",
        current_version: faq.current_version,
        version_count: versionCount,
        min_version: minVersion,
        max_version: maxVersion,
      },
    };
  }

  // Expected bad chain: versions start from 2, contiguous, max = current - 1.
  const looksLikeOffsetByOne =
    minVersion === 2 &&
    maxVersion === faq.current_version - 1 &&
    isContinuousRange(minVersion, maxVersion, versionCount);

  if (looksLikeOffsetByOne) {
    return {
      fix: {
        faq_id: faq.id,
        strategy: "shift_versions_and_decrement_current",
        before_current_version: faq.current_version,
        after_current_version: faq.current_version - 1,
        version_count: versionCount,
        min_version: minVersion,
        max_version: maxVersion,
      },
    };
  }

  return {
    manual: {
      faq_id: faq.id,
      reason: "non_offset_pattern",
      current_version: faq.current_version,
      version_count: versionCount,
      min_version: minVersion,
      max_version: maxVersion,
    },
  };
}

async function applyFix(item: VersionFixItem): Promise<void> {
  await sql`BEGIN`;
  try {
    if (item.strategy === "decrement_current_only") {
      await sql`
        UPDATE faq_items
        SET current_version = current_version - 1,
            last_updated_at = NULL,
            updated_at = NOW()
        WHERE id = ${item.faq_id}
      `;
    } else {
      await sql`
        UPDATE faq_versions
        SET version = version + 1000
        WHERE faq_id = ${item.faq_id} AND version >= 2
      `;
      await sql`
        UPDATE faq_versions
        SET version = version - 1001
        WHERE faq_id = ${item.faq_id} AND version >= 1002
      `;
      await sql`
        UPDATE faq_items
        SET current_version = current_version - 1,
            updated_at = NOW()
        WHERE id = ${item.faq_id}
      `;
    }

    await sql`COMMIT`;
  } catch (err) {
    await sql`ROLLBACK`;
    throw err;
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }

  const mode = parseMode(argv);

  await initDB();
  const faqMap = await loadFaqRows();
  const versionAggMap = await loadVersionAgg();

  const report: Report = {
    mode,
    fixed: [],
    manual_review: [],
    skipped: [],
  };

  for (const faq of faqMap.values()) {
    const outcome = classify(faq, versionAggMap.get(faq.id));
    if (outcome.fix) report.fixed.push(outcome.fix);
    if (outcome.manual) report.manual_review.push(outcome.manual);
    if (outcome.skip) report.skipped.push(outcome.skip);
  }

  if (mode === "apply") {
    for (const item of report.fixed) {
      await applyFix(item);
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error("fix-version-offset failed:", err);
  process.exit(1);
});
