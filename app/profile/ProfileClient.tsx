"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";
import FavoriteCard from "@/components/FavoriteCard";
import Toast from "@/components/Toast";

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
  learning_status: 'unread' | 'learning' | 'mastered';
  created_at: string;
  last_viewed_at: string | null;
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

export default function ProfileClient({ favorites: initialFavorites, stats: initialStats, lang, sessionUser }: ProfileClientProps) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [stats, setStats] = useState(initialStats);
  const [showStaleReminder, setShowStaleReminder] = useState(initialStats.stale > 0);
  const [activeTab, setActiveTab] = useState<'learning' | 'settings'>('learning');
  const [pendingRemovals, setPendingRemovals] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleUpdateStatus = async (faqId: number, status: 'learning' | 'mastered') => {
    try {
      const res = await fetch(`/api/favorites/${faqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        // Update local state immediately instead of reloading
        setFavorites(prev => prev.map(f =>
          f.faq_id === faqId ? { ...f, learning_status: status } : f
        ));

        // Update stats
        setStats(prev => ({
          ...prev,
          learning: status === 'mastered' ? prev.learning - 1 : prev.learning,
          mastered: status === 'mastered' ? prev.mastered + 1 : prev.mastered
        }));
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const actuallyRemoveFavorite = useCallback((faqId: number) => {
    const removedItem = favorites.find(f => f.faq_id === faqId);
    setFavorites(prev => prev.filter(f => f.faq_id !== faqId));

    // Update stats
    setStats(prev => {
      const newStats = {
        total: prev.total - 1,
        unread: prev.unread,
        learning: prev.learning,
        mastered: prev.mastered,
        stale: prev.stale
      };
      if (removedItem) {
        if (removedItem.learning_status === 'unread') newStats.unread--;
        else if (removedItem.learning_status === 'learning') newStats.learning--;
        else if (removedItem.learning_status === 'mastered') newStats.mastered--;
      }
      return newStats;
    });
  }, [favorites]);

  const handleToggleFavorite = async (faqId: number) => {
    try {
      const res = await fetch(`/api/faq/${faqId}/favorite`, {
        method: 'POST'
      });
      if (res.ok) {
        const { favorited } = await res.json();
        if (!favorited) {
          // Mark as pending removal (visual feedback)
          setPendingRemovals(prev => new Set(prev).add(faqId));
          // Show toast for undo
          setToast({ message: t("removedFromFavorites", lang), faqId });
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleUndo = async (faqId: number) => {
    try {
      // Call API to re-add to favorites
      const res = await fetch(`/api/faq/${faqId}/favorite`, {
        method: 'POST'
      });
      if (res.ok) {
        const { favorited } = await res.json();
        if (favorited) {
          // Remove from pending - item will be restored visually
          setPendingRemovals(prev => {
            const next = new Set(prev);
            next.delete(faqId);
            return next;
          });
          setToast(null);
        }
      }
    } catch (error) {
      console.error('Failed to undo favorite:', error);
    }
  };

  const handleToastClose = (faqId: number) => {
    // Only actually remove if still pending (not undone)
    if (pendingRemovals.has(faqId)) {
      actuallyRemoveFavorite(faqId);
      setPendingRemovals(prev => {
        const next = new Set(prev);
        next.delete(faqId);
        return next;
      });
    }
    setToast(null);
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
            <Link
              href="/"
              className="flex items-center gap-1 rounded-full border-[0.5px] border-border px-2.5 py-1 text-xs text-subtext hover:bg-surface transition-colors"
            >
              ← {t("backToHome", lang)}
            </Link>
          </div>
          <p className="mt-1 text-sm text-subtext">{t("trackProgress", lang)}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('learning')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'learning'
                ? 'bg-primary text-white'
                : 'border-[0.5px] border-border text-subtext hover:bg-surface'
            }`}
          >
            {t("myLearning", lang)}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'bg-primary text-white'
                : 'border-[0.5px] border-border text-subtext hover:bg-surface'
            }`}
          >
            {t("settings", lang)}
          </button>
        </div>
      </div>

      {/* Toast for undo */}
      {toast && (
        <Toast
          message={toast.message}
          action={{ label: t("undo", lang), onClick: () => handleUndo(toast.faqId) }}
          onClose={() => handleToastClose(toast.faqId)}
          duration={5000}
        />
      )}

      {activeTab === 'learning' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-4">
              <div className="text-2xl font-bold text-text">{stats.total}</div>
              <div className="text-xs text-subtext">{t("totalFavorites", lang)}</div>
            </div>
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.learning}</div>
              <div className="text-xs text-subtext">{t("learningStatus", lang)}</div>
            </div>
            <div className="rounded-xl border-[0.5px] border-border bg-panel p-4">
              <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
              <div className="text-xs text-subtext">{t("masteredStatus", lang)}</div>
            </div>
          </div>

          {/* Stale Reminder */}
          {showStaleReminder && stats.stale > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4">
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

          {/* Filter Tabs */}
          {favorites.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
              {[
                { key: 'all', label: `${t("all", lang)} (${stats.total})` },
                { key: 'unread', label: `${t("unreadStatus", lang)} (${stats.unread})` },
                { key: 'learning', label: `${t("learningStatus", lang)} (${stats.learning})` },
                { key: 'mastered', label: `${t("masteredStatus", lang)} (${stats.mastered})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    filter === key
                      ? 'bg-primary text-white'
                      : 'bg-surface text-subtext hover:bg-bg'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Favorites List */}
          {filteredFavorites.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtext">{t("noFavorites", lang)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Unread Section */}
              {stats.unread > 0 && (
                <FavoritesSection
                  title={
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                      {t("unreadStatus", lang)}
                    </span>
                  }
                  count={stats.unread}
                  items={favorites.filter(f => f.learning_status === 'unread')}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleFavorite={handleToggleFavorite}
                  lang={lang}
                  pendingRemovals={pendingRemovals}
                />
              )}

              {/* Learning Section */}
              {stats.learning > 0 && (
                <FavoritesSection
                  title={
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      {t("learningStatus", lang)}
                    </span>
                  }
                  count={stats.learning}
                  items={favorites.filter(f => f.learning_status === 'learning')}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleFavorite={handleToggleFavorite}
                  showMasterButton
                  lang={lang}
                  pendingRemovals={pendingRemovals}
                />
              )}

              {/* Mastered Section */}
              {stats.mastered > 0 && (
                <FavoritesSection
                  title={
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {t("masteredStatus", lang)}
                    </span>
                  }
                  count={stats.mastered}
                  items={favorites.filter(f => f.learning_status === 'mastered')}
                  onUpdateStatus={handleUpdateStatus}
                  onToggleFavorite={handleToggleFavorite}
                  lang={lang}
                  pendingRemovals={pendingRemovals}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <SettingsTab lang={lang} sessionUser={sessionUser} />
      )}
    </div>
  );
}

interface FavoritesSectionProps {
  title: React.ReactNode;
  count: number;
  items: FavoriteItem[];
  onUpdateStatus: (faqId: number, status: 'learning' | 'mastered') => void;
  onToggleFavorite: (faqId: number) => void;
  showMasterButton?: boolean;
  lang: "zh" | "en";
  pendingRemovals: Set<number>;
}

function FavoritesSection({ title, count, items, onUpdateStatus, onToggleFavorite, showMasterButton, lang, pendingRemovals }: FavoritesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-3">
      {/* Section Header with title and count on same line */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          {title}
          <span className="text-sm text-subtext">({count})</span>
        </div>
        <span className="text-subtext">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="space-y-3">
          {items.map(item => (
            <FavoriteCard
              key={item.faq_id}
              item={item}
              lang={lang}
              onUpdateStatus={onUpdateStatus}
              onToggleFavorite={onToggleFavorite}
              showMasterButton={showMasterButton}
              isPending={pendingRemovals.has(item.faq_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsTabProps {
  lang: "zh" | "en";
  sessionUser?: { id?: string; name?: string | null; image?: string | null } | null;
}

function SettingsTab({ lang, sessionUser }: SettingsTabProps) {
  // Load settings from localStorage
  const [settings, setSettings] = useState({
    lang: (typeof window !== 'undefined' ? localStorage.getItem('aifaq-lang') : null) as "zh" | "en" || lang,
    pageSize: Number(typeof window !== 'undefined' ? localStorage.getItem('aifaq-pageSize') : null) || 20,
    defaultDetailed: (typeof window !== 'undefined' ? localStorage.getItem('aifaq-defaultDetailed') : null) === 'true',
  });

  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: typeof settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    localStorage.setItem(`aifaq-${key}`, String(value));
  };

  return (
    <div className="space-y-6">
      {/* Account Info */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("accountInfo", lang)}
        </h2>
        <div className="flex items-center gap-4">
          {sessionUser?.image && (
            <img
              src={sessionUser.image}
              alt=""
              className="h-16 w-16 rounded-full"
            />
          )}
          <div>
            <div className="font-medium text-text">{sessionUser?.name || '-'}</div>
            <div className="text-sm text-subtext">ID: {sessionUser?.id?.slice(-8) || '-'}</div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-brand text-lg font-semibold text-text">
          {t("preferences", lang)}
        </h2>
        <div className="space-y-4">
          {/* Language */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("language", lang) || "语言 / Language"}
            </label>
            <div className="flex gap-2">
              {(['zh', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => updateSetting('lang', l)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.lang === l
                      ? 'bg-primary text-white'
                      : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                  }`}
                >
                  {l === 'zh' ? '中文' : 'EN'}
                </button>
              ))}
            </div>
          </div>

          {/* Page Size */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultPageSize", lang)}
            </label>
            <div className="flex gap-2">
              {[10, 20, 50, 100].map((size) => (
                <button
                  key={size}
                  onClick={() => updateSetting('pageSize', size)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    settings.pageSize === size
                      ? 'bg-primary text-white'
                      : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Default View Mode */}
          <div>
            <label className="mb-2 block text-sm font-medium text-subtext">
              {t("defaultViewMode", lang)}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => updateSetting('defaultDetailed', false)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  !settings.defaultDetailed
                    ? 'bg-primary text-white'
                    : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                }`}
              >
                {t("brief", lang)}
              </button>
              <button
                onClick={() => updateSetting('defaultDetailed', true)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  settings.defaultDetailed
                    ? 'bg-primary text-white'
                    : 'border-[0.5px] border-border text-subtext hover:bg-surface'
                }`}
              >
                {t("detailed", lang)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
