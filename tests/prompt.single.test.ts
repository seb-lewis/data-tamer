import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildSinglePrompt } from '../src/prompt';

describe('buildSinglePrompt', () => {
  const schema = z.object({ id: z.string() });

  it('includes system, instructions, examples and directive', () => {
    const prompt = buildSinglePrompt({
      schema,
      options: { schemaName: 'Entity', schemaDescription: 'Basic entity' },
      context: {
        system: 'System: be concise.',
        instructions: 'Return valid JSON.',
        examples: [
          { input: 'x', output: { id: '1' } },
          { input: { a: 1 }, output: { id: '2' } },
        ],
      },
    });

    expect(prompt).toContain('System: be concise.');
    expect(prompt).toContain('Return valid JSON.');
    expect(prompt).toContain('Examples (compact):');
    expect(prompt).toContain('Output: Return a single JSON object only.');
  });

  it('falls back to default instructions if none provided', () => {
    const prompt = buildSinglePrompt({ schema, context: {} });
    expect(prompt).toContain('Produce strictly valid JSON');
  });
});

