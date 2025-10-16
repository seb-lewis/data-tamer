import pLimit from 'p-limit';
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import { buildBatchPrompt } from './prompt';
import type { InputItem, TransformBatchOptions } from './types';

// Note: p-limit is a tiny utility; if not installed, we fall back to simple sequential execution.
function createLimiter(concurrency: number | undefined) {
  const c = Math.max(1, concurrency ?? 1);
  try {
    return pLimit(c);
  } catch {
    return (fn: () => Promise<any>) => fn();
  }
}

export async function transformBatch<T, TProvider extends LanguageModel = LanguageModel>(
  opts: TransformBatchOptions<T, TProvider>,
): Promise<T[]> {
  const {
    model,
    schema,
    output = 'array',
    mode = 'json',
    items,
    batchSize = 10,
    concurrency = 2,
    providerOptions,
    schemaName,
    schemaDescription,
    promptContext,
    promptOptions,
    maxRetries = 1,
    repair = true,
    onBatchResult,
    maxTokens,
    debug,
  } = opts;

  if (!Array.isArray(items) || items.length === 0) return [];
  const limiter = createLimiter(concurrency);

  const batches: InputItem[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results: T[][] = [];

  await Promise.all(
    batches.map((batchItems, batchIndex) =>
      limiter(async (): Promise<void> => {
        let attempt = 0;
        while (true) {
          try {
            const prompt = buildBatchPrompt<T>({
              items: batchItems,
              schema,
              options: {
                ...promptOptions,
                schemaName,
                schemaDescription,
              },
              context: promptContext,
            });

            if (debug) {
              try {
                // eslint-disable-next-line no-console
                console.debug('[data-tamer] Prompt (batch)', { batchIndex, prompt });
              } catch {
                // noop
              }
            }

            const { object, response } = await generateObject({
              model,
              schema,
              output,
              mode,
              prompt,
              schemaName,
              schemaDescription,
              maxOutputTokens: maxTokens,
              providerOptions,
            });

            if (debug) {
              try {
                // eslint-disable-next-line no-console
                console.debug('[data-tamer] LLM response', { batchIndex, response });
              } catch {
                // eslint-disable-next-line no-console
                console.debug('[data-tamer] LLM response (unserializable)', batchIndex);
              }
            }

            const arr = Array.isArray(object) ? object : [object];
            if (schema && output !== 'no-schema' && (schema as any).safeParse) {
              results[batchIndex] = arr as T[];
            }

            if (onBatchResult) {
              await onBatchResult({ batchIndex, items: batchItems, result: results[batchIndex] });
            }
            break;
          } catch (err: any) {
            attempt += 1;
            if (attempt > maxRetries) {
              throw err;
            }
            if (!repair) {
              // backoff minimal
              await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
              continue;
            }
            await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
          }
        }
      }),
    ),
  );

  return results.flat();
}
