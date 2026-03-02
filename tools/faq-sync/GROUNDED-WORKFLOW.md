# Grounded FAQ Review Workflow

## Goal

Use text questions or image-extracted questions to generate grounded FAQ answers, then stage entries to Neon with `status=review` for human approval.

## Command

```bash
npm run faq:answer-and-stage -- --question "什么是Transformer中的自注意力？" --dry-run
```

## Inputs

- `--question "..."`: single text question
- `--questions-file <path>`: `.txt` (one question per line) or `.json` (string array)
- `--images <a.png,b.jpg>`: image paths, OCR first, then question extraction
- `--max <N>`: max number of questions processed

## Modes

- `--dry-run`: run all generation + grounding steps, write JSON artifacts only, no DB writes
- default mode: write successful items to DB as `review`

## Grounding Rules

Source priority:
1. paper (arXiv / conference publication pages)
2. expert blog
3. other blogs

Minimum evidence policy:
- target >= 2 sources
- target >= 1 paper source
- if unmet, mark item as needing manual verification (still staged to `review`)

## Output Artifacts

Saved to `data/faq-sync/grounded/`:
- per-item JSON result
- `_errors.json` for failed questions

## Safety

- Never auto-publish from this workflow
- Always keep human review as final gate
