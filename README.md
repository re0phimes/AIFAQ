# AIFAQ

AIFAQ is an AI/ML FAQ knowledge base with public browsing, voting, favorites, and an admin review workflow. The core rule is simple: content may be generated or normalized by external systems, but publication is always manual in the admin review page.

## Core Principle

No content is auto-published.

All generated, imported, regenerated, or externally submitted content must enter `review` first, then be approved by an admin.

## Architecture Direction

The approved architecture is:

- AIFAQ acts as the control plane
- external runner acts as the execution plane
- admin review page is the only publish gate

In this model, AIFAQ is responsible for:

- authentication and authorization
- submission intake
- task creation and status tracking
- dispatching work to the runner
- accepting sanitized callbacks
- writing reviewable FAQ drafts
- admin review and publish/reject actions

The external runner is responsible for:

- parsing raw source material
- generating or rewriting candidate answers
- normalizing tags, taxonomy, references, and images
- returning candidate content for review

## Unified Target Flow

This is the target flow for all external content ingestion:

```text
external program / external agent
  -> submit to AIFAQ
  -> AIFAQ creates admin_tasks
  -> AIFAQ dispatches task to runner
  -> runner executes extraction / generation / normalization
  -> runner callbacks to AIFAQ
  -> AIFAQ writes faq_items(status="review")
  -> admin reviews manually
  -> publish / reject / regenerate
```

This means AIFAQ should not be the place where agentic generation or normalization runs long-term. That work belongs in the isolated runner.

## Current State

The codebase is currently in a mixed state.

Already task-driven:

- `reject -> create task -> dispatch -> callback -> review`
- direct QA upload via `POST /api/admin/faq`
- file import via `POST /api/admin/faq/import`

So the target architecture above is live for the current admin-facing ingestion paths.

## APIs That Currently Send Content Into Admin Review

### 1. Direct QA Upload

`POST /api/admin/faq`

Use this when an admin wants to submit a single QA pair into the review pipeline.

Current behavior:

- requires admin auth
- creates an `ingest_submission` task
- dispatches the task to the runner
- relies on runner callback to create the review item

Example:

```http
POST /api/admin/faq
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json
```

```json
{
  "question": "What is LoRA?",
  "answer": "LoRA is a parameter-efficient fine-tuning method..."
}
```

### 2. File Import

`POST /api/admin/faq/import`

Use this when an external program wants to upload a source document and let the system derive reviewable FAQ items from it.

Current behavior:

- requires admin auth
- accepts `md`, `txt`, or `pdf`
- creates an `ingest_submission` task with the uploaded file payload
- dispatches the task to the runner
- relies on runner callback to create review items and update import progress

Import status polling:

- `GET /api/admin/faq/import/:id`

### 3. External Submission Intake

`POST /api/external/submissions`

Use this when an external program wants to submit raw QA or document payloads through a dedicated ingestion credential instead of admin auth.

Current behavior:

- authenticates with `EXTERNAL_SUBMISSION_API_KEY`
- validates `qa` and `document` submission types
- creates an `ingest_submission` task
- can optionally dispatch immediately

This route is the long-term intake shape for non-admin external producers.

QA submission example:

```http
POST /api/external/submissions
Authorization: Bearer <EXTERNAL_SUBMISSION_API_KEY>
Content-Type: application/json
```

```json
{
  "submission_type": "qa",
  "source": "partner_bot",
  "source_id": "qa_123",
  "question": "What is speculative decoding?",
  "answer": "Speculative decoding uses a draft model to propose tokens...",
  "dispatch": true
}
```

Document submission example:

```http
POST /api/external/submissions
Authorization: Bearer <EXTERNAL_SUBMISSION_API_KEY>
Content-Type: application/json
```

```json
{
  "submission_type": "document",
  "source": "partner_bot",
  "source_id": "doc_456",
  "filename": "notes.md",
  "file_type": "md",
  "content_text": "# Transformer notes ...",
  "dispatch": true
}
```

### 4. Runner Callback for Existing Tasks

`POST /api/admin/tasks/:id/callback`

Use this when an external runner is returning the result of a previously created task.

Current behavior:

- authenticates with `RUNNER_SHARED_SECRET`
- sanitizes callback payload
- writes the result back into the target FAQ
- returns the FAQ to `review`

This is not a generic "new FAQ submission" API. It is a task result callback API.

Single-QA callback example:

```http
POST /api/admin/tasks/:id/callback
Authorization: Bearer <RUNNER_SHARED_SECRET>
Content-Type: application/json
```

```json
{
  "status": "succeeded",
  "answer": "Speculative decoding is a decoding acceleration strategy...",
  "answer_brief": "Use a draft model to propose tokens, then verify with the target model.",
  "question_en": "What is speculative decoding?",
  "tags": ["inference", "decoding"],
  "primary_category": "inference_deployment",
  "topics": ["decoding"],
  "tool_stack": ["vllm"],
  "references": [
    {
      "type": "paper",
      "title": "Fast Inference from Transformers via Speculative Decoding"
    }
  ]
}
```

Document callback example:

```json
{
  "status": "succeeded",
  "total_qa": 12,
  "passed_qa": 5,
  "items": [
    {
      "question": "What is speculative decoding?",
      "answer": "Speculative decoding is a decoding acceleration strategy...",
      "answer_brief": "A draft model proposes, a target model verifies.",
      "question_en": "What is speculative decoding?",
      "tags": ["inference", "decoding"],
      "primary_category": "inference_deployment",
      "topics": ["decoding"],
      "tool_stack": ["vllm"]
    }
  ]
}
```

## Planned Long-Term External Contract

To unify all external integrations, the planned contract is a task-first submission API. The recommended shape is:

- `POST /api/external/submissions`

Recommended submission types:

- `qa`
- `document`
- `regenerate_result`

Recommended behavior:

- validate caller auth
- store source metadata
- create `admin_tasks`
- dispatch to the runner
- let runner callback create or update the reviewable FAQ content

The goal is that all external programs and agents integrate through one intake model, not through a mix of local-processing endpoints and runner callbacks.

## Security Model

Admin control plane and runner execution plane must stay separate.

Admin-authenticated routes use:

- GitHub admin session
- or `Authorization: Bearer <ADMIN_API_KEY>`

External submission intake routes use:

- `Authorization: Bearer <EXTERNAL_SUBMISSION_API_KEY>`

Runner callback routes use:

- `Authorization: Bearer <RUNNER_SHARED_SECRET>`

These credentials must not be mixed.

## Development

Run the local development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Related Documents

- `Claude.md`: project notes and current priority TODOs
- `todo.md`: discussion and execution view
- `docs/plans/2026-03-20-runner-isolation-and-auto-regenerate-design.md`
