import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const favoriteRoute = fs.readFileSync("app/api/faq/[id]/favorite/route.ts", "utf8");
const voteRoute = fs.readFileSync("app/api/faq/[id]/vote/route.ts", "utf8");
const statusRoute = fs.readFileSync("app/api/favorites/[id]/status/route.ts", "utf8");
const userFavoritesRoute = fs.readFileSync("app/api/user/favorites/route.ts", "utf8");
const profilePage = fs.readFileSync("app/profile/page.tsx", "utf8");

test("favorite route enforces FAQ level access before toggling", () => {
  assert.match(favoriteRoute, /canAccessFaqLevel\(/);
  assert.match(favoriteRoute, /getFaqItemById\(/);
  assert.match(favoriteRoute, /status:\s*403/);
});

test("vote route enforces FAQ level access", () => {
  assert.match(voteRoute, /canAccessFaqLevel\(/);
  assert.match(voteRoute, /getFaqItemById\(/);
  assert.match(voteRoute, /status:\s*403/);
});

test("favorite status update route enforces FAQ level access", () => {
  assert.match(statusRoute, /canAccessFaqLevel\(/);
  assert.match(statusRoute, /getFaqItemById\(/);
  assert.match(statusRoute, /status:\s*403/);
});

test("user favorites API constrains FAQ query by allowed levels", () => {
  assert.match(userFavoritesRoute, /resolveAllowedLevels\(/);
  assert.match(userFavoritesRoute, /fi\.level\s*=\s*ANY\(/);
});

test("profile page constrains favorites query by allowed levels", () => {
  assert.match(profilePage, /resolveAllowedLevels\(/);
  assert.match(profilePage, /fi\.level\s*=\s*ANY\(/);
});
