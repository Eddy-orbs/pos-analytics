import {
    DelegatorCurrent,
    DelegatorStakeHistory,
    GuardianCurrent,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartColors, ChartUnit, ChartYaxis } from '../global/enums';
import { buildDelegatorDetailChartData, buildGuardianDetailChartData } from './detail-chart-data';

const asOfTime = Date.UTC(2026, 6, 15, 12, 0, 0) / 1000;

const dataQuality = {
    exact: true,
    stake_values_exact: true,
    anchor_exact: true,
    anchor_source: 'current-state-reverse' as const,
    n_delegates_available: false
};

const guardianCurrent = ({
    address: '0xguardian',
    block_number: 200,
    block_time: asOfTime,
    stake_status: {
        self_stake: 40,
        cooldown_stake: 0,
        current_cooldown_time: 0,
        non_stake: 0,
        delegated_stake: 60,
        total_stake: 100
    }
} as unknown) as GuardianCurrent;

const delegatorCurrent = ({
    address: '0xdelegator',
    block_number: 200,
    block_time: asOfTime,
    total_stake: 75,
    cooldown_stake: 5
} as unknown) as DelegatorCurrent;

const guardianHistory = (stakeSlices: GuardianStakeHistory['stake_slices']): GuardianStakeHistory => ({
    address: guardianCurrent.address,
    range: {
        from_block: 100,
        to_block: 200,
        from_time: stakeSlices.length > 0 ? stakeSlices[0].block_time : asOfTime,
        to_time: asOfTime
    },
    stake_slices: stakeSlices,
    data_quality: dataQuality
});

const delegatorHistory = (stakeSlices: DelegatorStakeHistory['stake_slices']): DelegatorStakeHistory => ({
    address: delegatorCurrent.address,
    range: { from_block: 100, to_block: 200 },
    stake_slices: stakeSlices,
    data_quality: dataQuality
});

describe('detail chart data adapters', () => {
    it('keeps every Guardian event point and hides an unavailable delegator-count series', () => {
        const history = guardianHistory([
            {
                block_number: 100,
                block_time: asOfTime - 70 * 24 * 60 * 60,
                self_stake: 10,
                delegated_stake: 20,
                total_stake: 30,
                n_delegates: 2
            },
            {
                block_number: 150,
                block_time: asOfTime - 35 * 24 * 60 * 60,
                self_stake: 20,
                delegated_stake: 30,
                total_stake: 50,
                n_delegates: 3,
                transaction_hash: '0xevent',
                log_index: 0
            }
        ]);

        const chart = buildGuardianDetailChartData(history, guardianCurrent, ChartUnit.WEEK);

        expect(chart.unit).toBe(ChartUnit.WEEK);
        expect(chart.datasets).toHaveLength(2);
        chart.datasets.forEach((dataset) => expect(dataset.data).toHaveLength(3));
        expect(chart.datasets.map(({ color, yAxis }) => ({ color, yAxis }))).toEqual([
            { color: ChartColors.TOTAL_STAKE, yAxis: ChartYaxis.Y2 },
            { color: ChartColors.SELF_STAKE, yAxis: ChartYaxis.Y2 }
        ]);
        expect(chart.datasets[0].data.map((point) => point.y)).toEqual([30, 50, 100]);
        expect(chart.datasets[1].data.map((point) => point.y)).toEqual([10, 20, 40]);
        expect(chart.datasets[0].data[2].x).toBe(asOfTime * 1000);
    });

    it('keeps every in-range Delegator event and pins current values to the endpoint', () => {
        const history = delegatorHistory([
            {
                block_number: 100,
                block_time: Date.UTC(2025, 8, 1) / 1000,
                stake: 20,
                cooldown: 10
            },
            {
                block_number: 150,
                block_time: Date.UTC(2026, 2, 1) / 1000,
                stake: 50,
                cooldown: 8
            }
        ]);

        const chart = buildDelegatorDetailChartData(history, delegatorCurrent, ChartUnit.MONTH);

        expect(chart.unit).toBe(ChartUnit.MONTH);
        expect(chart.datasets).toHaveLength(2);
        chart.datasets.forEach((dataset) => expect(dataset.data).toHaveLength(3));
        expect(chart.datasets[0]).toMatchObject({ color: ChartColors.TOTAL_STAKE, yAxis: ChartYaxis.Y1 });
        expect(chart.datasets[1]).toMatchObject({ color: ChartColors.SELF_STAKE, yAxis: ChartYaxis.Y1 });
        expect(chart.datasets[0].data).toEqual([
            { x: Date.UTC(2025, 9, 1), y: 20 },
            { x: Date.UTC(2026, 2, 1), y: 50 },
            { x: asOfTime * 1000, y: 75 }
        ]);
        expect(chart.datasets[1].data).toEqual([
            { x: Date.UTC(2025, 9, 1), y: 10 },
            { x: Date.UTC(2026, 2, 1), y: 8 },
            { x: asOfTime * 1000, y: 5 }
        ]);
    });

    it('produces a flat boundary-to-current series when the range contains no events', () => {
        const chart = buildDelegatorDetailChartData(delegatorHistory([]), delegatorCurrent, ChartUnit.WEEK);

        expect(chart.datasets[0].data).toHaveLength(2);
        expect(chart.datasets[0].data.map((point) => point.y)).toEqual([75, 75]);
        expect(chart.datasets[1].data.map((point) => point.y)).toEqual([5, 5]);
    });

    it('adds delegator count only when the history marks it as available', () => {
        const history = guardianHistory([
            {
                block_number: 100,
                block_time: asOfTime - 7 * 24 * 60 * 60,
                self_stake: 10,
                delegated_stake: 20,
                total_stake: 30,
                n_delegates: 2
            }
        ]);
        history.data_quality = { ...history.data_quality, n_delegates_available: true };

        const chart = buildGuardianDetailChartData(history, guardianCurrent, ChartUnit.WEEK);

        expect(chart.datasets).toHaveLength(3);
        expect(chart.datasets.map(({ color, yAxis }) => ({ color, yAxis }))).toEqual([
            { color: ChartColors.TOTAL_STAKE, yAxis: ChartYaxis.Y2 },
            { color: ChartColors.DELEGATORS, yAxis: ChartYaxis.Y1 },
            { color: ChartColors.SELF_STAKE, yAxis: ChartYaxis.Y2 }
        ]);
        expect(chart.datasets[1].data[chart.datasets[1].data.length - 1]).toEqual({
            x: asOfTime * 1000,
            y: 2
        });
    });

    it('slices one long Guardian raw history for shorter Day and Week views', () => {
        const oldMonthEvent = Date.UTC(2025, 10, 1) / 1000;
        const recentDayEvent = asOfTime - 2 * 24 * 60 * 60;
        const rawHistory = guardianHistory([
            {
                block_number: 100,
                block_time: oldMonthEvent,
                self_stake: 10,
                delegated_stake: 20,
                total_stake: 30,
                n_delegates: 1
            },
            {
                block_number: 190,
                block_time: recentDayEvent,
                self_stake: 20,
                delegated_stake: 40,
                total_stake: 60,
                n_delegates: 2
            }
        ]);

        const day = buildGuardianDetailChartData(rawHistory, guardianCurrent, ChartUnit.DAY);
        const week = buildGuardianDetailChartData(rawHistory, guardianCurrent, ChartUnit.WEEK);
        const month = buildGuardianDetailChartData(rawHistory, guardianCurrent, ChartUnit.MONTH);

        expect(day.datasets[0].data[0].x).toBe(Date.UTC(2026, 6, 6));
        expect(week.datasets[0].data[0].x).toBe(Date.UTC(2026, 4, 11));
        expect(month.datasets[0].data[0].x).toBe(Date.UTC(2025, 9, 1));
        expect(day.datasets[0].data.some((point) => point.x === oldMonthEvent * 1000)).toBe(false);
        expect(week.datasets[0].data.some((point) => point.x === oldMonthEvent * 1000)).toBe(false);
        expect(month.datasets[0].data.some((point) => point.x === oldMonthEvent * 1000)).toBe(true);
    });
});
