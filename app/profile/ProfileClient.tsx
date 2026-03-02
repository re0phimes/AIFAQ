"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";

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

export default function ProfileClient({ favorites, stats, lang, sessionUser }: ProfileClientProps) {
  const [showStaleReminder, setShowStaleReminder] = useState(stats.stale > 0);
  const [activeTab, setActiveTab] = useState<'learning' | 'settings'>('learning');

  const handleUpdateStatus = async (faqId: number, status: 'learning' | 'mastered') => {
    try {
      const res = await fetch(`/api/favorites/${faqId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        window.location.reload(); // Simple refresh for now
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
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

      {activeTab === 'learning' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-2xl font-bold text-text">{stats.total}</div>
              <div className="text-xs text-subtext">{t("totalFavorites", lang)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.learning}</div>
              <div className="text-xs text-subtext">{t("learningStatus", lang)}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
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

          {/* Favorites List */}
          {favorites.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-subtext">{t("startCollecting", lang)}</p>
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
                  lang={lang}
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
                  showMasterButton
                  lang={lang}
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
                  lang={lang}
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
  showMasterButton?: boolean;
  lang: "zh" | "en";
}

function FavoritesSection({ title, count, items, onUpdateStatus, showMasterButton, lang }: FavoritesSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-bg"
      >
        <span className="font-medium text-text">
          {title} ({count})
        </span>
        <span className="text-subtext">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-2">
          {items.map(item => (
            <div key={item.faq_id} className="flex items-center justify-between py-2">
              <Link
                href={`/faq/${item.faq_id}`}
                className="flex-1 text-sm text-text hover:text-primary"
              >
                {item.faq.question}
              </Link>
              {showMasterButton && (
                <button
                  onClick={() => onUpdateStatus(item.faq_id, 'mastered')}
                  className="ml-4 rounded-full border border-green-500 px-3 py-1 text-xs text-green-600 hover:bg-green-50"
                >
                  {t("markAsMastered", lang)}
                </button>
              )}
            </div>
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
