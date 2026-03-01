"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { FAQItem } from "@/src/types/faq";

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
}

export default function ProfileClient({ favorites, stats, lang }: ProfileClientProps) {
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
          <h1 className="font-brand text-3xl font-bold text-text">AIFAQ</h1>
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
                <span className="text-amber-600">⚠️</span>
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
                  title={`📚 ${t("unreadStatus", lang)}`}
                  count={stats.unread}
                  items={favorites.filter(f => f.learning_status === 'unread')}
                  onUpdateStatus={handleUpdateStatus}
                  lang={lang}
                />
              )}

              {/* Learning Section */}
              {stats.learning > 0 && (
                <FavoritesSection
                  title={`📖 ${t("learningStatus", lang)}`}
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
                  title={`✅ ${t("masteredStatus", lang)}`}
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
        <SettingsTab lang={lang} />
      )}
    </div>
  );
}

interface FavoritesSectionProps {
  title: string;
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
              <a
                href={`/faq/${item.faq_id}`}
                className="flex-1 text-sm text-text hover:text-primary"
              >
                {item.faq.question}
              </a>
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
}

function SettingsTab({ lang }: SettingsTabProps) {
  return (
    <div className="space-y-6">
      <p className="text-subtext">Settings content coming soon...</p>
    </div>
  );
}
