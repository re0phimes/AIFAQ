export interface GroundingSource {
  type: "paper" | "blog" | "other";
  title: string;
  url: string;
}

export function sourcePriority(source: GroundingSource): number {
  const u = source.url.toLowerCase();
  if (
    source.type === "paper" ||
    u.includes("arxiv.org") ||
    u.includes("openreview.net") ||
    u.includes("acm.org") ||
    u.includes("ieee.org")
  ) {
    return 0;
  }
  if (source.type === "blog") return 1;
  return 2;
}

export function rankSources(sources: GroundingSource[]): GroundingSource[] {
  return [...sources].sort((a, b) => sourcePriority(a) - sourcePriority(b));
}

export function computeEvidenceFlags(sources: GroundingSource[]): {
  sourceCount: number;
  hasPaper: boolean;
  needsManualVerification: boolean;
} {
  const sourceCount = sources.length;
  const hasPaper = sources.some((s) => sourcePriority(s) === 0);
  return {
    sourceCount,
    hasPaper,
    needsManualVerification: sourceCount < 2 || !hasPaper,
  };
}
