export interface CandidateImage {
  url: string;
  alt: string;
  caption: string;
  context: string;
  source: "blog" | "paper";
}

/** Strip all HTML tags and collapse whitespace. */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Extract ~`chars` characters of surrounding plain text around a given
 * position in an HTML string (tags stripped).
 */
function extractContext(
  html: string,
  imgTagPosition: number,
  chars: number = 200
): string {
  const start = Math.max(0, imgTagPosition - chars);
  const end = Math.min(html.length, imgTagPosition + chars);
  return stripHtmlTags(html.slice(start, end));
}

const SKIP_PATTERN = /logo|icon|favicon|avatar|emoji/i;

/**
 * Fetch a blog page and return up to 10 candidate images extracted via regex.
 * Uses a 10-second timeout. Returns [] on any failure.
 */
export async function extractImagesFromBlog(
  blogUrl: string
): Promise<CandidateImage[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(blogUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];
    const html = await res.text();

    const candidates: CandidateImage[] = [];
    const imgRegex = /<img\s[^>]*?>/gi;
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(html)) !== null) {
      if (candidates.length >= 10) break;

      const tag = match[0];
      const srcMatch = tag.match(/src=["']([^"']+)["']/i);
      if (!srcMatch) continue;

      const rawSrc = srcMatch[1];

      // Skip decorative / tiny images
      if (SKIP_PATTERN.test(rawSrc)) continue;
      if (rawSrc.startsWith("data:") && rawSrc.length < 100) continue;

      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(rawSrc, blogUrl).href;
      } catch {
        continue;
      }

      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : "";

      const context = extractContext(html, match.index!, 200);

      candidates.push({
        url: resolvedUrl,
        alt,
        caption: alt,
        context,
        source: "blog",
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

/**
 * Fetch the ar5iv HTML rendering of an arXiv paper and return up to 10
 * candidate images extracted from `<figure>` blocks.
 * Uses a 15-second timeout. Returns [] on any failure.
 */
export async function extractImagesFromArxiv(
  arxivId: string
): Promise<CandidateImage[]> {
  try {
    const baseUrl = `https://ar5iv.labs.arxiv.org/html/${arxivId}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(baseUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];
    const html = await res.text();

    const candidates: CandidateImage[] = [];
    const figureRegex = /<figure[\s\S]*?<\/figure>/gi;
    let match: RegExpExecArray | null;

    while ((match = figureRegex.exec(html)) !== null) {
      if (candidates.length >= 10) break;

      const figureHtml = match[0];

      const imgMatch = figureHtml.match(/src=["']([^"']+)["']/i);
      if (!imgMatch) continue;

      const rawSrc = imgMatch[1];
      if (SKIP_PATTERN.test(rawSrc)) continue;

      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(rawSrc, baseUrl).href;
      } catch {
        continue;
      }

      const captionMatch = figureHtml.match(
        /<figcaption[\s\S]*?>([\s\S]*?)<\/figcaption>/i
      );
      const caption = captionMatch ? stripHtmlTags(captionMatch[1]) : "";

      const altMatch = figureHtml.match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : "";

      candidates.push({
        url: resolvedUrl,
        alt,
        caption,
        context: caption,
        source: "paper",
      });
    }

    return candidates;
  } catch {
    return [];
  }
}

/**
 * Given an array of references, extract candidate images from all blog and
 * paper sources. One failing reference does not affect the others.
 */
export async function extractCandidateImages(
  references: { type: string; url?: string }[]
): Promise<CandidateImage[]> {
  const all: CandidateImage[] = [];

  for (const ref of references) {
    if (!ref.url) continue;

    try {
      if (ref.type === "blog") {
        const images = await extractImagesFromBlog(ref.url);
        all.push(...images);
      } else if (ref.type === "paper") {
        const arxivMatch = ref.url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
        if (arxivMatch) {
          const images = await extractImagesFromArxiv(arxivMatch[1]);
          all.push(...images);
        }
      }
    } catch {
      // Skip this reference on failure; continue with the rest.
    }
  }

  return all;
}
