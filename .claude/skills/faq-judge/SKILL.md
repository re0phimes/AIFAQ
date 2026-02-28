# faq-judge

评估 QA 对质量，从问题和答案两个维度打分，给出改进建议。

## 输入

- QA 对列表（question + answer）
- 原文摘要（可选，用于评估 context_relevance）

## 评分维度

### 问题评分 (1-5)

| 维度 | 说明 |
|------|------|
| naturalness | 是否像真实用户会问的，不是生硬拼凑 |
| context_relevance | 脱离原文后问题是否还有意义 |
| knowledge_clarity | 是否清楚在考什么知识 |
| phrasing | 结合场景的问法是否恰当 |

### 答案评分 (1-5)

| 维度 | 说明 |
|------|------|
| accuracy | 答案是否正确 |
| completeness | 是否充分回答了问题 |
| mastery | 读者看完能否真正理解这个知识点 |
| independence | 不依赖原文上下文也能理解 |

### 额外维度（同步工作流扩展）

| 维度 | 说明 |
|------|------|
| scenario_completeness | 问题是否包含足够的场景约束（模型、参数、硬件等） |
| formula_rigor | 公式是否有来源说明、参数定义、代入实际值的示例 |

### LaTeX 公式格式准确性（硬性要求）

评估时必须检查 question 和 answer 中所有 LaTeX 公式的格式准确性：

- 行内公式必须用 `$...$` 包裹，且能正确渲染（无未闭合的 `$`、无多余转义）
- 行间公式必须用 `$$...$$` 包裹
- 常见错误：`$` 未配对、`\\` 转义不当导致渲染失败、公式中混入非 LaTeX 文本
- 如果 question 或 answer 中存在无法正确渲染的公式，必须在 suggestion 中指出并给出修正

**这是硬性检查项**：公式格式错误不单独扣分，但必须在 answer_suggestion 或 question_suggestion 中明确标注，且改写时必须修复。

## 输出

对每个 QA 对输出：
- 各维度分数（1-5）
- 平均分
- verdict: `pass`（平均分 >= 3.5）或 `fail`
- question_suggestion: 问题改进建议
- answer_suggestion: 答案改进建议

## 示例调用

```
评估这组 QA 的质量：
问题：对 LLaMA-7B 使用 LoRA（rank=16）进行 SFT，显存占用大约多少？
答案：...
```

## Batch Mode

当用户指定 `data/faq-sync/` 目录时，进入批量评估模式：

1. 自动读取目录下所有 `*.json` 文件（跳过 `_` 开头的文件如 `_report.json`）
2. 解析每个 JSON 文件中的 `question` 和 `answer` 字段
3. 对每个 QA 对使用上述 10 维度评分标准逐条评估
4. 生成汇总报告，写入 `data/faq-sync/_report.json`

### 报告格式

```json
{
  "evaluated_at": "2026-02-28T12:00:00Z",
  "total": 50,
  "passed": 42,
  "failed": 8,
  "results": [
    {
      "id": 42,
      "file": "42.json",
      "question_scores": { "naturalness": 4, "context_relevance": 5, "knowledge_clarity": 4, "phrasing": 3 },
      "answer_scores": { "accuracy": 5, "completeness": 4, "mastery": 3, "independence": 2 },
      "scenario_completeness": 4,
      "formula_rigor": 3,
      "average": 3.7,
      "verdict": "pass",
      "question_suggestion": "...",
      "answer_suggestion": "..."
    }
  ]
}
```

### 对 fail 条目的处理

报告中每个 `verdict: "fail"` 的条目会包含：
- 各维度的具体分数，方便定位薄弱项
- `question_suggestion` 和 `answer_suggestion` 给出针对性改进建议
- 低分维度（< 3 分）会被重点标注

评估完成后，建议使用 `faq-generator` 的改写模式（Rewrite Mode）对 fail 条目进行改进：

```
改写 data/faq-sync/42.json，参考 _report.json 中的建议
```

### 示例调用

```
评估 data/faq-sync/ 下的所有 FAQ
```
