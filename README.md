# data-tamer

Lightweight wrappers around the Vercel AI SDK for transforming data with structured outputs, prompt compaction for lower token usage, Zod validation, and batching utilities.

## Install

This library expects the Vercel AI SDK and Zod to be present. Add them to your app:

```
pnpm add ai zod
```

## Quick Start

```ts
import { z } from "zod"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { transformObject, transformBatch } from "data-tamer"

// 1) Create a provider/model
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! })
const model = openrouter.chat("openai/gpt-4.1-mini")

// 2) Define your output schema (types are inferred from Zod)
const schema = z.object({ name: z.string(), age: z.number().nullable() })

// 3) Single transform from messy text
const { data } = await transformObject({
  model,
  schema,
  items: ["John Doe, 34 years old"],
  promptContext: { instructions: "Extract name and age. Use null when unknown." },
  schemaName: "Person",
  schemaDescription: "A person record with name and age",
})

console.log(data) // { name: 'John Doe', age: 34 }

// 4) Batch transform (compact prompt for multiple inputs)
const inputs = ["Jane Doe, 29", "Mr. Smith, unknown age", { text: "Alice, 41" }]

const results = await transformBatch({
  model,
  schema,
  items: inputs,
  batchSize: 2,
  concurrency: 2,
  promptContext: { instructions: "Extract name and age. Use null when unknown." },
  schemaName: "Person",
  schemaDescription: "A person record with name and age",
})

console.log(results) // array of validated objects
```

## API

- `transformObject({ model, schema, prompt | items, output, mode, ... })`

  - Generates a single object (default) or other output strategies.
  - If `items` is provided, a compact prompt is auto-built to minimize tokens.
  - You can pass `promptContext` alongside `items`; it is injected into the system prompt to guide the transformation.
  - Structured output: by default `mode: 'json'`. Pass a Zod schema or a JSON Schema via the `schema` field; the AI SDK accepts both. If a Zod schema is provided, results are additionally validated locally with Zod.
  - Validates against `schema` with Zod.

- `streamTransformObject({ ... })`

  - Streams partial structured objects using AI SDK `streamObject`.

- `transformBatch({ items, batchSize, concurrency, ... })`
  - Splits `items` into batches, builds compact prompts, calls `generateObject` per batch.
  - Returns a flattened array of validated results.
  - If you supply `promptContext` together with `items`, it is injected into the system prompt for each batch.
  - Structured output uses `mode: 'json'` by default and accepts either a Zod or JSON Schema via `schema`.
  - Set `debug: true` to log provider response metadata per batch.

## Prompt Compaction

The prompt builder:

- De-duplicates schema guidance and uses short, strict JSON directions.
- Truncates per-item input via `charLimitPerItem`.
- Supports optional `system`, `instructions`, and few-shot `examples`.
- Items are raw inputs (strings or objects). Place guidance/instructions in `promptContext.system`/`promptContext.instructions`.

## Notes

- This library is a thin layer over the AI SDK; provider-specific options can be forwarded via `providerOptions`.
- For best results and minimal tokens, prefer `mode: 'json'` with modern models.
- JSON Schema: You can pass JSON Schema directly via `schema`. If you use Zod, just pass the Zod schema; AI SDK handles structured generation, and we also validate outputs with Zod.
- To use OpenRouter, set `OPENROUTER_API_KEY` in your environment and initialize the provider with `createOpenRouter({ apiKey })`. Choose a model id that OpenRouter supports (e.g. `openai/gpt-4.1-mini`, `anthropic/claude-3.5-sonnet`).
- Provider-specific options (e.g., OpenRouter reasoning/token controls) should be set under `providerOptions.<provider>` and are forwarded as-is.
