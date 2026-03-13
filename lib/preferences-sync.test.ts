import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConflictKey,
  buildPrefsHash,
  finalizeSyncMeta,
  mergePreferences,
  type PreferenceSyncMeta,
  shouldPromptImport,
  type UserPreferencesSnapshot,
} from "./preferences-sync";

const SERVER_OLD = "2026-03-03T00:00:00.000Z";
const LOCAL_NEW = "2026-03-03T01:00:00.000Z";

function snapshot(
  input: Partial<UserPreferencesSnapshot>
): UserPreferencesSnapshot {
  return {
    language: input.language,
    pageSize: input.pageSize,
    defaultDetailed: input.defaultDetailed,
    focusCategories: input.focusCategories ?? [],
    updatedAt: input.updatedAt ?? SERVER_OLD,
  };
}

test("mergePreferences unions and dedupes focus categories", () => {
  const merged = mergePreferences(
    snapshot({
      focusCategories: ["model_architecture", "post_training_alignment"],
      updatedAt: LOCAL_NEW,
    }),
    snapshot({
      focusCategories: ["model_architecture", "fundamentals"],
      updatedAt: SERVER_OLD,
    })
  );

  assert.deepEqual(merged.focusCategories.sort(), [
    "fundamentals",
    "model_architecture",
    "post_training_alignment",
  ].sort());
});

test("mergePreferences prefers newer scalar fields by updatedAt", () => {
  const merged = mergePreferences(
    snapshot({
      language: "en",
      pageSize: 50,
      defaultDetailed: true,
      updatedAt: LOCAL_NEW,
    }),
    snapshot({
      language: "zh",
      pageSize: 20,
      defaultDetailed: false,
      updatedAt: SERVER_OLD,
    })
  );

  assert.equal(merged.language, "en");
  assert.equal(merged.pageSize, 50);
  assert.equal(merged.defaultDetailed, true);
});

test("buildPrefsHash is stable regardless of focus category order", () => {
  const a = snapshot({
    language: "zh",
    pageSize: 20,
    defaultDetailed: false,
    focusCategories: ["model_architecture", "fundamentals"],
  });
  const b = snapshot({
    language: "zh",
    pageSize: 20,
    defaultDetailed: false,
    focusCategories: ["fundamentals", "model_architecture"],
  });

  assert.equal(buildPrefsHash(a), buildPrefsHash(b));
});

test("buildPrefsHash ignores updatedAt when preference content is the same", () => {
  const a = snapshot({
    language: "zh",
    pageSize: 20,
    defaultDetailed: false,
    focusCategories: ["model_architecture"],
    updatedAt: "2026-03-03T00:00:00.000Z",
  });
  const b = snapshot({
    language: "zh",
    pageSize: 20,
    defaultDetailed: false,
    focusCategories: ["model_architecture"],
    updatedAt: "2026-03-03T23:59:59.000Z",
  });

  assert.equal(buildPrefsHash(a), buildPrefsHash(b));
});

test("shouldPromptImport returns false when dismissed conflict is the same", () => {
  const localHash = "local1";
  const serverHash = "server1";
  const key = buildConflictKey("u1", localHash, serverHash);

  const should = shouldPromptImport({
    userId: "u1",
    hasLocalPrefs: true,
    localHash,
    serverHash,
    localHasUnsyncedChanges: true,
    dismissedConflictKey: key,
  });

  assert.equal(should, false);
});

test("shouldPromptImport returns true for new unsynced conflict", () => {
  const should = shouldPromptImport({
    userId: "u1",
    hasLocalPrefs: true,
    localHash: "local2",
    serverHash: "server2",
    localHasUnsyncedChanges: true,
    dismissedConflictKey: null,
  });

  assert.equal(should, true);
});

test("shouldPromptImport returns false when local has no unsynced changes", () => {
  const should = shouldPromptImport({
    userId: "u1",
    hasLocalPrefs: true,
    localHash: "local3",
    serverHash: "server3",
    localHasUnsyncedChanges: false,
    dismissedConflictKey: null,
  });

  assert.equal(should, false);
});

test("finalizeSyncMeta keeps newly dismissed conflict key", () => {
  const previous: PreferenceSyncMeta = {
    lastSyncedServerUpdatedAt: "2026-03-03T00:00:00.000Z",
    lastSyncedHash: "old-hash",
    dismissedConflictKey: null,
  };

  const next = finalizeSyncMeta({
    previous,
    serverUpdatedAt: "2026-03-04T00:00:00.000Z",
    serverHash: "server-new-hash",
    dismissedConflictKey: "u1:localA:server-new-hash",
  });

  assert.equal(next.dismissedConflictKey, "u1:localA:server-new-hash");
  assert.equal(next.lastSyncedHash, "server-new-hash");
  assert.equal(next.lastSyncedServerUpdatedAt, "2026-03-04T00:00:00.000Z");
});

test("finalizeSyncMeta falls back to previous dismissed key", () => {
  const previous: PreferenceSyncMeta = {
    lastSyncedServerUpdatedAt: "2026-03-03T00:00:00.000Z",
    lastSyncedHash: "old-hash",
    dismissedConflictKey: "u1:localA:server-old-hash",
  };

  const next = finalizeSyncMeta({
    previous,
    serverUpdatedAt: "2026-03-04T00:00:00.000Z",
    serverHash: "server-new-hash",
  });

  assert.equal(next.dismissedConflictKey, "u1:localA:server-old-hash");
  assert.equal(next.lastSyncedHash, "server-new-hash");
});

test("mergePreferences normalizes and drops invalid focus categories", () => {
  const merged = mergePreferences(
    snapshot({
      focusCategories: ["模型结构", "invalid-category", "fundamentals"],
      updatedAt: LOCAL_NEW,
    }),
    snapshot({
      focusCategories: ["基础概念", "model_architecture"],
      updatedAt: SERVER_OLD,
    })
  );

  assert.deepEqual(merged.focusCategories.sort(), [
    "fundamentals",
    "model_architecture",
  ]);
});

test("mergePreferences expands legacy retrieval-agent focus category into both new categories", () => {
  const merged = mergePreferences(
    snapshot({
      focusCategories: ["retrieval_agent_systems"],
      updatedAt: LOCAL_NEW,
    }),
    snapshot({
      focusCategories: [],
      updatedAt: SERVER_OLD,
    })
  );

  assert.deepEqual(merged.focusCategories.sort(), [
    "agent_systems",
    "retrieval_systems",
  ]);
});
