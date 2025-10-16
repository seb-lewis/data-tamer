import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildBatchPrompt } from '../src/prompt';

describe('buildBatchPrompt', () => {
  const schema = z.object({
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
  });

  it('includes items, instructions, and schema description', () => {
    const prompt = buildBatchPrompt({
      items: ['Alice Doe'],
      schema,
      options: {
        schemaName: 'PersonName',
        schemaDescription: 'First and last names',
      },
      context: {
        system: 'System: extract person names.',
        instructions: 'Only return valid JSON.',
      },
    });

    expect(prompt).toContain('System: extract person names.');
    expect(prompt).toContain('Only return valid JSON.');
    expect(prompt).toContain('Inputs (1):');
  });

  it('truncates long items with charLimitPerItem', () => {
    const long = 'x'.repeat(200);
    const prompt = buildBatchPrompt({
      items: [long],
      schema,
      options: { charLimitPerItem: 50 },
      context: {},
    });
    // Expect an ellipsis character
    expect(prompt).toMatch(/x{47}…/);
  });
});

