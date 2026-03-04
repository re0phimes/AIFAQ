import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const readingViewPath = "components/ReadingView.tsx";

function readRequiredFile(filePath: string): string {
  assert.ok(fs.existsSync(filePath), `Missing required file: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

test("ReadingView print action defers native print to next paint and guards duplicate clicks", () => {
  const source = readRequiredFile(readingViewPath);

  assert.match(source, /const \[isPreparingPrint,\s*setIsPreparingPrint\] = useState\(false\)/);
  assert.match(source, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*window\.requestAnimationFrame\(/);
  assert.match(source, /window\.print\(\)/);
  assert.match(source, /disabled=\{isPreparingPrint\}/);
});
