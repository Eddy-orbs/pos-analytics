import { PosOverviewSlice } from 'pos-analytics-graph';

// Presentation only: reuse the existing committee snapshots without RPC/GraphQL calls.
export function committeePresentation(slices: PosOverviewSlice[]) {
    const ordered = [...slices].sort((a, b) => a.block_time - b.block_time);
    const latest = ordered[ordered.length - 1];
    const guardians = [...(latest?.data || [])]
        .sort((a, b) => b.effective_stake - a.effective_stake || a.address.localeCompare(b.address))
        .map((guardian, _index, sorted) => ({
            ...guardian,
            rank: sorted.findIndex((g) => g.effective_stake === guardian.effective_stake) + 1
        }));
    const total = guardians.reduce((sum, g) => sum + g.effective_stake, 0);
    return { ordered, latest, guardians, total };
}

export function committeeSeries(slices: PosOverviewSlice[], days: number, end: number) {
    const ordered = [...slices].sort((a, b) => a.block_time - b.block_time);
    let cursor = -1;
    return Array.from({ length: days + 1 }, (_, i) => {
        const time = end - (days - i) * 86400;
        while (cursor + 1 < ordered.length && ordered[cursor + 1].block_time <= time) cursor++;
        return { time, value: cursor < 0 ? null : ordered[cursor].total_effective_stake };
    });
}

// Always compare the same Effective Stake series, independent of the chart selector.
export function committeeThirtyDayChange(slices: PosOverviewSlice[], end: number) {
    const points = committeeSeries(slices, 30, end);
    const before = points[0].value;
    const current = points[30].value;
    if (before === null || current === null || before <= 0) return null;
    return {
        before,
        current,
        delta: current - before,
        percent: ((current - before) / before) * 100,
        from: points[0].time,
        to: end
    };
}

// Scale only from real visible samples: missing days are not zero stake.
export function stakeChartDomain(values: Array<number | null>) {
    const valid = values.filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);
    if (!valid.length) return { min: 0, max: 1, ticks: [0, 1 / 3, 2 / 3, 1] };
    const low = Math.min(...valid),
        high = Math.max(...valid);
    const spread = high - low;
    // A flat series still gets a nonzero domain; tiny changes retain numeric headroom.
    const padding = spread > 0 ? Math.max(spread * 0.15, high * 1e-6, 1) : Math.max(high * 0.005, 1);
    const min = Math.max(0, low - padding),
        max = high + padding;
    return { min, max, ticks: Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3) };
}
