import moment from 'moment';
import { PosOverviewSlice } from '@orbs-network/pos-analytics-lib';
import { getDailyStateDataset, getMinDateByUnitOverview, getSampledStateDataset } from './overview';
import { ChartUnit } from '../../global/enums';

const slice = (date: Date, total: number): PosOverviewSlice => ({
    block_number: total,
    block_time: moment(date).hour(12).unix(),
    total_effective_stake: total,
    total_weight: total,
    data: []
});

describe('Overview daily committee state', () => {
    it('carries the latest CommitteeEvent through dates without a new event', () => {
        const july1 = new Date(2026, 6, 1);
        const july2 = new Date(2026, 6, 2);
        const july3 = new Date(2026, 6, 3);
        const july4 = new Date(2026, 6, 4);
        const result = getDailyStateDataset(
            [slice(july3, 30), slice(july1, 10)],
            [july4, july3, july2, july1]
        );

        expect(result.map(({date, slice: state}) => [date, state.total_effective_stake])).toEqual([
            ['01/07/2026', 10],
            ['02/07/2026', 10],
            ['03/07/2026', 30],
            ['04/07/2026', 30]
        ]);
    });

    it('does not invent a state before the first known CommitteeEvent', () => {
        const july1 = new Date(2026, 6, 1);
        const july2 = new Date(2026, 6, 2);
        expect(getDailyStateDataset([slice(july2, 20)], [july1])).toEqual([]);
    });
});

describe('Overview weekly committee state', () => {
    it('uses the latest preceding daily event instead of requiring an event on the weekly date', () => {
        const june29 = new Date(2026, 5, 29);
        const july4 = new Date(2026, 6, 4);
        const july6 = new Date(2026, 6, 6);
        const july10 = new Date(2026, 6, 10);
        const july13 = new Date(2026, 6, 13);

        const result = getSampledStateDataset(
            [slice(july10, 30), slice(july4, 20), slice(june29, 10)],
            [july13, july6, june29]
        );

        expect(result.map(({date, slice: state}) => [date, state.total_effective_stake])).toEqual([
            ['29/06/2026', 10],
            ['06/07/2026', 20],
            ['13/07/2026', 30]
        ]);
    });
});

describe('Overview chart range', () => {
    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 6, 20, 20, 0).valueOf());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('includes the complete first weekly sample and its date tick', () => {
        expect(getMinDateByUnitOverview(ChartUnit.WEEK)).toEqual(new Date(2026, 4, 25));
    });

    it('includes the complete first daily sample and its date tick', () => {
        expect(getMinDateByUnitOverview(ChartUnit.DAY)).toEqual(new Date(2026, 6, 12));
    });
});
