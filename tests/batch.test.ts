import { describe, it, expect, vi } from 'vitest';

vi.mock('ai', () => {
  return {
    // This will be customized per-test via mockImplementationOnce
    generateObject: vi.fn(),
  };
});

// Import after mocks
import { transformBatch } from '../src/batch';
import { z } from 'zod';
import { type Mock } from 'vitest';
import { generateObject } from 'ai';

describe('transformBatch', () => {
  const schema = z.object({ value: z.number() });
  const model: any = {}; // not used by our mock

  it('batches inputs and flattens results', async () => {
    (generateObject as unknown as Mock).mockReset();
    // Two batches of 2 -> return arrays of objects
    ;(generateObject as unknown as Mock)
      .mockResolvedValueOnce({ object: [{ value: 1 }, { value: 2 }], response: {} })
      .mockResolvedValueOnce({ object: [{ value: 3 }, { value: 4 }], response: {} });

    const items = ['a', 'b', 'c', 'd'];
    const out = await transformBatch<{ value: number }>({
      model,
      schema,
      items,
      batchSize: 2,
      concurrency: 1,
      debug: false,
    });

    expect(out).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }]);
    expect((generateObject as unknown as Mock).mock.calls.length).toBe(2);
  });

  it('invokes onBatchResult callback with per-batch outputs', async () => {
    (generateObject as unknown as Mock).mockReset();
    ; (generateObject as unknown as Mock)
      .mockResolvedValueOnce({ object: [{ value: 10 }], response: {} })
      .mockResolvedValueOnce({ object: [{ value: 20 }], response: {} });

    const items = ['x', 'y'];
    const cb = vi.fn();
    await transformBatch<{ value: number }>({
      model,
      schema,
      items,
      batchSize: 1,
      concurrency: 1,
      onBatchResult: cb,
    });

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, {
      batchIndex: 0,
      items: ['x'],
      result: [{ value: 10 }],
    });
    expect(cb).toHaveBeenNthCalledWith(2, {
      batchIndex: 1,
      items: ['y'],
      result: [{ value: 20 }],
    });
  });

  it('retries on failure up to maxRetries with repair enabled', async () => {
    (generateObject as unknown as Mock).mockReset();
    // First call throws, second succeeds
    ; (generateObject as unknown as Mock)
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ object: [{ value: 99 }], response: {} });

    const out = await transformBatch<{ value: number }>({
      model,
      schema,
      items: ['only'],
      batchSize: 2,
      concurrency: 1,
      maxRetries: 1,
      repair: true,
    });

    expect(out).toEqual([{ value: 99 }]);
  });

  it('propagates error when repair disabled and no retries', async () => {
    (generateObject as unknown as Mock).mockReset();
    ; (generateObject as unknown as Mock).mockRejectedValueOnce(new Error('boom'));

    await expect(
      transformBatch<{ value: number }>({
        model,
        schema,
        items: ['x'],
        batchSize: 1,
        concurrency: 1,
        maxRetries: 0,
        repair: false,
      }),
    ).rejects.toThrow('boom');
  });

  it('builds prompts with full batch size (e.g., 50)', async () => {
    (generateObject as unknown as Mock).mockReset();
    // For 500 items with batchSize 50 -> 10 batches
    // Always return a trivial array; we only care about prompt content
    (generateObject as unknown as Mock).mockResolvedValue({ object: [{ value: 1 }], response: {} });

    const items = Array.from({ length: 500 }, (_, i) => `item-${i}`);
    await transformBatch<{ value: number }>({
      model,
      schema,
      items,
      batchSize: 50,
      concurrency: 2,
      debug: false,
    });

    // Expect 10 batches
    expect((generateObject as unknown as Mock).mock.calls.length).toBe(10);
    // Each prompt should indicate 50 inputs
    for (const call of (generateObject as unknown as Mock).mock.calls) {
      const arg = call[0];
      expect(arg.prompt).toContain('Inputs (50):');
    }
  });
  it('builds prompts with full batch size (e.g., 100)', async () => {
    (generateObject as unknown as Mock).mockReset();
    // For 500 items with batchSize 100 -> 5 batches
    // Always return a trivial array; we only care about prompt content
    (generateObject as unknown as Mock).mockResolvedValue({ object: [{ value: 1 }], response: {} });

    const items = Array.from({ length: 500 }, (_, i) => `item-${i}`);
    await transformBatch<{ value: number }>({
      model,
      schema,
      items,
      batchSize: 100,
      concurrency: 5,
      debug: false,
    });

    // Expect 5 batches
    expect((generateObject as unknown as Mock).mock.calls.length).toBe(5);
    // Each prompt should indicate 100 inputs
    for (const call of (generateObject as unknown as Mock).mock.calls) {
      const arg = call[0];
      expect(arg.prompt).toContain('Inputs (100):');
    }
  });
});
