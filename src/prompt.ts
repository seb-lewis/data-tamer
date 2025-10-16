import { FlexibleSchema } from '@ai-sdk/provider-utils';
import type { InputItem, PromptBuilderOptions, PromptContext } from './types';

function truncate(text: string, max: number | undefined): string {
  if (!max || text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 3)) + '…';
}

function formatItem(item: InputItem, charLimit?: number): string {
  if (typeof item === 'string') return truncate(item, charLimit);
  try {
    const json = JSON.stringify(item);
    return truncate(json, charLimit);
  } catch {
    return truncate(String(item), charLimit);
  }
}

export function buildSystemPrompt(ctx?: PromptContext): string | undefined {
  if (!ctx?.system) return undefined;
  // Keep system instruction concise to minimize tokens
  return ctx.system.trim();
}

export function buildInstructionPrompt(ctx?: PromptContext): string | undefined {
  if (!ctx?.instructions) return undefined;
  return ctx.instructions.trim();
}

export function buildExamplesPrompt(
  examples: PromptContext['examples'],
  charLimit?: number,
): string | undefined {
  if (!examples?.length) return undefined;
  const lines: string[] = [];
  for (const ex of examples) {
    lines.push('- input: ' + formatItem(ex.input, charLimit));
    if (ex.output !== undefined) {
      try {
        lines.push('  output: ' + JSON.stringify(ex.output));
      } catch {
        lines.push('  output: [unserializable]');
      }
    }
  }
  return `Examples (compact):\n${lines.join('\n')}`;
}

export function buildItemsPrompt(items: InputItem[], charLimit?: number): string {
  const lines = items.map((item, idx) => `#${idx}: ${formatItem(item, charLimit)}`);
  return `Inputs (${items.length}):\n${lines.join('\n')}`;
}

export function buildBatchPrompt<TSchema extends any>(args: {
  items: InputItem[];
  schema?: FlexibleSchema<TSchema>;
  options?: PromptBuilderOptions;
  context?: PromptContext;
}): string {
  const { items, schema, options, context } = args;
  const parts: string[] = [];
  const system = buildSystemPrompt(context);
  if (system) parts.push(system);

  const instructions =
    buildInstructionPrompt(context) ||
    'You are a data transformation engine. Produce strictly valid JSON. No commentary.';
  parts.push(instructions);

  const examples = buildExamplesPrompt(context?.examples, options?.charLimitPerItem);
  if (examples) parts.push(examples);

  const itemsBlock = buildItemsPrompt(items, options?.charLimitPerItem);
  parts.push(itemsBlock);

  // Final directive optimized for JSON mode
  parts.push(
    'Output: For each input, return a corresponding JSON element in order. No extra text.',
  );

  return parts.join('\n\n');
}

export function buildSinglePrompt<TSchema extends any>(args: {
  schema?: FlexibleSchema<TSchema>;
  options?: PromptBuilderOptions;
  context?: PromptContext;
}): string {
  const { schema, options, context } = args;
  const parts: string[] = [];
  const system = buildSystemPrompt(context);
  if (system) parts.push(system);

  const instructions =
    buildInstructionPrompt(context) ||
    'You are a data transformation engine. Produce strictly valid JSON. No commentary.';
  parts.push(instructions);

  const examples = buildExamplesPrompt(context?.examples, options?.charLimitPerItem);
  if (examples) parts.push(examples);

  parts.push('Output: Return a single JSON object only.');

  return parts.join('\n\n');
}
