import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("app/layout.tsx", "utf8");
const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
const globalsCss = fs.readFileSync("app/globals.css", "utf8");

test("layout defines media-based favicon icons", () => {
  assert.match(layout, /prefers-color-scheme: light/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(layout, /favicon-light\.svg/);
  assert.match(layout, /favicon-dark\.svg/);
});

test("layout injects early theme init script", () => {
  assert.match(layout, /buildThemeInitScript/);
  assert.match(layout, /dangerouslySetInnerHTML/);
});

test("FAQList uses BrandLogo and ThemeToggle", () => {
  assert.match(faqList, /BrandLogo/);
  assert.match(faqList, /ThemeToggle/);
});

test("FAQList keeps language switch controls", () => {
  assert.match(faqList, /onLangChange\("zh"\)/);
  assert.match(faqList, /onLangChange\("en"\)/);
});

test("globals.css defines dark theme token scope", () => {
  assert.match(globalsCss, /:root\[data-theme="dark"\]/);
  assert.match(globalsCss, /--color-bg:/);
  assert.match(globalsCss, /--color-text:/);
  assert.match(globalsCss, /--color-border:/);
});
