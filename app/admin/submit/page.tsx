"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubmitPage() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSubmitting(true);
    setSuccess(false);

    const res = await fetch("/api/admin/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
    });

    if (res.ok) {
      setQuestion("");
      setAnswer("");
      setSuccess(true);
    }
    setSubmitting(false);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-2xl font-bold text-[var(--color-text)]">
        提交新 FAQ
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">问题</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="输入问题..."
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text)]">答案 (Markdown)</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="输入答案，支持 Markdown..."
            rows={12}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 font-mono text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !question.trim() || !answer.trim()}
            className="rounded-lg bg-[var(--color-text)] px-5 py-2 text-sm text-white transition-colors hover:bg-[var(--color-text)]/90 disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交并分析"}
          </button>
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <span>提交成功！</span>
              <button
                type="button"
                onClick={() => router.push("/admin/review")}
                className="text-[var(--color-primary)] underline"
              >
                去审批页查看
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
