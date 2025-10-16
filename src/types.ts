import type { FlexibleSchema, ProviderOptions } from '@ai-sdk/provider-utils';
import type { LanguageModel } from 'ai';

export type UnstructuredInput = string;
export type StructuredInput = Record<string, unknown>;
export type InputItem = UnstructuredInput | StructuredInput;

export type OutputStrategy = 'object' | 'array' | 'enum' | 'no-schema';
export type GenerationMode = 'auto' | 'tool' | 'json';

export interface PromptContext {
  system?: string;
  instructions?: string;
  examples?: Array<{ input: InputItem; output?: unknown }>;
}

export interface PromptOptions {
  charLimitPerItem?: number;
  includeSchemaDescription?: boolean;
}

export interface PromptBuilderOptions extends PromptOptions {
  schemaName?: string;
  schemaDescription?: string;
}

// Infer providerOptions from the model instance when possible.
// - If TProvider has `provider` (name) and `settings` (typed settings),
//   we expose `providerOptions` as `{ [providerName]: Partial<settings> } & ProviderOptions`.
// - Otherwise, fall back to generic `ProviderOptions`.
type InferredProviderOptions<TProvider> = ProviderOptions & (
  TProvider extends { provider: infer P extends string; settings: infer S }
    ? Partial<Record<P, Partial<S>>>
    : unknown
);

export interface TransformOptionsBase<TProvider extends LanguageModel, TSchema extends any> {
  // The AI SDK model instance. Using TProvider enables providerOptions inference.
  model: TProvider;
  // Schema sent to the AI SDK; can be a Zod schema or a JSON schema.
  schema?: FlexibleSchema<TSchema>; // optional when output === 'no-schema'
  output?: OutputStrategy; // default 'object'
  mode?: GenerationMode; // default 'json'
  schemaName?: string;
  schemaDescription?: string;
  items?: InputItem[]; // used for batch prompts
  promptContext?: PromptContext;
  promptOptions?: PromptBuilderOptions;
  // Provider-specific options are forwarded as-is and can be typed by callers
  providerOptions?: InferredProviderOptions<TProvider>;
  // Token cap supported generically by AI SDK
  maxTokens?: number;
  // Retry & repair
  maxRetries?: number;
  repair?: boolean;
  // Debug: when true, may log provider responses or additional metadata
  debug?: boolean;
}

export interface TransformObjectOptions<TSchema extends any, TProvider extends LanguageModel = LanguageModel>
  extends TransformOptionsBase<TProvider, TSchema> {
  // for single object generation
}

export interface StreamTransformObjectOptions<TSchema extends any, TProvider extends LanguageModel = LanguageModel>
  extends TransformOptionsBase<TProvider, TSchema> {
  // for streaming
}

export interface TransformBatchOptions<TSchema extends any, TProvider extends LanguageModel = LanguageModel>
  extends TransformOptionsBase<TProvider, TSchema> {
  items: InputItem[]; // required for batch
  batchSize?: number; // number of items per prompt
  concurrency?: number; // number of prompts in-flight
  onBatchResult?: (args: {
    batchIndex: number;
    items: InputItem[];
    result: unknown;
  }) => void | Promise<void>;
}

// Keep result types generic to avoid tight coupling with specific AI SDK versions
export type GenerateObjectLikeResult = any;
export type StreamObjectLikeResult = any;
