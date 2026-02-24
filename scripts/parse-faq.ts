import * as fs from "fs";
import * as path from "path";
import type { FAQItem, Reference } from "../src/types/faq";

const MD_PATH = path.resolve(__dirname, "../AI-FAQ.md");
const OUT_PATH = path.resolve(__dirname, "../data/faq.json");

function parseReferences(lines: string[]): Reference[] {
  const refs: Reference[] = [];
  for (const line of lines) {
    const trimmed = line.replace(/^-\s*/, "").trim();
    if (!trimmed) continue;

    const arxivMatch = trimmed.match(/arXiv:(\d+\.\d+)/);
    if (arxivMatch) {
      refs.push({
        type: "paper",
        title: trimmed,
        url: `https://arxiv.org/abs/${arxivMatch[1]}`,
      });
    } else if (trimmed.startsWith("来源文章:") || trimmed.startsWith("来源文章：")) {
      refs.push({
        type: "blog",
        title: trimmed.replace(/^来源文章[:：]\s*/, ""),
      });
    } else {
      refs.push({ type: "other", title: trimmed });
    }
  }
  return refs;
}

function parseFAQ(content: string): FAQItem[] {
  // Split by --- separator, skip everything before first FAQ entry
  const parts = content.split(/\n---\n/);

  const items: FAQItem[] = [];

  for (const section of parts) {
    // Match heading: ## N. Question text
    const headingMatch = section.match(/^## (\d+)\.\s+(.+)$/m);
    if (!headingMatch) continue;

    const id = parseInt(headingMatch[1], 10);
    const question = headingMatch[2].trim();

    // Date
    const dateMatch = section.match(/\*\*日期\*\*:\s*(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "";

    // Tags
    const tagsMatch = section.match(/\*\*标签\*\*:\s*(.+)$/m);
    const tags: string[] = [];
    if (tagsMatch) {
      const tagMatches = tagsMatch[1].match(/#(\S+)/g);
      if (tagMatches) {
        for (const t of tagMatches) {
          tags.push(t.slice(1));
        }
      }
    }

    // References: lines between **参考**: and **标签**
    const refBlockMatch = section.match(
      /\*\*参考\*\*:\s*\n([\s\S]*?)(?=\n\*\*标签\*\*)/
    );
    const refLines = refBlockMatch
      ? refBlockMatch[1].split("\n").filter((l) => l.trim().startsWith("-"))
      : [];
    const references = parseReferences(refLines);

    // Answer: everything after ### 答案\n\n
    const answerMatch = section.match(/### 答案\s*\n\n([\s\S]+)$/);
    const answer = answerMatch ? answerMatch[1].trim() : "";

    items.push({ id, question, date, tags, references, answer });
  }

  return items;
}

function main(): void {
  const content = fs.readFileSync(MD_PATH, "utf-8");
  const items = parseFAQ(content);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(items, null, 2), "utf-8");

  console.log(`Parsed ${items.length} FAQ items → ${OUT_PATH}`);
}

main();
