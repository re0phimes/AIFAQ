import test from "node:test";
import assert from "node:assert/strict";
import { preprocessMarkdown } from "./markdown-content";

test("preprocessMarkdown converts LaTeX inline and display delimiters", () => {
  const input = [
    "Inline: \\(a+b\\)",
    "",
    "\\[",
    "x = y + z",
    "\\]"
  ].join("\n");

  const output = preprocessMarkdown(input);

  assert.equal(output.includes("Inline: $a+b$"), true);
  assert.equal(output.includes("$$\nx = y + z\n$$"), true);
});

test("preprocessMarkdown folds cite tags into readable inline references", () => {
  const input = "结论[cite:ref-2 Eq.(8)][cite:ref-2 §3.1][cite:ref-2 §3.2]";

  const output = preprocessMarkdown(input);

  assert.equal(output, "结论 (ref-2 Eq.(8); ref-2 §3.1; ref-2 §3.2)");
});

test("preprocessMarkdown does not rewrite fenced or inline code", () => {
  const input = [
    "Code span: `\\(a+b\\)` and text \\(c+d\\)",
    "",
    "```md",
    "[cite:ref-1 Eq.(3)]",
    "\\(e+f\\)",
    "```"
  ].join("\n");

  const output = preprocessMarkdown(input);

  assert.equal(output.includes("`\\(a+b\\)`"), true);
  assert.equal(output.includes("text $c+d$"), true);
  assert.equal(output.includes("[cite:ref-1 Eq.(3)]"), true);
  assert.equal(output.includes("\\(e+f\\)"), true);
});
