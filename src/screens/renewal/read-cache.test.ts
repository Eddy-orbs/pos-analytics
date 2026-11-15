import { pageRead } from './read-cache';
import { vi } from 'vitest';
describe('renewal page read cache', () => {
    it('coalesces concurrent reads but separates networks', async () => {
        const scope = {},
            other = {};
        const read = vi.fn(async () => 42);
        expect(await Promise.all([pageRead(scope, 'address', read), pageRead(scope, 'address', read)])).toEqual([
            42, 42
        ]);
        expect(read).toHaveBeenCalledTimes(1);
        await pageRead(other, 'address', read);
        expect(read).toHaveBeenCalledTimes(2);
    });
    it('retries failures and expires old data', async () => {
        vi.useFakeTimers();
        const scope = {};
        const read = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValue(7);
        await pageRead(scope, 'a', read);
        expect(await pageRead(scope, 'a', read)).toBe(7);
        vi.advanceTimersByTime(300001);
        await pageRead(scope, 'a', read);
        expect(read).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });
    it('bounds the number of retained addresses', async () => {
        const scope = {};
        const first = vi.fn(async () => 1);
        await pageRead(scope, 'first', first);
        for (let i = 0; i < 24; i++) await pageRead(scope, String(i), async () => i);
        await pageRead(scope, 'first', first);
        expect(first).toHaveBeenCalledTimes(2);
    });
});

it('shares an unfinished navigation read and caches from completion', async () => {
    vi.useFakeTimers();
    try {
        const scope = {};
        let finish!: (value: number) => void;
        const read = vi.fn(
            () =>
                new Promise<number>((resolve) => {
                    finish = resolve;
                })
        );
        const first = pageRead(scope, 'guardian', read);
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(60000);
        const returning = pageRead(scope, 'guardian', read);
        finish(9);
        expect(await first).toBe(9);
        expect(await returning).toBe(9);
        await vi.advanceTimersByTimeAsync(250000);
        expect(await pageRead(scope, 'guardian', read)).toBe(9);
        expect(read).toHaveBeenCalledTimes(1);
    } finally {
        vi.useRealTimers();
    }
});
it('removes hung reads and ignores late completion after retry', async () => {
    vi.useFakeTimers();
    try {
        const scope = {};
        let finish!: (value: number) => void;
        const first = pageRead(
            scope,
            'guardian',
            () =>
                new Promise<number>((resolve) => {
                    finish = resolve;
                })
        );
        const rejected = expect(first).rejects.toThrow('timed out');
        await vi.advanceTimersByTimeAsync(120001);
        await rejected;
        expect(await pageRead(scope, 'guardian', async () => 2)).toBe(2);
        finish(1);
        await Promise.resolve();
        expect(await pageRead(scope, 'guardian', async () => 3)).toBe(2);
    } finally {
        vi.useRealTimers();
    }
});
it('does not retain rejected reads', async () => {
    const scope = {};
    await expect(
        pageRead(scope, 'a', async () => {
            throw new Error('offline');
        })
    ).rejects.toThrow('offline');
    expect(await pageRead(scope, 'a', async () => 4)).toBe(4);
});
