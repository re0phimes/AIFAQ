import * as fs from "fs";
import * as path from "path";
import type { FAQItem, Reference } from "../src/types/faq";

const MD_PATH = path.resolve(__dirname, "../AI-FAQ.md");
const OUT_PATH = path.resolve(__dirname, "../data/faq.json");
const BLOG_INDEX_PATH = path.resolve(__dirname, "../data/blog-index.json");

interface BlogEntry {
  title: string;
  url: string;
}

function normalize(s: string): string {
  return s
    .replace(/\.md$/i, "")
    .replace(/[（）()：:，,。.、？?！!""''《》\s]/g, "")
    .toLowerCase();
}

function matchBlogUrl(title: string, blogIndex: BlogEntry[]): string | undefined {
  const norm = normalize(title);
  for (const entry of blogIndex) {
    if (normalize(entry.title) === norm) return entry.url;
  }
  for (const entry of blogIndex) {
    const entryNorm = normalize(entry.title);
    if (entryNorm.includes(norm) || norm.includes(entryNorm)) return entry.url;
  }
  return undefined;
}

function parseReferences(lines: string[], blogIndex: BlogEntry[]): Reference[] {
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
      const blogTitle = trimmed.replace(/^来源文章[:：]\s*/, "").replace(/\.md$/i, "");
      const url = matchBlogUrl(blogTitle, blogIndex);
      refs.push({
        type: "blog",
        title: blogTitle,
        author: "Phimes",
        ...(url ? { url } : {}),
      });
    } else {
      refs.push({ type: "other", title: trimmed });
    }
  }
  return refs;
}

function parseFAQ(content: string, blogIndex: BlogEntry[]): FAQItem[] {
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

    // Tags — supports multi-word tags like #Context Engineering
    const tagsMatch = section.match(/\*\*标签\*\*:\s*(.+)$/m);
    const tags: string[] = [];
    if (tagsMatch) {
      const tagMatches = tagsMatch[1].match(/#([^#]+)/g);
      if (tagMatches) {
        for (const t of tagMatches) {
          const tag = t.slice(1).trim();
          if (tag) tags.push(tag);
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
    const references = parseReferences(refLines, blogIndex);

    // Answer: everything after ### 答案\n\n
    const answerMatch = section.match(/### 答案\s*\n\n([\s\S]+)$/);
    const answer = answerMatch ? answerMatch[1].trim() : "";

    items.push({
      id,
      question,
      date,
      tags,
      categories: [],
      references,
      answer,
      upvoteCount: 0,
      downvoteCount: 0,
    });
  }

  return items;
}

function main(): void {
  const content = fs.readFileSync(MD_PATH, "utf-8");

  let blogIndex: BlogEntry[] = [];
  try {
    blogIndex = JSON.parse(fs.readFileSync(BLOG_INDEX_PATH, "utf-8"));
  } catch {
    console.warn("Warning: blog-index.json not found, blog URLs will not be matched");
  }

  const items = parseFAQ(content, blogIndex);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(items, null, 2), "utf-8");

  console.log(`Parsed ${items.length} FAQ items → ${OUT_PATH}`);
}

main();
