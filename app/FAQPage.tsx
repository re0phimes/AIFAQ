"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import type { Session } from "next-auth";
import { SessionProvider, useSession, signIn, signOut } from "next-auth/react";
import FAQList from "@/components/FAQList";
import DetailModal from "@/components/DetailModal";
import { useActionDialog } from "@/components/useActionDialog";
import type { FAQItem, VoteType } from "@/src/types/faq";
import {
  buildConflictKey,
  buildPrefsHash,
  finalizeSyncMeta,
  shouldPromptImport,
  type PreferenceSyncMeta,
  type UserPreferencesSnapshot,
} from "@/lib/preferences-sync";
import { expandPrimaryCategoryKeys } from "@/lib/taxonomy";
import { t } from "@/lib/i18n";

const LS_VOTED = "aifaq-voted";
const LS_PREFS = "aifaq-prefs-v2";
const LS_PREFS_SYNC = "aifaq-prefs-sync-v2";

interface LocalPreferences {
  language?: "zh" | "en";
  pageSize?: number;
  defaultDetailed?: boolean;
  focusCategories: string[];
  updatedAt: string;
}

interface ServerPreferencesResponse {
  language: "zh" | "en" | null;
  page_size: number | null;
  default_detailed: boolean | null;
  focus_categories: string[];
  updated_at: string | null;
}

function loadVotedMap(): Map<number, VoteType> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(LS_VOTED);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, VoteType>;
      const map = new Map<number, VoteType>();
      for (const [k, v] of Object.entries(obj)) map.set(Number(k), v);
      return map;
    }
  } catch {
    // ignore
  }
  return new Map();
}

function saveVotedMap(map: Map<number, VoteType>): void {
  const obj: Record<string, VoteType> = {};
  for (const [k, v] of map) obj[String(k)] = v;
  localStorage.setItem(LS_VOTED, JSON.stringify(obj));
}

function toSnapshot(prefs: LocalPreferences): UserPreferencesSnapshot {
  return {
    language: prefs.language,
    pageSize: prefs.pageSize,
    defaultDetailed: prefs.defaultDetailed,
    focusCategories: prefs.focusCategories,
    updatedAt: prefs.updatedAt,
  };
}

function normalizeFocusCategories(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const normalized = values
    .filter((item): item is string => typeof item === "string")
    .flatMap((item) => expandPrimaryCategoryKeys(item));
  return Array.from(new Set(normalized));
}

function saveLegacyPreferenceKeys(prefs: LocalPreferences): void {
  if (prefs.language) localStorage.setItem("aifaq-lang", prefs.language);
  if (prefs.pageSize !== undefined) {
    localStorage.setItem("aifaq-pageSize", String(prefs.pageSize));
    localStorage.setItem("aifaq-pagesize", String(prefs.pageSize));
  }
  if (prefs.defaultDetailed !== undefined) {
    const value = String(prefs.defaultDetailed);
    localStorage.setItem("aifaq-defaultDetailed", value);
    localStorage.setItem("aifaq-global-detailed", value);
  }
  localStorage.setItem("aifaq-focus-categories", JSON.stringify(prefs.focusCategories));
}

function saveLocalPreferences(prefs: LocalPreferences): void {
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
  saveLegacyPreferenceKeys(prefs);
}

function loadLocalPreferences(): LocalPreferences {
  if (typeof window === "undefined") {
    return { focusCategories: [], updatedAt: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(LS_PREFS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalPreferences>;
      return {
        language: parsed.language === "en" ? "en" : parsed.language === "zh" ? "zh" : undefined,
        pageSize: typeof parsed.pageSize === "number" ? parsed.pageSize : undefined,
        defaultDetailed:
          typeof parsed.defaultDetailed === "boolean" ? parsed.defaultDetailed : undefined,
        focusCategories: normalizeFocusCategories(parsed.focusCategories),
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      };
    }
  } catch {
    // ignore invalid json
  }

  const languageRaw = localStorage.getItem("aifaq-lang");
  const pageSizeRaw = localStorage.getItem("aifaq-pageSize") ?? localStorage.getItem("aifaq-pagesize");
  const defaultDetailedRaw =
    localStorage.getItem("aifaq-defaultDetailed") ?? localStorage.getItem("aifaq-global-detailed");
  const focusRaw = localStorage.getItem("aifaq-focus-categories");

  let focusCategories: string[] = [];
  try {
    if (focusRaw) {
      const parsed = JSON.parse(focusRaw) as unknown;
      focusCategories = normalizeFocusCategories(parsed);
    }
  } catch {
    // ignore
  }

  const migrated: LocalPreferences = {
    language: languageRaw === "en" ? "en" : languageRaw === "zh" ? "zh" : undefined,
    pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
    defaultDetailed: defaultDetailedRaw === null ? undefined : defaultDetailedRaw === "true",
    focusCategories,
    updatedAt: new Date().toISOString(),
  };

  saveLocalPreferences(migrated);
  return migrated;
}

function loadPreferenceSyncMeta(): PreferenceSyncMeta {
  if (typeof window === "undefined") {
    return {
      lastSyncedServerUpdatedAt: null,
      lastSyncedHash: null,
      dismissedConflictKey: null,
    };
  }
  try {
    const raw = localStorage.getItem(LS_PREFS_SYNC);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PreferenceSyncMeta>;
      return {
        lastSyncedServerUpdatedAt:
          typeof parsed.lastSyncedServerUpdatedAt === "string"
            ? parsed.lastSyncedServerUpdatedAt
            : null,
        lastSyncedHash: typeof parsed.lastSyncedHash === "string" ? parsed.lastSyncedHash : null,
        dismissedConflictKey:
          typeof parsed.dismissedConflictKey === "string" ? parsed.dismissedConflictKey : null,
      };
    }
  } catch {
    // ignore
  }
  return {
    lastSyncedServerUpdatedAt: null,
    lastSyncedHash: null,
    dismissedConflictKey: null,
  };
}

function savePreferenceSyncMeta(meta: PreferenceSyncMeta): void {
  localStorage.setItem(LS_PREFS_SYNC, JSON.stringify(meta));
}

function normalizeServerPreferences(data: ServerPreferencesResponse): LocalPreferences {
  return {
    language: data.language ?? undefined,
    pageSize: data.page_size ?? undefined,
    defaultDetailed: data.default_detailed ?? undefined,
    focusCategories: normalizeFocusCategories(data.focus_categories),
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

function hasMeaningfulLocalPreferences(prefs: LocalPreferences): boolean {
  return (
    prefs.language !== undefined ||
    prefs.pageSize !== undefined ||
    prefs.defaultDetailed !== undefined ||
    prefs.focusCategories.length > 0
  );
}

interface FAQPageProps {
  items: FAQItem[];
  initialSession?: Session | null;
}

interface FAQListSessionUser {
  id?: string;
  name?: string | null;
  image?: string | null;
  tier?: string;
  role?: string;
}

function FAQPageInner({ items }: FAQPageProps) {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<LocalPreferences>(() =>
    loadLocalPreferences()
  );
  const [lang, setLang] = useState<"zh" | "en">(
    preferences.language === "en" ? "en" : "zh"
  );
  const [votedMap, setVotedMap] = useState<Map<number, VoteType>>(loadVotedMap);
  const [fingerprint, setFingerprint] = useState("");
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const { showConfirm, dialogNode } = useActionDialog();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<FAQItem | null>(null);

  // Refs for stable callbacks
  const votedMapRef = useRef(votedMap);
  const fingerprintRef = useRef(fingerprint);
  const preferencesRef = useRef(preferences);
  const langRef = useRef(lang);
  const syncInFlightRef = useRef(false);
  const lastHandledConflictKeyRef = useRef<string | null>(null);
  useEffect(() => {
    votedMapRef.current = votedMap;
  }, [votedMap]);
  useEffect(() => {
    fingerprintRef.current = fingerprint;
  }, [fingerprint]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    lastHandledConflictKeyRef.current = null;
    syncInFlightRef.current = false;
  }, [session?.user?.id]);

  const applyPreferencesLocalOnly = useCallback((next: LocalPreferences) => {
    saveLocalPreferences(next);
    setPreferences(next);
    if (next.language) setLang(next.language);
  }, []);

  const patchRemotePreferences = useCallback(
    async (patch: {
      language?: "zh" | "en";
      page_size?: number;
      default_detailed?: boolean;
      focus_categories?: string[];
    }) => {
      if (!session?.user?.id) return null;
      if (Object.keys(patch).length === 0) return null;
      try {
        const res = await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return null;
        return normalizeServerPreferences((await res.json()) as ServerPreferencesResponse);
      } catch {
        return null;
      }
    },
    [session?.user?.id]
  );

  const updatePreferences = useCallback(
    async (
      patch: Partial<Pick<LocalPreferences, "language" | "pageSize" | "defaultDetailed" | "focusCategories">>,
      syncServer = true
    ) => {
      const current = preferencesRef.current;
      const next: LocalPreferences = {
        language: patch.language ?? current.language,
        pageSize: patch.pageSize ?? current.pageSize,
        defaultDetailed: patch.defaultDetailed ?? current.defaultDetailed,
        focusCategories:
          patch.focusCategories !== undefined
            ? normalizeFocusCategories(patch.focusCategories)
            : current.focusCategories,
        updatedAt: new Date().toISOString(),
      };
      applyPreferencesLocalOnly(next);

      if (!syncServer || !session?.user?.id) return;

      const remotePatch: {
        language?: "zh" | "en";
        page_size?: number;
        default_detailed?: boolean;
        focus_categories?: string[];
      } = {};
      if (patch.language !== undefined) remotePatch.language = patch.language;
      if (patch.pageSize !== undefined) remotePatch.page_size = patch.pageSize;
      if (patch.defaultDetailed !== undefined) remotePatch.default_detailed = patch.defaultDetailed;
      if (patch.focusCategories !== undefined) remotePatch.focus_categories = next.focusCategories;

      const syncedPrefs = await patchRemotePreferences(remotePatch);
      if (syncedPrefs) {
        applyPreferencesLocalOnly(syncedPrefs);
        savePreferenceSyncMeta(
          finalizeSyncMeta({
            previous: loadPreferenceSyncMeta(),
            serverUpdatedAt: syncedPrefs.updatedAt,
            serverHash: buildPrefsHash(toSnapshot(syncedPrefs)),
            dismissedConflictKey: null,
          })
        );
      }
    },
    [applyPreferencesLocalOnly, patchRemotePreferences, session?.user?.id]
  );

  // Load fingerprint on mount (only needed for anonymous users)
  useEffect(() => {
    if (session?.user) return; // logged-in users don't need fingerprint
    import("@fingerprintjs/fingerprintjs").then((FP) =>
      FP.load().then((fp) => fp.get().then((r) => setFingerprint(r.visitorId)))
    );
  }, [session]);

  // Restore votes from server when fingerprint is available
  useEffect(() => {
    if (!fingerprint) return;
    fetch(`/api/faq/votes?fingerprint=${fingerprint}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Record<string, string> | null) => {
        if (!data) return;
        const map = new Map<number, VoteType>();
        for (const [k, v] of Object.entries(data)) {
          if (v === "upvote" || v === "downvote") map.set(Number(k), v as VoteType);
        }
        setVotedMap(map);
        saveVotedMap(map);
      })
      .catch(() => {
        // network error, use localStorage fallback
      });
  }, [fingerprint]);

  // Load favorites when logged in
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/favorites")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!Array.isArray(data?.favorites)) return;
        const ids = data.favorites
          .map((entry: unknown) => {
            if (typeof entry === "number") return entry;
            if (entry && typeof entry === "object" && "faq_id" in entry) {
              const faqId = (entry as { faq_id: unknown }).faq_id;
              return typeof faqId === "number" ? faqId : null;
            }
            return null;
          })
          .filter((id: number | null): id is number => id !== null);
        setFavorites(new Set(ids));
      })
      .catch(() => {});
  }, [session]);

  // Login sync: DB is source-of-truth, with optional local import
  useEffect(() => {
    if (!session?.user?.id) return;

    const run = async (): Promise<void> => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        const requestStartLocalHash = buildPrefsHash(toSnapshot(preferencesRef.current));
        const res = await fetch("/api/user/preferences");
        if (!res.ok) return;
        const data = (await res.json()) as ServerPreferencesResponse;
        const serverPrefs = normalizeServerPreferences(data);
        const serverHash = buildPrefsHash(toSnapshot(serverPrefs));
        const syncMeta = loadPreferenceSyncMeta();
        const currentLocalPrefs = preferencesRef.current;
        const currentLocalHash = buildPrefsHash(toSnapshot(currentLocalPrefs));

        if (currentLocalHash !== requestStartLocalHash) {
          if (currentLocalHash === serverHash) {
            applyPreferencesLocalOnly(serverPrefs);
            savePreferenceSyncMeta(
              finalizeSyncMeta({
                previous: syncMeta,
                serverUpdatedAt: serverPrefs.updatedAt,
                serverHash,
                dismissedConflictKey: null,
              })
            );
            return;
          }

          const syncedCurrentPrefs = await patchRemotePreferences({
            language: currentLocalPrefs.language,
            page_size: currentLocalPrefs.pageSize,
            default_detailed: currentLocalPrefs.defaultDetailed,
            focus_categories: currentLocalPrefs.focusCategories,
          });

          if (syncedCurrentPrefs) {
            applyPreferencesLocalOnly(syncedCurrentPrefs);
            savePreferenceSyncMeta(
              finalizeSyncMeta({
                previous: syncMeta,
                serverUpdatedAt: syncedCurrentPrefs.updatedAt,
                serverHash: buildPrefsHash(toSnapshot(syncedCurrentPrefs)),
                dismissedConflictKey: null,
              })
            );
          }
          return;
        }

        const localPrefs = currentLocalPrefs;
        const localHash = currentLocalHash;
        const hasLocalPrefs = hasMeaningfulLocalPreferences(localPrefs);
        const localHasUnsyncedChanges =
          hasLocalPrefs && (syncMeta.lastSyncedHash === null || syncMeta.lastSyncedHash !== localHash);

        const prompt = shouldPromptImport({
          userId: session.user.id,
          hasLocalPrefs,
          localHash,
          serverHash,
          localHasUnsyncedChanges,
          dismissedConflictKey: syncMeta.dismissedConflictKey,
        });

        const conflictKey = prompt ? buildConflictKey(session.user.id, localHash, serverHash) : null;
        const shouldShowPrompt = conflictKey !== null && conflictKey !== lastHandledConflictKeyRef.current;

        let accepted = false;
        if (shouldShowPrompt) {
          const currentLang = langRef.current;
          const confirmText =
            currentLang === "zh"
              ? "检测到你本地有未同步偏好，是否导入到账号？"
              : "Unsynced local preferences detected. Import them to your account?";
          accepted = await showConfirm({
            title: t("syncPromptTitle", currentLang),
            message: confirmText,
            confirmText: t("confirm", currentLang),
            cancelText: t("cancel", currentLang),
          });
          lastHandledConflictKeyRef.current = conflictKey;
          if (accepted) {
            const importRes = await fetch("/api/user/preferences/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                snapshot: {
                  language: localPrefs.language ?? null,
                  page_size: localPrefs.pageSize ?? null,
                  default_detailed: localPrefs.defaultDetailed ?? null,
                  focus_categories: localPrefs.focusCategories ?? [],
                  updated_at: localPrefs.updatedAt,
                },
              }),
            });
            if (importRes.ok) {
              const imported = normalizeServerPreferences(
                (await importRes.json()) as ServerPreferencesResponse
              );
              applyPreferencesLocalOnly(imported);
              savePreferenceSyncMeta(
                finalizeSyncMeta({
                  previous: syncMeta,
                  serverUpdatedAt: imported.updatedAt,
                  serverHash: buildPrefsHash(toSnapshot(imported)),
                  dismissedConflictKey: null,
                })
              );
              return;
            }
          }
        }

        const dismissedConflictKey = shouldShowPrompt && !accepted ? conflictKey : undefined;

        applyPreferencesLocalOnly(serverPrefs);
        savePreferenceSyncMeta(
          finalizeSyncMeta({
            previous: syncMeta,
            serverUpdatedAt: serverPrefs.updatedAt,
            serverHash,
            dismissedConflictKey,
          })
        );
      } finally {
        syncInFlightRef.current = false;
      }
    };

    void run();
  }, [applyPreferencesLocalOnly, patchRemotePreferences, session?.user?.id, showConfirm]);

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

  const handleModalVote = useCallback(
    (type: VoteType, reason?: string, detail?: string) => {
      if (modalItem) handleVote(modalItem.id, type, reason, detail);
    },
    [modalItem, handleVote]
  );

  const handleModalRevokeVote = useCallback(() => {
    if (modalItem) handleRevokeVote(modalItem.id);
  }, [modalItem, handleRevokeVote]);

  const handleLanguageChange = useCallback(
    (nextLang: "zh" | "en") => {
      setLang(nextLang);
      void updatePreferences({ language: nextLang }, true);
    },
    [updatePreferences]
  );

  const handleListPreferenceChange = useCallback(
    (patch: { pageSize?: number; defaultDetailed?: boolean }) => {
      const nextPatch: Partial<LocalPreferences> = {};
      if (patch.pageSize !== undefined && patch.pageSize !== preferencesRef.current.pageSize) {
        nextPatch.pageSize = patch.pageSize;
      }
      if (
        patch.defaultDetailed !== undefined &&
        patch.defaultDetailed !== preferencesRef.current.defaultDetailed
      ) {
        nextPatch.defaultDetailed = patch.defaultDetailed;
      }
      if (Object.keys(nextPatch).length > 0) {
        void updatePreferences(nextPatch, true);
      }
    },
    [updatePreferences]
  );

  const handleGlobalDetailedChange = useCallback(
    (value: boolean) => {
      if (value === preferencesRef.current.defaultDetailed) return;
      void updatePreferences({ defaultDetailed: value }, true);
    },
    [updatePreferences]
  );

  const handleFocusEmpty = useCallback(() => {
    if (session?.user?.id) {
      const confirmText =
        lang === "zh" ? "你还没有设置关注方向，去我的学习中设置？" : "No focus set yet. Go to My Learning to set it?";
      void showConfirm({
        title: t("focusNotSetTitle", lang),
        message: confirmText,
        confirmText: t("confirm", lang),
        cancelText: t("cancel", lang),
      }).then((accepted) => {
        if (accepted) window.location.href = "/profile";
      });
      return;
    }
    void signIn("github", { callbackUrl: "/profile" });
  }, [lang, session?.user?.id, showConfirm]);

  const modalCurrentVote = modalItem ? (votedMap.get(modalItem.id) ?? null) : null;
  const listSession: { user?: FAQListSessionUser } | null = session
    ? {
        user: {
          id: session.user?.id,
          name: session.user?.name ?? null,
          image: session.user?.image ?? null,
          tier: session.user?.tier,
          role: session.user?.role,
        },
      }
    : null;

  return (
    <>
      <FAQList
        items={items}
        lang={lang}
        onLangChange={handleLanguageChange}
        votedMap={votedMap}
        onVote={handleVote}
        onRevokeVote={handleRevokeVote}
        onOpenItem={handleOpenItem}
        session={listSession}
        authStatus={status}
        onSignIn={() => signIn("github")}
        onSignOut={() => signOut()}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        focusCategories={preferences.focusCategories}
        onFocusEmpty={handleFocusEmpty}
        initialPageSize={preferences.pageSize}
        globalDetailed={preferences.defaultDetailed ?? false}
        onGlobalDetailedChange={(value) => {
          handleGlobalDetailedChange(value);
        }}
        onPreferenceChange={handleListPreferenceChange}
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
        isFavorited={modalItem ? favorites.has(modalItem.id) : false}
        onToggleFavorite={() => modalItem && handleToggleFavorite(modalItem.id)}
        isAuthenticated={!!session?.user}
      />

      {dialogNode}
    </>
  );
}

export default function FAQPage({ items, initialSession }: FAQPageProps) {
  return (
    <SessionProvider session={initialSession}>
      <FAQPageInner items={items} />
    </SessionProvider>
  );
}
