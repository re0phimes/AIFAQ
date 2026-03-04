import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const galleryPath = "components/ImageGallery.tsx";
const lightboxPath = "components/ImageLightbox.tsx";

function readRequiredFile(filePath: string): string {
  assert.ok(fs.existsSync(filePath), `Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

test("ImageGallery provides responsive 3-up/1-up layout and hover lift", () => {
  const source = readRequiredFile(galleryPath);
  assert.match(source, /basis-full/);
  assert.match(source, /md:basis-1\/3/);
  assert.match(source, /hover:scale/);
  assert.match(source, /hover:shadow/);
});

test("ImageLightbox supports keyboard, touch, thumbnails and haptics", () => {
  const source = readRequiredFile(lightboxPath);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /Escape/);
  assert.match(source, /onTouchStart/);
  assert.match(source, /onTouchMove/);
  assert.match(source, /onTouchEnd/);
  assert.match(source, /navigator\.vibrate/);
  assert.match(source, /thumbnail|thumb/i);
});
