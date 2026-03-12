import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("FAQ list no longer imports legacy tag taxonomy", () => {
  const source = fs.readFileSync("components/FAQList.tsx", "utf8");
  assert.equal(source.includes("tag-taxonomy.json"), false);
});

test("Tag filter no longer imports legacy tag taxonomy types", () => {
  const source = fs.readFileSync("components/TagFilter.tsx", "utf8");
  assert.equal(source.includes("TagTaxonomy"), false);
});

test("taxonomy UI uses canonical taxonomy helpers", () => {
  const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
  const tagFilter = fs.readFileSync("components/TagFilter.tsx", "utf8");
  const faqItem = fs.readFileSync("components/FAQItem.tsx", "utf8");

  assert.equal(faqList.includes("getPrimaryCategoryOptions"), true);
  assert.equal(tagFilter.includes("getPrimaryCategoryLabel"), true);
  assert.equal(faqItem.includes("getPrimaryCategoryLabel"), true);
});

test("public taxonomy UI no longer exposes legacy tag filters or tag pills", () => {
  const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
  const tagFilter = fs.readFileSync("components/TagFilter.tsx", "utf8");
  const faqItem = fs.readFileSync("components/FAQItem.tsx", "utf8");
  const detailModal = fs.readFileSync("components/DetailModal.tsx", "utf8");
  const favoriteCard = fs.readFileSync("components/FavoriteCard.tsx", "utf8");
  const readingView = fs.readFileSync("components/ReadingView.tsx", "utf8");
  const searchBar = fs.readFileSync("components/SearchBar.tsx", "utf8");
  const faqDetailClient = fs.readFileSync("app/faq/[id]/FAQDetailClient.tsx", "utf8");

  assert.equal(faqList.includes("selectedTags"), false);
  assert.equal(faqList.includes("allTags"), false);
  assert.equal(tagFilter.includes("Leaf Tags"), false);
  assert.equal(searchBar.includes('"tag"'), false);
  assert.equal(faqItem.includes("translateTag"), false);
  assert.equal(detailModal.includes("translateTag"), false);
  assert.equal(favoriteCard.includes("translateTag"), false);
  assert.equal(readingView.includes("translateTag"), false);
  assert.equal(faqDetailClient.includes("faq.tags.map"), false);
});

test("admin review UI no longer foregrounds legacy tags", () => {
  const reviewPage = fs.readFileSync("app/admin/review/page.tsx", "utf8");

  assert.equal(reviewPage.includes("tags.length"), false);
  assert.equal(reviewPage.includes("selectedItem.tags"), false);
  assert.equal(reviewPage.includes("新标签体系"), true);
});
