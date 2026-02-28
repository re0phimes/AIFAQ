"use client";

import { useState, useCallback } from "react";
import { flushSync } from "react-dom";
import FAQList from "@/components/FAQList";
import DetailModal from "@/components/DetailModal";
import type { FAQItem, VoteType } from "@/src/types/faq";

interface FAQPageProps {
  items: FAQItem[];
}

export default function FAQPage({ items }: FAQPageProps) {
  // Modal state - separated from FAQList to prevent list re-renders
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<FAQItem | null>(null);

  const handleOpenItem = useCallback((item: FAQItem) => {
    // 强制立即显示 Modal 骨架屏
    flushSync(() => {
      setIsModalOpen(true);
    });
    // 异步加载内容
    setModalItem(item);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // 延迟清理，保留 exit animation
    setTimeout(() => setModalItem(null), 100);
  }, []);

  return (
    <>
      <FAQList
        items={items}
        onOpenItem={handleOpenItem}
      />

      <DetailModal
        item={modalItem}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        lang="zh"
        onVote={(type, reason, detail) => {
          if (modalItem) {
            // TODO: 需要与 FAQList 中的投票状态同步
            console.log("Vote:", modalItem.id, type, reason, detail);
          }
        }}
        onRevokeVote={() => {
          if (modalItem) {
            console.log("Revoke vote:", modalItem.id);
          }
        }}
        currentVote={null}
        upvoteCount={modalItem?.upvoteCount}
        downvoteCount={modalItem?.downvoteCount}
      />
    </>
  );
}
