"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { t } from "@/lib/i18n";
import type { FAQItem, VoteType } from "@/src/types/faq";
import FavoriteCard from "@/components/FavoriteCard";
import Toast from "@/components/Toast";
import DetailModal from "@/components/DetailModal";
import taxonomy from "@/data/tag-taxonomy.json";

const LS_VOTED = "aifaq-voted";

function loadVotedMap(): Map<number, VoteType> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_VOTED);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, VoteType>;
    const map = new Map<number, VoteType>();
    for (const [k, v] of Object.entries(obj)) map.set(Number(k), v);
    return map;
  } catch {
    return new Map();
  }
}

function saveVotedMap(map: Map<number, VoteType>): void {
  if (typeof window === "undefined") return;
  const obj: Record<string, VoteType> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  localStorage.setItem(LS_VOTED, JSON.stringify(obj));
}

// Alert Triangle Icon Component
function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

interface FavoriteItem {
  faq_id: number;
  learning_status: "unread" | "learning" | "mastered";
  created_at: string;
  last_viewed_at: string | null;
  relative_time_label: string;
  needs_nudge: boolean;
  faq: FAQItem;
}

interface Stats {
  total: number;
  unread: number;
  learning: number;
  mastered: number;
  stale: number;
}

interface ProfileClientProps {
  favorites: FavoriteItem[];
  stats: Stats;
  lang: "zh" | "en";
  sessionUser?: { id?: string; name?: string | null; image?: string | null } | null;
}

interface ToastState {
  message: string;
  faqId: number;
}

export default function ProfileClient({
  favorites: initialFavorites,
  stats: initialStats,
  lang,
  sessionUser,
}: ProfileClientProps) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [stats, setStats] = useState(initialStats);
  const [showStaleReminder, setShowStaleReminder] = useState(initialStats.stale > 0);
  const [activeTab, setActiveTab] = useState<"learning" | "settings">("learning");
  const [filter, setFilter] = useState<"all" | "unread" | "learning" | "mastered">("all");
  const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [globalDetailed, setGlobalDetailed] = useState(false);
  const [openItems, setOpenItems] = useState<Set<number>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<FAQItem | null>(null);
  const [votedMap, setVotedMap] = useState<Map<number, VoteType>>(loadVotedMap);
  const [fingerprint, setFingerprint] = useState("");

  const votedMapRef = useRef(votedMap);
  const fingerprintRef = useRef(fingerprint);

  useEffect(() => {
    votedMapRef.current = votedMap;
  }, [votedMap]);

  useEffect(() => {
    fingerprintRef.current = fingerprint;
  }, [fingerprint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("aifaq-defaultDetailed");
    if (saved !== null) setGlobalDetailed(saved === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("aifaq-defaultDetailed", String(globalDetailed));
  }, [globalDetailed]);

  useEffect(() => {
    if (sessionUser?.id) return;
    import("@fingerprintjs/fingerprintjs")
      .then((FP) => FP.load())
      .then((fp) => fp.get())
      .then((result) => setFingerprint(result.visitorId))
      .catch(() => {});
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!fingerprint) return;
    fetch(`/api/faq/votes?fingerprint=${fingerprint}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, string> | null) => {
        if (!data) return;
        const map = new Map<number, VoteType>();
        for (const [k, v] of Object.entries(data)) {
          if (v === "upvote" || v === "downvote") {
            map.set(Number(k), v as VoteType);
          }
        }
        setVotedMap(map);
        saveVotedMap(map);
      })
      .catch(() => {});
  }, [fingerprint]);

  const handleVote = useCallback(
    async (faqId: number, type: VoteType, reason?: string, detail?: string) => {
      const fp = fingerprintRef.current;
      if (!fp && !sessionUser?.id) return;
      const current = votedMapRef.current.get(faqId);

      setVotedMap((prev) => {
        const next = new Map(prev);
        next.set(faqId, type);
        saveVotedMap(next);
        return next;
      });

      try {
        const res = await fetch(`/api/faq/${faqId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, fingerprint: fp || undefined, reason, detail }),
        });
        if (!res.ok && res.status !== 409) {
          setVotedMap((prev) => {
            const next = new Map(prev);
            if (current) next.set(faqId, current);
            else next.delete(faqId);
            saveVotedMap(next);
            return next;
          });
        }
      } catch {
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          else next.delete(faqId);
          saveVotedMap(next);
          return next;
        });
      }
    },
    [sessionUser?.id]
  );

  const handleRevokeVote = useCallback(
    async (faqId: number) => {
      const fp = fingerprintRef.current;
      if (!fp && !sessionUser?.id) return;
      const current = votedMapRef.current.get(faqId);

      setVotedMap((prev) => {
        const next = new Map(prev);
        next.delete(faqId);
        saveVotedMap(next);
        return next;
      });

      try {
        const res = await fetch(`/api/faq/${faqId}/vote`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: fp || undefined }),
        });
        if (!res.ok) {
          setVotedMap((prev) => {
            const next = new Map(prev);
            if (current) next.set(faqId, current);
            saveVotedMap(next);
            return next;
          });
        }
      } catch {
        setVotedMap((prev) => {
          const next = new Map(prev);
          if (current) next.set(faqId, current);
          saveVotedMap(next);
          return next;
        });
      }
    },
    [sessionUser?.id]
  );

  const handleModalVote = useCallback(
    (type: VoteType, reason?: string, detail?: string) => {
      if (modalItem) handleVote(modalItem.id, type, reason, detail);
    },
    [modalItem, handleVote]
  );

  const handleModalRevokeVote = useCallback(() => {
    if (modalItem) handleRevokeVote(modalItem.id);
  }, [modalItem, handleRevokeVote]);

  const handleUpdateStatus = useCallback(async (faqId: number, status: "learning" | "mastered") => {
    try {
      const currentItem = favorites.find((f) => f.faq_id === faqId);
      const previousStatus = currentItem?.learning_status;
      if (!previousStatus || previousStatus === status) return;

      const res = await fetch(`/api/favorites/${faqId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFavorites((prev) =>
          prev.map((f) => {
            if (f.faq_id !== faqId) return f;
            if (status === "learning") {
              return {
                ...f,
                learning_status: status,
                last_viewed_at: new Date().toISOString(),
                relative_time_label: lang === "en" ? "0 days ago" : "0 天前",
                needs_nudge: false,
              };
            }
            return {
              ...f,
              learning_status: status,
              needs_nudge: false,
            };
          })
        );

        setStats((prev) => {
          const next = { ...prev };

          if (previousStatus === "unread") next.unread = Math.max(0, next.unread - 1);
          else if (previousStatus === "learning") next.learning = Math.max(0, next.learning - 1);
          else if (previousStatus === "mastered") next.mastered = Math.max(0, next.mastered - 1);

          if (status === "learning") next.learning += 1;
          else if (status === "mastered") next.mastered += 1;

          if (currentItem?.needs_nudge) {
            next.stale = Math.max(0, next.stale - 1);
          }

          return next;
        });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  }, [favorites, lang]);

  const handleOpenFavorite = useCallback((item: Pick<FavoriteItem, "faq_id" | "faq" | "learning_status">) => {
    if (item.learning_status === "unread") {
      void handleUpdateStatus(item.faq_id, "learning");
    }

    if (globalDetailed) {
      setModalItem(item.faq);
      setIsModalOpen(true);
      return;
    }
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.faq_id)) next.delete(item.faq_id);
      else next.add(item.faq_id);
      return next;
    });
  }, [globalDetailed, handleUpdateStatus]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setModalItem(null), 100);
  }, []);

  const actuallyRemoveFavorite = useCallback((faqId: number) => {
    const removedItem = favorites.find((f) => f.faq_id === faqId);
    setFavorites((prev) => prev.filter((f) => f.faq_id !== faqId));
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.delete(faqId);
      return next;
    });
    if (modalItem?.id === faqId) {
      setIsModalOpen(false);
      setModalItem(null);
    }

    setStats((prev) => {
      const newStats = {
        total: prev.total - 1,
        unread: prev.unread,
        learning: prev.learning,
        mastered: prev.mastered,
        stale: prev.stale,
      };
      if (removedItem) {
        if (removedItem.learning_status === "unread") newStats.unread--;
        else if (removedItem.learning_status === "learning") newStats.learning--;
        else if (removedItem.learning_status === "mastered") newStats.mastered--;
        if (removedItem.needs_nudge) newStats.stale = Math.max(0, newStats.stale - 1);
      }
      return newStats;
    });
  }, [favorites, modalItem?.id]);

  const handleToggleFavorite = async (faqId: number) => {
    try {
      const res = await fetch(`/api/faq/${faqId}/favorite`, {
        method: "POST",
      });
      if (res.ok) {
        const { favorited } = await res.json();
        if (!favorited) {
          setPendingRemovals((prev) => new Set(prev).add(faqId));
          setToast({ message: t("removedFromFavorites", lang), faqId });
        }
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
    }
  };

  const handleUndo = async (faqId: number) => {
    try {
      const res = await fetch(`/api/faq/${faqId}/favorite`, {
        method: "POST",
      });
      if (res.ok) {
        const { favorited } = await res.json();
        if (favorited) {
          setPendingRemovals((prev) => {
            const next = new Set(prev);
            next.delete(faqId);
            return next;
          });
          setToast(null);
        }
      }
    } catch (error) {
      console.error("Failed to undo favorite:", error);
    }
  };

  const handleToastClose = (faqId: number) => {
    if (pendingRemovals.has(faqId)) {
      actuallyRemoveFavorite(faqId);
      setPendingRemovals((prev) => {
        const next = new Set(prev);
        next.delete(faqId);
        return next;
      });
    }
    setToast(null);
  };

  const filteredFavorites = favorites
    .filter((f) => filter === "all" || f.learning_status === filter)
    .filter((f) => !pendingRemovals.has(f.faq_id));

  const modalCurrentVote = modalItem ? (votedMap.get(modalItem.id) ?? null) : null;
  const modalIsFavorited =
    modalItem
      ? favorites.some((f) => f.faq_id === modalItem.id) && !pendingRemovals.has(modalItem.id)
      : false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-brand text-2xl font-bold text-text md:text-[28px]">AIFAQ</h1>
            <Link
              href="/"
              className="flex items-center gap-1 rounded-full border-[0.5px] border-border px-2.5 py-1 text-[11px] text-subtext transition-colors hover:bg-surface"
            >
              ← {t("backToHome", lang)}
            </Link>
          </div>
          <p className="mt-0.5 text-xs text-subtext">{t("trackProgress", lang)}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("learning")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "learning"
                ? "bg-primary text-white"
                : "border-[0.5px] border-border text-subtext hover:bg-surface"
            }`}
          >
            {t("myLearning", lang)}
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-primary text-white"
                : "border-[0.5px] border-border text-subtext hover:bg-surface"
            }`}
          >
            {t("settings", lang)}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          action={{ label: t("undo", lang), onClick: () => handleUndo(toast.faqId) }}
          onClose={() => handleToastClose(toast.faqId)}
          duration={5000}
        />
      )}

      {activeTab === "learning" ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-3">
              <div className="text-xl font-bold text-text">{stats.total}</div>
              <div className="text-xs text-subtext">{t("totalFavorites", lang)}</div>
            </div>
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-3">
              <div className="text-xl font-bold text-blue-600">{stats.learning}</div>
              <div className="text-xs text-subtext">{t("learningStatus", lang)}</div>
            </div>
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-3">
              <div className="text-xl font-bold text-green-600">{stats.mastered}</div>
              <div className="text-xs text-subtext">{t("masteredStatus", lang)}</div>
            </div>
          </div>

          {showStaleReminder && stats.stale > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-5 w-5 text-amber-600" />
                <span className="text-sm text-amber-900">
                  {t("staleReminder", lang).replace("{count}", String(stats.stale))}
                </span>
              </div>
              <button
                onClick={() => setShowStaleReminder(false)}
                className="text-xs text-amber-600 hover:text-amber-800"
              >
                {t("ignore", lang)}
              </button>
            </div>
          )}

          {favorites.length > 0 && (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
                {[
                  { key: "all", label: `${t("all", lang)} (${stats.total})` },
                  { key: "unread", label: `${t("unreadStatus", lang)} (${stats.unread})` },
                  { key: "learning", label: `${t("learningStatus", lang)} (${stats.learning})` },
                  { key: "mastered", label: `${t("masteredStatus", lang)} (${stats.mastered})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as typeof filter)}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                      filter === key
                        ? "bg-primary text-white"
                        : "bg-surface text-subtext hover:bg-bg"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-subtext">{t("defaultViewMode", lang)}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGlobalDetailed(false)}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      !globalDetailed
                        ? "bg-primary text-white"
                        : "border-[0.5px] border-border text-subtext hover:bg-surface"
                    }`}
                  >
                    {t("brief", lang)}
                  </button>
                  <button
                    onClick={() => setGlobalDetailed(true)}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      globalDetailed
                        ? "bg-primary text-white"
                        : "border-[0.5px] border-border text-subtext hover:bg-surface"
                    }`}
                  >
                    {t("detailed", lang)}
                  </button>
                </div>
              </div>
            </div>
          )}

          {filteredFavorites.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtext">{t("noFavorites", lang)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFavorites.map((item) => (
                <FavoriteCard
                  key={item.faq_id}
                  item={item}
                  lang={lang}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleFavorite={handleToggleFavorite}
                  onOpenItem={handleOpenFavorite}
                  showMasterButton={item.learning_status === "learning"}
                  isPending={pendingRemovals.has(item.faq_id)}
                  detailedMode={globalDetailed}
                  isExpanded={openItems.has(item.faq_id)}
                  onToggleExpand={(faqId) =>
                    setOpenItems((prev) => {
                      const next = new Set(prev);
                      if (next.has(faqId)) next.delete(faqId);
                      else next.add(faqId);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <SettingsTab lang={lang} sessionUser={sessionUser} />
      )}

      <DetailModal
        item={modalItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        lang={lang}
        onVote={handleModalVote}
        onRevokeVote={handleModalRevokeVote}
        currentVote={modalCurrentVote}
        upvoteCount={modalItem?.upvoteCount}
        downvoteCount={modalItem?.downvoteCount}
        isFavorited={modalIsFavorited}
        onToggleFavorite={() => modalItem && handleToggleFavorite(modalItem.id)}
        isAuthenticated={!!sessionUser?.id}
      />
    </div>
  );
}

interface SettingsTabProps {
  lang: "zh" | "en";
  sessionUser?: { id?: string; name?: string | null; image?: string | null } | null;
}

function SettingsTab({ lang, sessionUser }: SettingsTabProps) {
  const [settings, setSettings] = useState({
    lang:
      ((typeof window !== "undefined" ? localStorage.getItem("aifaq-lang") : null) as
        | "zh"
        | "en") || lang,
    pageSize:
      Number(typeof window !== "undefined" ? localStorage.getItem("aifaq-pageSize") : null) || 20,
    defaultDetailed:
      (typeof window !== "undefined" ? localStorage.getItem("aifaq-defaultDetailed") : null) ===
      "true",
    focusCategories:
      typeof window !== "undefined" && localStorage.getItem("aifaq-focus-categories")
        ? (() => {
            try {
              const parsed = JSON.parse(
                localStorage.getItem("aifaq-focus-categories") || "[]"
              ) as unknown;
              return Array.isArray(parsed)
                ? parsed.filter((item): item is string => typeof item === "string")
                : [];
            } catch {
              return [];
            }
          })()
        : [],
  });

  const availableCategories = taxonomy.categories.map((category) => category.name);

  const saveLocalPreferences = useCallback((next: typeof settings): void => {
    localStorage.setItem("aifaq-lang", next.lang);
    localStorage.setItem("aifaq-pageSize", String(next.pageSize));
    localStorage.setItem("aifaq-pagesize", String(next.pageSize));
    localStorage.setItem("aifaq-defaultDetailed", String(next.defaultDetailed));
    localStorage.setItem("aifaq-global-detailed", String(next.defaultDetailed));
    localStorage.setItem("aifaq-focus-categories", JSON.stringify(next.focusCategories));
    localStorage.setItem(
      "aifaq-prefs-v2",
      JSON.stringify({
        language: next.lang,
        pageSize: next.pageSize,
        defaultDetailed: next.defaultDetailed,
        focusCategories: next.focusCategories,
        updatedAt: new Date().toISOString(),
      })
    );
  }, []);

  const patchRemote = useCallback(async (patch: Record<string, unknown>) => {
    try {
      await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      // keep local settings if network fails
    }
  }, []);

  useEffect(() => {
    fetch("/api/user/preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((remote) => {
        if (!remote) return;
        setSettings((prev) => {
          const next = {
            lang: (remote.language === "en" || remote.language === "zh"
              ? remote.language
              : prev.lang) as "zh" | "en",
            pageSize:
              typeof remote.page_size === "number" ? remote.page_size : prev.pageSize,
            defaultDetailed:
              typeof remote.default_detailed === "boolean"
                ? remote.default_detailed
                : prev.defaultDetailed,
            focusCategories: Array.isArray(remote.focus_categories)
              ? remote.focus_categories.filter(
                  (item: unknown): item is string => typeof item === "string"
                )
              : prev.focusCategories,
          };
          saveLocalPreferences(next);
          return next;
        });
      })
      .catch(() => {});
  }, [saveLocalPreferences]);

  const updateSetting = <K extends "lang" | "pageSize" | "defaultDetailed">(
    key: K,
    value: (typeof settings)[K]
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveLocalPreferences(next);
      return next;
    });
    if (key === "lang") {
      void patchRemote({ language: value });
    } else if (key === "pageSize") {
      void patchRemote({ page_size: value });
    } else if (key === "defaultDetailed") {
      void patchRemote({ default_detailed: value });
    }
  };

  const toggleFocusCategory = (category: string) => {
    setSettings((prev) => {
      const nextCategories = prev.focusCategories.includes(category)
        ? prev.focusCategories.filter((item) => item !== category)
        : [...prev.focusCategories, category];
      const next = { ...prev, focusCategories: nextCategories };
      saveLocalPreferences(next);
      void patchRemote({ focus_categories: nextCategories });
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("accountInfo", lang)}
        </h2>
        <div className="flex items-center gap-4">
          {sessionUser?.image && (
            <Image
              src={sessionUser.image}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full"
              unoptimized
            />
          )}
          <div>
            <div className="font-medium text-text">{sessionUser?.name || "-"}</div>
            <div className="text-sm text-subtext">ID: {sessionUser?.id?.slice(-8) || "-"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("preferences", lang)}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("language", lang) || "语言 / Language"}
            </label>
            <div className="flex gap-2">
              {(["zh", "en"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => updateSetting("lang", l)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.lang === l
                      ? "bg-primary text-white"
                      : "border-[0.5px] border-border text-subtext hover:bg-surface"
                  }`}
                >
                  {l === "zh" ? "中文" : "EN"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultPageSize", lang)}
            </label>
            <div className="flex gap-2">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSetting("pageSize", size)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.pageSize === size
                      ? "bg-primary text-white"
                      : "border-[0.5px] border-border text-subtext hover:bg-surface"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultViewMode", lang)}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting("defaultDetailed", false)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  !settings.defaultDetailed
                    ? "bg-primary text-white"
                    : "border-[0.5px] border-border text-subtext hover:bg-surface"
                }`}
              >
                {t("brief", lang)}
              </button>
              <button
                onClick={() => updateSetting("defaultDetailed", true)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  settings.defaultDetailed
                    ? "bg-primary text-white"
                    : "border-[0.5px] border-border text-subtext hover:bg-surface"
                }`}
              >
                {t("detailed", lang)}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("myFocus", lang)}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((category) => {
                const selected = settings.focusCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleFocusCategory(category)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      selected
                        ? "bg-primary text-white"
                        : "border-[0.5px] border-border text-subtext hover:bg-surface"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
