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
    range: { from_block: 100, to_block: 200 },
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
    it('creates ten weekly Guardian buckets and hides an unavailable delegator-count series', () => {
        const history = guardianHistory([
            {
                block_number: 100,
                block_time: asOfTime - 70 * 24 * 60 * 60,
                self_stake: 10,
                delegated_stake: 20,
                total_stake: 30,
                n_delegates: 2
            }
        ]);

        const chart = buildGuardianDetailChartData(history, guardianCurrent, ChartUnit.WEEK);

        expect(chart.unit).toBe(ChartUnit.WEEK);
        expect(chart.datasets).toHaveLength(3);
        chart.datasets.forEach((dataset) => expect(dataset.data).toHaveLength(10));
        expect(chart.datasets.map(({ color, yAxis }) => ({ color, yAxis }))).toEqual([
            { color: ChartColors.TOTAL_STAKE, yAxis: ChartYaxis.Y1 },
            { color: ChartColors.SELF_STAKE, yAxis: ChartYaxis.Y1 },
            { color: ChartColors.DELEGATORS, yAxis: ChartYaxis.Y1 }
        ]);
        expect(chart.datasets.map((dataset) => dataset.data[9].y)).toEqual([100, 40, 60]);
        expect(chart.datasets[0].data[9].x).toBe(asOfTime * 1000);
    });

    it('creates ten calendar-month Delegator buckets and pins the current values to the endpoint', () => {
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
        chart.datasets.forEach((dataset) => expect(dataset.data).toHaveLength(10));
        expect(chart.datasets[0]).toMatchObject({ color: ChartColors.TOTAL_STAKE, yAxis: ChartYaxis.Y1 });
        expect(chart.datasets[1]).toMatchObject({ color: ChartColors.SELF_STAKE, yAxis: ChartYaxis.Y1 });
        expect(chart.datasets[0].data[9]).toEqual({ x: asOfTime * 1000, y: 75 });
        expect(chart.datasets[1].data[9]).toEqual({ x: asOfTime * 1000, y: 5 });
    });

    it('produces flat ten-point series when the range contains no events', () => {
        const chart = buildDelegatorDetailChartData(delegatorHistory([]), delegatorCurrent, ChartUnit.WEEK);

        expect(chart.datasets[0].data).toHaveLength(10);
        expect(chart.datasets[0].data.map((point) => point.y)).toEqual(Array(10).fill(75));
        expect(chart.datasets[1].data.map((point) => point.y)).toEqual(Array(10).fill(5));
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

        expect(chart.datasets).toHaveLength(4);
        expect(chart.datasets[3]).toMatchObject({ color: ChartColors.DELEGATORS, yAxis: ChartYaxis.Y1 });
        expect(chart.datasets[3].data[9]).toEqual({ x: asOfTime * 1000, y: 2 });
    });
});
