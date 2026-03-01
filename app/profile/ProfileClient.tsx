"use client";

import { useState } from "react";
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
}

export default function ProfileClient({ favorites, stats }: ProfileClientProps) {
  const [showStaleReminder, setShowStaleReminder] = useState(stats.stale > 0);

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
      {/* Header */}
      <div>
        <h1 className="font-brand text-3xl font-bold text-text">我的学习</h1>
        <p className="mt-1 text-sm text-subtext">追踪你的学习进度</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-text">{stats.total}</div>
          <div className="text-xs text-subtext">总收藏</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.learning}</div>
          <div className="text-xs text-subtext">学习中</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
          <div className="text-xs text-subtext">已内化</div>
        </div>
      </div>

      {/* Stale Reminder */}
      {showStaleReminder && stats.stale > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-600">⚠️</span>
            <span className="text-sm text-amber-900">
              你有 {stats.stale} 个收藏超过90天未查看，建议删除
            </span>
          </div>
          <button
            onClick={() => setShowStaleReminder(false)}
            className="text-xs text-amber-600 hover:text-amber-800"
          >
            忽略
          </button>
        </div>
      )}

      {/* Favorites List */}
      {favorites.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-subtext">开始收藏你感兴趣的 FAQ 吧！</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Unread Section */}
          {stats.unread > 0 && (
            <FavoritesSection
              title="📚 未看"
              count={stats.unread}
              items={favorites.filter(f => f.learning_status === 'unread')}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {/* Learning Section */}
          {stats.learning > 0 && (
            <FavoritesSection
              title="📖 学习中"
              count={stats.learning}
              items={favorites.filter(f => f.learning_status === 'learning')}
              onUpdateStatus={handleUpdateStatus}
              showMasterButton
            />
          )}

          {/* Mastered Section */}
          {stats.mastered > 0 && (
            <FavoritesSection
              title="✅ 已内化"
              count={stats.mastered}
              items={favorites.filter(f => f.learning_status === 'mastered')}
              onUpdateStatus={handleUpdateStatus}
            />
          )}
        </div>
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
}

function FavoritesSection({ title, count, items, onUpdateStatus, showMasterButton }: FavoritesSectionProps) {
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
                  标记为已内化
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
