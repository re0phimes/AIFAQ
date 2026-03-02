import * as fs from "fs";
import { parseFileToMarkdown } from "../../lib/ocr";

export function normalizeQuestions(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const q = raw.trim();
    if (!q) continue;
    if (seen.has(q)) continue;
    seen.add(q);
    out.push(q);
  }
  return out;
}

export function readQuestionsFile(filePath: string): string[] {
  const txt = fs.readFileSync(filePath, "utf-8");
  if (filePath.endsWith(".json")) {
    const arr = JSON.parse(txt) as unknown[];
    return normalizeQuestions(arr.filter((x): x is string => typeof x === "string"));
  }
  return normalizeQuestions(txt.split(/\r?\n/));
}

function guessImageMime(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

export async function extractQuestionsFromImages(imagePaths: string[]): Promise<string[]> {
  const qs: string[] = [];
  for (const p of imagePaths) {
    const buf = fs.readFileSync(p);
    const md = await parseFileToMarkdown(buf, p, guessImageMime(p));

    for (const line of md.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      if (t.endsWith("？") || t.endsWith("?")) {
        qs.push(t);
      }
    }
  }
  return normalizeQuestions(qs);
}
