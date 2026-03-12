import fs from "node:fs";
import path from "node:path";
import { getPrimaryCategoryOptions, isValidPrimaryCategoryKey } from "../lib/taxonomy";
import type { FAQItem } from "../src/types/faq";

const FAQ_PATH = path.resolve(__dirname, "../data/faq.json");

interface CoverageSummary {
  total: number;
  withPrimaryCategory: number;
  withSecondaryCategory: number;
  withLegacyCategories: number;
  invalidPrimaryCategory: number;
  invalidSecondaryCategory: number;
}

function readFaqItems(): FAQItem[] {
  return JSON.parse(fs.readFileSync(FAQ_PATH, "utf-8")) as FAQItem[];
}

function summarize(items: FAQItem[]): CoverageSummary {
  return items.reduce<CoverageSummary>(
    (summary, item) => {
      if (item.primaryCategory) {
        if (isValidPrimaryCategoryKey(item.primaryCategory)) {
          summary.withPrimaryCategory += 1;
        } else {
          summary.invalidPrimaryCategory += 1;
        }
      }

      if (item.secondaryCategory) {
        if (isValidPrimaryCategoryKey(item.secondaryCategory)) {
          summary.withSecondaryCategory += 1;
        } else {
          summary.invalidSecondaryCategory += 1;
        }
      }

      if (Array.isArray(item.categories) && item.categories.length > 0) {
        summary.withLegacyCategories += 1;
      }

      return summary;
    },
    {
      total: items.length,
      withPrimaryCategory: 0,
      withSecondaryCategory: 0,
      withLegacyCategories: 0,
      invalidPrimaryCategory: 0,
      invalidSecondaryCategory: 0,
    }
  );
}

function main(): void {
  const items = readFaqItems();
  const summary = summarize(items);
  const categoryKeys = getPrimaryCategoryOptions().map((category) => category.key);

  console.log("Legacy tag categorization script retired.");
  console.log("This command is now read-only and reports canonical taxonomy coverage.");
  console.log(`Canonical primary categories: ${categoryKeys.join(", ")}`);
  console.log("");
  console.log(`Total FAQs: ${summary.total}`);
  console.log(`With primary_category: ${summary.withPrimaryCategory}`);
  console.log(`With secondary_category: ${summary.withSecondaryCategory}`);
  console.log(`With legacy categories[] residue: ${summary.withLegacyCategories}`);
  console.log(`Invalid primary_category values: ${summary.invalidPrimaryCategory}`);
  console.log(`Invalid secondary_category values: ${summary.invalidSecondaryCategory}`);

  if (summary.withLegacyCategories > 0) {
    console.log("");
    console.log(
      "Legacy categories[] still exist in stored FAQ data. Use scripts/migrate-faq-taxonomy.ts for deterministic backfill/cleanup."
    );
  }
}

main();
