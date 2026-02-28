"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import FAQList from "@/components/FAQList";
import DetailModal from "@/components/DetailModal";
import type { FAQItem, VoteType } from "@/src/types/faq";

const LS_VOTED = "aifaq-voted";

function loadVotedMap(): Map<number, VoteType> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_VOTED);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, VoteType>;
      const map = new Map<number, VoteType>();
      for (const [k, v] of Object.entries(obj)) {
        map.set(Number(k), v);
      }
      return map;
    }
  } catch { /* ignore */ }
  return new Map();
}

function saveVotedMap(map: Map<number, VoteType>): void {
  const obj: Record<string, VoteType> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  localStorage.setItem(LS_VOTED, JSON.stringify(obj));
}

interface FAQPageProps {
  items: FAQItem[];
}

export default function FAQPage({ items }: FAQPageProps) {
  // Shared state — owned here so both FAQList and DetailModal can use it
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [votedMap, setVotedMap] = useState<Map<number, VoteType>>(loadVotedMap);
  const [fingerprint, setFingerprint] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<FAQItem | null>(null);

  // Refs for stable vote callbacks
  const votedMapRef = useRef(votedMap);
  const fingerprintRef = useRef(fingerprint);
  useEffect(() => { votedMapRef.current = votedMap; }, [votedMap]);
  useEffect(() => { fingerprintRef.current = fingerprint; }, [fingerprint]);

  // Load fingerprint on mount
  useEffect(() => {
    import("@fingerprintjs/fingerprintjs").then((FP) =>
      FP.load().then((fp) =>
        fp.get().then((r) => setFingerprint(r.visitorId))
      )
    );
  }, []);

  // Restore votes from server when fingerprint is available
  useEffect(() => {
    if (!fingerprint) return;
    fetch(`/api/faq/votes?fingerprint=${fingerprint}`)
      .then((res) => res.ok ? res.json() : null)
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
      .catch(() => { /* network error, use localStorage fallback */ });
  }, [fingerprint]);

  // --- Vote handlers (stable via refs) ---
  const handleVote = useCallback(
    async (faqId: number, type: VoteType, reason?: string, detail?: string) => {
      const fp = fingerprintRef.current;
      if (!fp) return;
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
          body: JSON.stringify({ type, fingerprint: fp, reason, detail }),
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
    []
  );

  const handleRevokeVote = useCallback(
    async (faqId: number) => {
      const fp = fingerprintRef.current;
      if (!fp) return;
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
          body: JSON.stringify({ fingerprint: fp }),
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
    []
  );

  // --- Modal handlers ---
  const handleOpenItem = useCallback((item: FAQItem) => {
    flushSync(() => {
      setIsModalOpen(true);
    });
    setModalItem(item);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setModalItem(null), 100);
  }, []);

  // Modal-specific vote wrappers (bind faqId from modalItem)
  const handleModalVote = useCallback(
    (type: VoteType, reason?: string, detail?: string) => {
      if (modalItem) handleVote(modalItem.id, type, reason, detail);
    },
    [modalItem, handleVote]
  );

  const handleModalRevokeVote = useCallback(() => {
    if (modalItem) handleRevokeVote(modalItem.id);
  }, [modalItem, handleRevokeVote]);

  const modalCurrentVote = modalItem ? (votedMap.get(modalItem.id) ?? null) : null;

  return (
    <>
      <FAQList
        items={items}
        lang={lang}
        onLangChange={setLang}
        votedMap={votedMap}
        onVote={handleVote}
        onRevokeVote={handleRevokeVote}
        onOpenItem={handleOpenItem}
      />

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
      />
    </>
  );
}