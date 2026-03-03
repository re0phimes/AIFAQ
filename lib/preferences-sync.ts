export type PreferenceLang = "zh" | "en";

export interface UserPreferencesSnapshot {
  language?: PreferenceLang;
  pageSize?: number;
  defaultDetailed?: boolean;
  focusCategories: string[];
  updatedAt: string;
}

export interface ShouldPromptImportInput {
  userId: string;
  hasLocalPrefs: boolean;
  localHash: string | null;
  serverHash: string | null;
  localHasUnsyncedChanges: boolean;
  dismissedConflictKey: string | null;
}

function parseUpdatedAt(value: string | undefined): number {
  if (!value) return 0;
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function dedupeCategories(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(new Set(values.filter(Boolean)));
}

function normalize(snapshot: Partial<UserPreferencesSnapshot>): UserPreferencesSnapshot {
  return {
    language: snapshot.language,
    pageSize: snapshot.pageSize,
    defaultDetailed: snapshot.defaultDetailed,
    focusCategories: dedupeCategories(snapshot.focusCategories).sort(),
    updatedAt: snapshot.updatedAt ?? new Date(0).toISOString(),
  };
}

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function buildPrefsHash(snapshot: Partial<UserPreferencesSnapshot>): string {
  const normalized = normalize(snapshot);
  return simpleHash(JSON.stringify(normalized));
}

export function buildConflictKey(userId: string, localHash: string, serverHash: string): string {
  return `${userId}:${localHash}:${serverHash}`;
}

export function shouldPromptImport(input: ShouldPromptImportInput): boolean {
  if (!input.hasLocalPrefs) return false;
  if (!input.localHash || !input.serverHash) return false;
  if (!input.localHasUnsyncedChanges) return false;
  if (input.localHash === input.serverHash) return false;

  const conflictKey = buildConflictKey(input.userId, input.localHash, input.serverHash);
  if (input.dismissedConflictKey === conflictKey) return false;
  return true;
}

export function mergePreferences(
  local: Partial<UserPreferencesSnapshot>,
  server: Partial<UserPreferencesSnapshot>
): UserPreferencesSnapshot {
  const localNormalized = normalize(local);
  const serverNormalized = normalize(server);

  const localTs = parseUpdatedAt(localNormalized.updatedAt);
  const serverTs = parseUpdatedAt(serverNormalized.updatedAt);
  const localWins = localTs >= serverTs;

  return {
    language: localWins ? localNormalized.language : serverNormalized.language,
    pageSize: localWins ? localNormalized.pageSize : serverNormalized.pageSize,
    defaultDetailed: localWins
      ? localNormalized.defaultDetailed
      : serverNormalized.defaultDetailed,
    focusCategories: dedupeCategories([
      ...localNormalized.focusCategories,
      ...serverNormalized.focusCategories,
    ]),
    updatedAt: localWins ? localNormalized.updatedAt : serverNormalized.updatedAt,
  };
}
