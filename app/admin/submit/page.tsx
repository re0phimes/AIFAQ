"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

type ImportStatus = "pending" | "parsing" | "generating" | "judging" | "enriching" | "completed" | "failed" | "timeout";

interface ImportJob {
  importId: string;
  filename: string;
  status: ImportStatus;
  totalQa: number;
  passedQa: number;
  errorMsg: string | null;
  startedAt: number;
}

const STATUS_LABELS: Record<ImportStatus, string> = {
  pending: "等待中",
  parsing: "解析文件...",
  generating: "生成 QA...",
  judging: "评分中...",
  enriching: "增强中...",
  completed: "完成",
  failed: "失败",
  timeout: "超时",
};

const STATUS_PROGRESS: Record<ImportStatus, number> = {
  pending: 5,
  parsing: 20,
  generating: 50,
  judging: 70,
  enriching: 85,
  completed: 100,
  failed: 100,
  timeout: 100,
};

const TIMEOUT_MS = 5 * 60 * 1000;

export default function SubmitPage() {
  const [tab, setTab] = useState<"manual" | "import">("manual");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-serif text-2xl font-bold text-[var(--color-text)]">
        提交新 FAQ
      </h1>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "manual"
              ? "bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-subtext)] hover:text-[var(--color-text)]"
          }`}
        >
          手动输入
        </button>
        <button
          onClick={() => setTab("import")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "import"
              ? "bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-subtext)] hover:text-[var(--color-text)]"
          }`}
        >
          文件导入
        </button>
      </div>

      {tab === "manual" ? <ManualForm /> : <FileImport />}
    </div>
  );
}

function ManualForm() {
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
  );
}

function FileImport() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["md", "txt", "pdf"].includes(ext || "")) continue;
      if (file.size > 4 * 1024 * 1024) {
        setJobs((prev) => [...prev, {
          importId: `local_${Date.now()}`,
          filename: file.name,
          status: "failed",
          totalQa: 0,
          passedQa: 0,
          errorMsg: "文件超过 4MB 限制",
          startedAt: Date.now(),
        }]);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/admin/faq/import", { method: "POST", body: formData });
        const data = await res.json();
        if (res.ok) {
          setJobs((prev) => [...prev, {
            importId: data.importId,
            filename: file.name,
            status: "pending",
            totalQa: 0,
            passedQa: 0,
            errorMsg: null,
            startedAt: Date.now(),
          }]);
        } else {
          setJobs((prev) => [...prev, {
            importId: `err_${Date.now()}`,
            filename: file.name,
            status: "failed",
            totalQa: 0,
            passedQa: 0,
            errorMsg: data.error || "上传失败",
            startedAt: Date.now(),
          }]);
        }
      } catch {
        setJobs((prev) => [...prev, {
          importId: `err_${Date.now()}`,
          filename: file.name,
          status: "failed",
          totalQa: 0,
          passedQa: 0,
          errorMsg: "网络错误",
          startedAt: Date.now(),
        }]);
      }
    }
  }, []);

  // Poll active jobs
  useEffect(() => {
    const activeJobs = jobs.filter((j) =>
      !["completed", "failed", "timeout"].includes(j.status)
    );
    if (activeJobs.length === 0) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      return;
    }

    if (pollingRef.current) return;

    pollingRef.current = setInterval(async () => {
      setJobs((prev) =>
        prev.map((job) => {
          if (["completed", "failed", "timeout"].includes(job.status)) return job;
          if (Date.now() - job.startedAt > TIMEOUT_MS) {
            return { ...job, status: "timeout" as ImportStatus };
          }
          return job;
        })
      );

      for (const job of activeJobs) {
        if (job.importId.startsWith("local_") || job.importId.startsWith("err_")) continue;
        try {
          const res = await fetch(`/api/admin/faq/import/${job.importId}`);
          if (!res.ok) continue;
          const data = await res.json();
          setJobs((prev) =>
            prev.map((j) =>
              j.importId === job.importId
                ? { ...j, status: data.status, totalQa: data.total_qa ?? 0, passedQa: data.passed_qa ?? 0, errorMsg: data.error_msg }
                : j
            )
          );
        } catch { /* ignore polling errors */ }
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [jobs]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
            : "border-[var(--color-border)] bg-[var(--color-panel)] hover:border-[var(--color-primary)]/50"
        }`}
      >
        <p className="text-sm text-[var(--color-text)]">
          拖拽文件到此处，或点击选择文件
        </p>
        <p className="mt-1 text-xs text-[var(--color-subtext)]">
          支持 .md / .txt / .pdf，单文件最大 4MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.txt,.pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Job queue */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[var(--color-text)]">处理队列</h3>
          {jobs.map((job) => (
            <div key={job.importId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--color-text)] truncate max-w-[60%]">{job.filename}</span>
                <span className={`text-xs ${
                  job.status === "completed" ? "text-green-600" :
                  job.status === "failed" || job.status === "timeout" ? "text-red-500" :
                  "text-[var(--color-subtext)]"
                }`}>
                  {STATUS_LABELS[job.status]}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    job.status === "failed" || job.status === "timeout" ? "bg-red-400" :
                    job.status === "completed" ? "bg-green-500" :
                    "bg-[var(--color-primary)]"
                  }`}
                  style={{ width: `${STATUS_PROGRESS[job.status]}%` }}
                />
              </div>
              {/* Stats */}
              {job.status === "completed" && job.totalQa > 0 && (
                <p className="mt-1 text-xs text-[var(--color-subtext)]">
                  生成 {job.totalQa} 个 QA，通过 {job.passedQa} 个
                </p>
              )}
              {job.errorMsg && (
                <p className="mt-1 text-xs text-red-500">{job.errorMsg}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* API docs */}
      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-[var(--color-text)]">
          API 调用说明
        </summary>
        <div className="border-t border-[var(--color-border)] px-4 py-3 text-xs">
          <p className="mb-2 text-[var(--color-subtext)]">通过 API 上传文件：</p>
          <pre className="overflow-x-auto rounded-lg bg-[var(--color-surface)] p-3 font-mono text-[var(--color-text)]">{`curl -X POST /api/admin/faq/import \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf"`}</pre>
          <p className="mt-2 text-[var(--color-subtext)]">查询处理状态：</p>
          <pre className="overflow-x-auto rounded-lg bg-[var(--color-surface)] p-3 font-mono text-[var(--color-text)]">{`curl /api/admin/faq/import/IMPORT_ID \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</pre>
          <p className="mt-2 text-[var(--color-subtext)]">
            设置环境变量 <code className="rounded bg-[var(--color-surface)] px-1">ADMIN_API_KEY</code> 后即可使用 Bearer 认证。
          </p>
        </div>
      </details>
    </div>
  );
}
