import { z } from 'zod';
import { generateObject, streamObject, NoObjectGeneratedError, zodSchema } from 'ai';
import type { LanguageModel } from 'ai';
import { buildBatchPrompt, buildSinglePrompt } from './prompt';
import type { StreamTransformObjectOptions, TransformObjectOptions, StreamObjectLikeResult } from './types';
import { FlexibleSchema } from '@ai-sdk/provider-utils';

export async function transformObject<T, TProvider extends LanguageModel = LanguageModel>(
  opts: TransformObjectOptions<FlexibleSchema<T>, TProvider>,
): Promise<{ data: T | unknown; response: unknown }> {
  const {
    model,
    schema,
    output = schema ? 'object' : 'no-schema',
    mode = 'json',
    items,
    providerOptions,
    maxTokens,
    schemaName,
    schemaDescription,
    promptContext,
    promptOptions,
    maxRetries = 1,
    repair = true,
    debug,
  } = opts;

  const hasItems = !!items?.length;
  if (!hasItems && !promptContext) {
    throw new Error('Provide items or promptContext to build a prompt.');
  }

  const builtPrompt = hasItems
    ? buildBatchPrompt({
        items: items!,
        schema,
        options: { ...promptOptions, schemaName, schemaDescription },
        context: promptContext,
      })
    : buildSinglePrompt({
        schema,
        options: { ...promptOptions, schemaName, schemaDescription },
        context: promptContext,
      });

  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug('[data-tamer] Prompt (single/object)', builtPrompt);
    } catch {
      // noop
    }
  }

  let attempt = 0;
  while (true) {
    try {
      const result = await generateObject({
        model,
        schema,
        output,
        mode,
        prompt: builtPrompt,
        schemaName,
        schemaDescription,
        providerOptions,
        maxOutputTokens: maxTokens,
      });

      const value = result.object;
      return { data: value as T, response: result.response };
    } catch (err: any) {
      attempt += 1;
      // When using AI SDK, a NoObjectGeneratedError gives useful context
      if (NoObjectGeneratedError?.isInstance?.(err)) {
        // fallthrough to retry behavior
      }
      if (attempt > maxRetries) throw err;
      if (!repair) continue;
      await new Promise((r) => setTimeout(r, Math.min(1000 * attempt, 3000)));
    }
  }
}

export function streamTransformObject<T, TProvider extends LanguageModel = LanguageModel>(
  opts: StreamTransformObjectOptions<FlexibleSchema<T>, TProvider>,
): StreamObjectLikeResult {
  const {
    model,
    schema,
    output = schema ? 'object' : 'no-schema',
    mode = 'json',
    items,
    providerOptions,
    maxTokens,
    schemaName,
    schemaDescription,
    promptContext,
    promptOptions,
    debug,
  } = opts;

  const hasItems = !!items?.length;
  if (!hasItems && !promptContext) {
    throw new Error('Provide items or promptContext to build a prompt.');
  }

  const builtPrompt = hasItems
    ? buildBatchPrompt({
        items: items!,
        schema,
        options: { ...promptOptions, schemaName, schemaDescription },
        context: promptContext,
      })
    : buildSinglePrompt({
        schema,
        options: { ...promptOptions, schemaName, schemaDescription },
        context: promptContext,
      });

  if (debug) {
    try {
      // eslint-disable-next-line no-console
      console.debug('[data-tamer] Prompt (single/stream)', builtPrompt);
    } catch {
      // noop
    }
  }

  return streamObject({
    model,
    schema,
    output,
    mode,
    prompt: builtPrompt,
    schemaName,
    schemaDescription,
    providerOptions,
    maxOutputTokens: maxTokens,
  });
}
