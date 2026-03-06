import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const homePage = fs.readFileSync("app/page.tsx", "utf8");
const faqPage = fs.readFileSync("app/FAQPage.tsx", "utf8");
const faqList = fs.readFileSync("components/FAQList.tsx", "utf8");
const adminLayout = fs.readFileSync("app/admin/layout.tsx", "utf8");

let adminClient = "";
try {
  adminClient = fs.readFileSync("app/admin/AdminLayoutClient.tsx", "utf8");
} catch {
  adminClient = "";
}

test("home page forwards the server session into FAQPage", () => {
  assert.match(homePage, /<FAQPage items=\{items\} initialSession=\{session\} \/>/);
});

test("FAQPage seeds SessionProvider with the initial session", () => {
  assert.match(faqPage, /initialSession\?: Session \| null/);
  assert.match(faqPage, /<SessionProvider session=\{initialSession\}>/);
});

test("FAQPage reads both session data and auth status from useSession", () => {
  assert.match(faqPage, /const \{ data: session, status \} = useSession\(\);/);
});

test("FAQList treats auth loading as a neutral state instead of guest UI", () => {
  assert.match(faqList, /authStatus\?: "loading" \| "authenticated" \| "unauthenticated"/);
  assert.match(faqList, /authStatus === "loading"/);
});

test("admin layout is server-backed and passes initial session into a client wrapper", () => {
  assert.match(adminLayout, /const session = await getServerSession\(\);/);
  assert.match(adminLayout, /<AdminLayoutClient initialSession=\{session\}>/);
  assert.match(adminClient, /<SessionProvider session=\{initialSession\}>/);
});