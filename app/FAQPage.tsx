"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
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

function FAQPageInner({ items }: FAQPageProps) {
  const { data: session } = useSession();
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [votedMap, setVotedMap] = useState<Map<number, VoteType>>(loadVotedMap);
  const [fingerprint, setFingerprint] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<FAQItem | null>(null);

  // Refs for stable vote callbacks
  const votedMapRef = useRef(votedMap);
  const fingerprintRef = useRef(fingerprint);
  useEffect(() => { votedMapRef.current = votedMap; }, [votedMap]);
  useEffect(() => { fingerprintRef.current = fingerprint; }, [fingerprint]);

  // Load fingerprint on mount (only needed for anonymous users)
  useEffect(() => {
    if (session?.user) return; // logged-in users don't need fingerprint
    import("@fingerprintjs/fingerprintjs").then((FP) =>
      FP.load().then((fp) =>
        fp.get().then((r) => setFingerprint(r.visitorId))
      )
    );
  }, [session]);

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

  // Load favorites when logged in
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/favorites")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.favorites) setFavorites(new Set(data.favorites));
      })
      .catch(() => {});
  }, [session]);

  // --- Vote handlers (stable via refs) ---
  const handleVote = useCallback(
    async (faqId: number, type: VoteType, reason?: string, detail?: string) => {
      const fp = fingerprintRef.current;
      if (!fp && !session?.user) return;
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
    [session]
  );

  const handleRevokeVote = useCallback(
    async (faqId: number) => {
      const fp = fingerprintRef.current;
      if (!fp && !session?.user) return;
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
    [session]
  );

  const handleToggleFavorite = useCallback(async (faqId: number) => {
    const res = await fetch(`/api/faq/${faqId}/favorite`, { method: "POST" });
    if (res.ok) {
      const { favorited } = await res.json();
      setFavorites((prev) => {
        const next = new Set(prev);
        if (favorited) next.add(faqId);
        else next.delete(faqId);
        return next;
      });
    }
  }, []);

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
        session={session}
        onSignIn={() => signIn("github")}
        onSignOut={() => signOut()}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
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

export default function FAQPage({ items }: FAQPageProps) {
  return (
    <SessionProvider>
      <FAQPageInner items={items} />
    </SessionProvider>
  );
}