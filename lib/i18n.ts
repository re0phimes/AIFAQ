type Lang = "zh" | "en";

/** UI labels for zh/en */
const labels = {
  brief: { zh: "精简", en: "Brief" },
  detailed: { zh: "详细", en: "Detailed" },
  allBrief: { zh: "全部精简", en: "All Brief" },
  allDetailed: { zh: "全部详细", en: "All Detailed" },
  expandAll: { zh: "全部展开", en: "Expand All" },
  collapseAll: { zh: "全部折叠", en: "Collapse All" },
  compare: { zh: "比较", en: "Compare" },
  exitCompare: { zh: "退出比较", en: "Exit Compare" },
  backToList: { zh: "返回列表", en: "Back" },
  exportPdf: { zh: "导出 PDF", en: "Export PDF" },
  sort: { zh: "排序:", en: "Sort:" },
  sortDefault: { zh: "默认", en: "Default" },
  sortDate: { zh: "时间", en: "Date" },
  sortDifficulty: { zh: "难度", en: "Difficulty" },
  helpful: { zh: "有用", en: "Helpful" },
  report: { zh: "反馈", en: "Report" },
  pendingUpdate: { zh: "待更新", en: "Needs Update" },
  noResults: { zh: "没有找到匹配的问题", en: "No matching questions found" },
  remove: { zh: "移除", en: "Remove" },
  submit: { zh: "提交", en: "Submit" },
  cancel: { zh: "取消", en: "Cancel" },
  feedbackPrompt: { zh: "请选择反馈原因:", en: "Select a reason:" },
  detailPlaceholder: { zh: "补充说明 (可选)", en: "Additional details (optional)" },
  onlyDetailed: { zh: "只看详细", en: "Detailed Only" },
  blog: { zh: "博客", en: "Blog" },
  paper: { zh: "论文", en: "Paper" },
  tagFilter: { zh: "标签筛选", en: "Filter by Tag" },
  clearFilter: { zh: "清除", en: "Clear" },
  references: { zh: "参考来源", en: "References" },
  searchCombined: { zh: "组合", en: "All" },
  searchTag: { zh: "标签", en: "Tag" },
  searchContent: { zh: "全文", en: "Content" },
  searchPlaceholderCombined: { zh: "搜索问题...", en: "Search questions..." },
  searchPlaceholderTag: { zh: "输入标签名...", en: "Search by tag..." },
  searchPlaceholderContent: { zh: "搜索答案内容...", en: "Search answers..." },
  prevPage: { zh: "上一页", en: "Prev" },
  nextPage: { zh: "下一页", en: "Next" },
  selected: { zh: "已选", en: "Selected" },
  clearAll: { zh: "清空", en: "Clear" },
  compareView: { zh: "对比查看", en: "Compare" },
  backToTop: { zh: "返回顶部", en: "Back to top" },
  login: { zh: "登录", en: "Login" },
  loginWithGithub: { zh: "使用 GitHub 登录", en: "Sign in with GitHub" },
  logout: { zh: "登出", en: "Logout" },
  favorite: { zh: "收藏", en: "Favorite" },
  unfavorite: { zh: "取消收藏", en: "Unfavorite" },
  myFavorites: { zh: "我的收藏", en: "My Favorites" },
  verifiedVote: { zh: "已认证用户投票", en: "Verified user vote" },
  updated: { zh: "30天内有更新", en: "Updated within 30 days" },
  viewHistory: { zh: "查看历史版本", en: "View answer history" },
} as const;

export function t(key: keyof typeof labels, lang: Lang): string {
  return labels[key][lang];
}

const DOWNVOTE_REASONS_ZH = [
  { value: "outdated", label: "过时" },
  { value: "factual_error", label: "不准确" },
  { value: "unclear", label: "表述不清" },
  { value: "other", label: "其他" },
] as const;

const DOWNVOTE_REASONS_EN = [
  { value: "outdated", label: "Outdated" },
  { value: "factual_error", label: "Inaccurate" },
  { value: "unclear", label: "Unclear" },
  { value: "other", label: "Other" },
] as const;

export function getDownvoteReasons(lang: Lang) {
  return lang === "en" ? DOWNVOTE_REASONS_EN : DOWNVOTE_REASONS_ZH;
}

/** Chinese tag -> English tag mapping */
const tagMap: Record<string, string> = {
  "仿射变换": "Affine Transform",
  "作用域": "Scope",
  "公式": "Formula",
  "公式推导": "Derivation",
  "反面题": "Counterexample",
  "流形": "Manifold",
  "流形假说": "Manifold Hypothesis",
  "线性变换": "Linear Transform",
  "维度": "Dimension",
  "维度变换": "Dim Transform",
  "优化理论": "Optimization Theory",
  "优化目标": "Objective",
  "损失曲面": "Loss Surface",
  "梯度": "Gradient",
  "训练技巧": "Training Tips",
  "位置编码": "Positional Encoding",
  "多头注意力": "Multi-Head Attention",
  "归一化": "Normalization",
  "恒等映射": "Identity Mapping",
  "有界性": "Boundedness",
  "模型设计": "Model Design",
  "残差连接": "Residual Connection",
  "注意力机制": "Attention",
  "深度学习": "Deep Learning",
  "激活函数": "Activation",
  "点积": "Dot Product",
  "特征融合": "Feature Fusion",
  "矩阵吸收": "Matrix Absorption",
  "神经元死亡": "Dead Neurons",
  "缩放点积": "Scaled Dot Product",
  "网络退化": "Degradation",
  "计算复杂度": "Complexity",
  "训练稳定性": "Training Stability",
  "训练过程": "Training Process",
  "内存墙": "Memory Wall",
  "工程实践": "Engineering",
  "推理优化": "Inference Opt",
  "推理阶段": "Inference Phase",
  "量化": "Quantization",
  "推理框架": "Inference Framework",
};

/** Translate a single tag based on lang */
export function translateTag(tag: string, lang: Lang): string {
  if (lang === "zh") return tag;
  return tagMap[tag] ?? tag; // English tags (Transformer, BERT, etc.) pass through
}

/** Category name translation */
const categoryMap: Record<string, string> = {
  "AI 基础概念": "AI Fundamentals",
  "机器学习基础": "ML Basics",
  "深度学习": "Deep Learning",
  "自然语言处理": "NLP",
  "计算机视觉": "Computer Vision",
  "生成式 AI / LLM": "GenAI / LLM",
  "强化学习": "RL",
  "推荐系统与搜索": "RecSys & Search",
  "数据工程与 MLOps": "Data Eng & MLOps",
  "AI 伦理与安全": "AI Ethics & Safety",
  "AI 应用场景": "AI Applications",
  "工具与框架": "Tools & Frameworks",
};

export function translateCategory(name: string, lang: Lang): string {
  if (lang === "zh") return name;
  return categoryMap[name] ?? name;
}

/** Pagination info string */
export function paginationInfo(
  total: number,
  page: number,
  totalPages: number,
  lang: Lang,
): string {
  if (lang === "en") return `${total} items, page ${page}/${totalPages}`;
  return `共 ${total} 条，第 ${page}/${totalPages} 页`;
}

/** Items count string for reading view */
export function itemsCount(count: number, lang: Lang): string {
  if (lang === "en") return `${count} items`;
  return `${count} 题`;
}

/** Per-page size label */
export function perPageLabel(size: number, lang: Lang): string {
  if (lang === "en") return `${size} / page`;
  return `每页 ${size} 条`;
}

/** Selected count for sidebar */
export function selectedCount(count: number, lang: Lang): string {
  if (lang === "en") return `${count} selected`;
  return `已选 ${count} 题`;
}
