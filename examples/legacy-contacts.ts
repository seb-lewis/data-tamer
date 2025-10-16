/*
  Simple example: legacy contact cleanup (no CSV parsing)

  Usage:
    ts-node examples/legacy-contacts.ts

  Requirements:
    - Install peer deps in your app: `pnpm add ai zod @openrouter/ai-sdk-provider`
    - Set OPENROUTER_API_KEY in your environment
*/

/* eslint-disable no-console */
import { z } from 'zod';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { transformBatch } from '../src';

// Domain prompt provided by the user
const PROMPT = [
  '- Remove honorifics/credentials (Dr., MD, DO, PhD, etc.) from the data',
  '- Always extract the requested fields for the primary person from the available data. If it is not clear, leave fields null.',
  '- Put information not related to the primary person in the notes field.',
  '- If no primary person name is present, leave name fields null.',
  '- notes are only for extra information that exists in the record but does not fit into the requested output fields, not for extra commentary or explanation.'
].join('\n');

// Output schema
const OutputSchema = z.object({
  first_name: z.string().nullable(),
  middle_name: z.string().nullable(),
  last_name: z.string().nullable(),
  title: z.string().nullable(),
  department: z.string().nullable(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
});

const rows: Record<string, unknown>[] = [
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'Ava Parker',
    name_descriptor: null,
    legacy_title: null,
    address_text: null,
    company: null,
  },
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'jordan morgan',
    name_descriptor: 'sec taylor brooks',
    legacy_title: null,
    address_text: '1234 North Example Street',
    company: null,
  },
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'Dr. Sam Carter',
    name_descriptor: null,
    legacy_title: null,
    address_text: null,
    company: null,
  },
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'Robert Monroe  Attention Morgan',
    name_descriptor: null,
    legacy_title: null,
    address_text: null,
    company: 'Acme Health Systems',
  },
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'Alex',
    name_descriptor: null,
    legacy_title: null,
    address_text: null,
    company: null,
  },
  {
    legacy_first_name: null,
    legacy_middle_name: null,
    legacy_last_name: 'Taylor (assistant)/Jordan',
    name_descriptor: null,
    legacy_title: null,
    // Include some inline labels to mirror real-world address_text
    address_text: '1000 Sample Ave., #101\nEmail: sample.person@example.com\nPhone: 555-0100',
    company: null,
  },
];

async function main(): Promise<void> {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! });

  const results = await transformBatch({
    items: rows.map((r) => Object.values(r).filter(Boolean).join(',')),
    schema: OutputSchema,
    output: 'array',
    mode: 'json',
    model: openrouter.chat(process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite', { reasoning: { enabled: true, max_tokens: 500 } }),
    batchSize: 6,
    concurrency: 1,
    schemaName: 'LegacyContact',
    schemaDescription: 'Structured contact fields extracted from messy legacy inputs',
    promptContext: {
      instructions: PROMPT,
    },
    maxRetries: 1,
    repair: true,
    debug: true,
  });

  console.log('\nTransformed rows:\n');
  results.forEach((r, i) => {
    console.log(`#${i + 1}`, JSON.stringify(r, null, 2));
  });
}

main().catch((err) => {
  console.error('Error:', err?.message ?? err);
  process.exit(1);
});
