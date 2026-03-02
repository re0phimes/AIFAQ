import { rankSources } from "./grounding";

const ranked = rankSources([
  { title: "Blog", url: "https://someblog.dev/post", type: "blog" },
  { title: "arXiv", url: "https://arxiv.org/abs/1706.03762", type: "paper" },
]);

if (ranked[0].url !== "https://arxiv.org/abs/1706.03762") {
  throw new Error("paper source should rank first");
}
