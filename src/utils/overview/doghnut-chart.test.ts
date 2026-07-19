import { getLatestOverviewDate } from './doghnut-chart';

describe('getLatestOverviewDate', () => {
    it('uses the newest available slice instead of assuming that today exists', () => {
        const overview = {
            slices: [
                { block_time: 100, data: [] },
                { block_time: 300, data: [] },
                { block_time: 200, data: [] }
            ]
        } as any;

        expect(getLatestOverviewDate(overview)?.getTime()).toBe(300000);
    });

    it('returns null when no overview slices exist', () => {
        expect(getLatestOverviewDate({ slices: [] } as any)).toBeNull();
    });
});
