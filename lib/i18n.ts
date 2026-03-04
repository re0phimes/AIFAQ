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
  levelAll: { zh: "L1/L2", en: "L1/L2" },
  level1: { zh: "L1", en: "L1" },
  level2: { zh: "L2", en: "L2" },
  helpful: { zh: "有用", en: "Helpful" },
  report: { zh: "反馈", en: "Report" },
  pendingUpdate: { zh: "待更新", en: "Needs Update" },
  noResults: { zh: "没有找到匹配的问题", en: "No matching questions found" },
  remove: { zh: "移除", en: "Remove" },
  submit: { zh: "提交", en: "Submit" },
  cancel: { zh: "取消", en: "Cancel" },
  confirm: { zh: "确认", en: "Confirm" },
  ok: { zh: "我知道了", en: "OK" },
  notice: { zh: "提示", en: "Notice" },
  syncPromptTitle: { zh: "偏好导入", en: "Import Preferences" },
  focusNotSetTitle: { zh: "关注未设置", en: "Focus Not Set" },
  loginRequiredTitle: { zh: "需要登录", en: "Sign-in Required" },
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
  myFocus: { zh: "我的关注", en: "My Focus" },
  verifiedVote: { zh: "已认证用户投票", en: "Verified user vote" },
  updated: { zh: "30天内有更新", en: "Updated within 30 days" },
  visitMainSite: { zh: "访问主站", en: "Visit Main Site" },
  viewHistory: { zh: "查看历史版本", en: "View answer history" },
  myLearning: { zh: "我的学习", en: "My Learning" },
  totalFavorites: { zh: "总收藏", en: "Total" },
  learningStatus: { zh: "学习中", en: "Learning" },
  masteredStatus: { zh: "已内化", en: "Mastered" },
  unreadStatus: { zh: "未看", en: "Unread" },
  staleReminder: { zh: "你有 {count} 个收藏超过14天未回顾，建议尽快内化", en: "You have {count} favorites not reviewed for 14+ days" },
  savedAt: { zh: "收藏时间", en: "Saved" },
  lastReviewedAt: { zh: "最近回顾", en: "Last reviewed" },
  internalizeSoon: { zh: "已超过 2 周未回顾，建议尽快内化", en: "No review for 2+ weeks, internalize soon" },
  ignore: { zh: "忽略", en: "Ignore" },
  markAsMastered: { zh: "标记为已内化", en: "Mark as Mastered" },
  startCollecting: { zh: "开始收藏你感兴趣的 FAQ 吧！", en: "Start collecting FAQs you're interested in!" },
  trackProgress: { zh: "追踪你的学习进度", en: "Track your learning progress" },
  updating: { zh: "更新中...", en: "Updating..." },
  backButton: { zh: "← 返回", en: "← Back" },
  settings: { zh: "设置", en: "Settings" },
  accountInfo: { zh: "账号信息", en: "Account Info" },
  preferences: { zh: "偏好设置", en: "Preferences" },
  defaultPageSize: { zh: "默认每页数量", en: "Items per page" },
  defaultViewMode: { zh: "默认视图模式", en: "Default view mode" },
  language: { zh: "语言", en: "Language" },
  backToHome: { zh: "返回首页", en: "Back to Home" },
  removedFromFavorites: { zh: "已取消收藏", en: "Removed from favorites" },
  undo: { zh: "撤销", en: "Undo" },
  loginToFavorite: { zh: "登录后收藏", en: "Sign in to favorite" },
  all: { zh: "全部", en: "All" },
  startLearning: { zh: "开始学习", en: "Start Learning" },
  noFavorites: { zh: "暂无收藏", en: "No favorites yet" },
  saved: { zh: "已收藏", en: "Saved" },
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
