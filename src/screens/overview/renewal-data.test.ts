import { committeePresentation, committeeSeries, committeeThirtyDayChange, stakeChartDomain } from './renewal-data';
import { PosOverviewSlice } from 'pos-analytics-graph';

const slice = (time: number, stakes: number[]): PosOverviewSlice => ({
    block_time: time, block_number: time, total_weight: 999,
    total_effective_stake: stakes.reduce((a,b) => a+b,0),
    data: stakes.map((stake,i) => ({ name:`Guardian ${i}`, address:`0x${i}`, effective_stake:stake, weight:999 }))
});
describe('Overview renewal presentation', () => {
    it('sorts copies, uses Effective Stake not Weight, and leaves Redux input intact', () => {
        const input = [slice(200,[10,30]),slice(100,[20,10])];
        const before = JSON.stringify(input);
        const result = committeePresentation(input);
        expect(result.total).toBe(40);
        expect(result.guardians.map(g=>g.effective_stake)).toEqual([30,10]);
        expect(JSON.stringify(input)).toBe(before);
    });
    it('does not invent history before the earliest snapshot or include future snapshots', () => {
        const result = committeeSeries([slice(86400,[20]),slice(3*86400,[40]),slice(5*86400,[100])],4,4*86400);
        expect(result.map(p=>p.value)).toEqual([null,20,20,40,40]);
    });
    it('handles an empty committee without fabricated stake', () => {
        expect(committeePresentation([]).total).toBe(0);
        expect(committeeSeries([],7,86400).every(p=>p.value===null)).toBe(true);
    });
});

describe('30-day Effective Stake and global ranking', () => {
    it('uses exact 30-day anchor and percentage, not weight or total stake', () => {
        const data = [slice(0,[100]), slice(30*86400,[110])];
        expect(committeeThirtyDayChange(data,30*86400)).toMatchObject({before:100,current:110,delta:10,percent:10});
        expect(committeeThirtyDayChange([slice(0,[100]),slice(30*86400,[80])],30*86400)?.percent).toBe(-20);
        expect(committeeThirtyDayChange([slice(0,[100])],30*86400)?.percent).toBe(0);
    });
    it('does not invent a percentage when baseline is missing or zero', () => {
        expect(committeeThirtyDayChange([slice(86400,[100])],30*86400)).toBe(null);
        expect(committeeThirtyDayChange([slice(0,[0]),slice(30*86400,[100])],30*86400)).toBe(null);
    });
    it('retains global ranks when filtered, with shared ranks for equal stake', () => {
        const ranked=committeePresentation([slice(0,[100,50,50,10])]).guardians;
        expect(ranked.map(g=>g.rank)).toEqual([1,2,2,4]);
        expect(ranked.filter(g=>g.address==='0x3')[0].rank).toBe(4);
    });
});


describe('Effective Stake auto-scaled axis', () => {
    it('excludes gaps and pads actual visible extrema instead of starting at zero', () => {
        const domain = stakeChartDomain([null, 980_000_000, 990_000_000, null]);
        expect(domain.min).toBe(978_500_000);
        expect(domain.max).toBe(991_500_000);
        expect(domain.ticks[0]).toBe(domain.min);
        expect(domain.ticks[3]).toBe(domain.max);
        expect(domain.max - domain.min).toBeGreaterThan(0);
    });
    it('handles empty, zero, flat and narrow series with finite non-negative bounds', () => {
        for (const values of [[], [null, NaN, Infinity], [0, 0], [100, 100], [1_000_000_000, 1_000_000_001]]) {
            const domain = stakeChartDomain(values);
            expect(domain.min).toBeGreaterThanOrEqual(0);
            expect(domain.max).toBeGreaterThan(domain.min);
            expect(domain.ticks.every(Number.isFinite)).toBe(true);
            for (const value of values) if (value !== null && Number.isFinite(value)) {
                expect(value).toBeGreaterThanOrEqual(domain.min);
                expect(value).toBeLessThanOrEqual(domain.max);
            }
        }
    });
    it('keeps real zero stake in the axis and recalculates from the selected range', () => {
        expect(stakeChartDomain([0, 100]).min).toBe(0);
        const short = stakeChartDomain([980, 990]), long = stakeChartDomain([800, 980, 990]);
        expect(short.min).toBeGreaterThan(long.min);
    });
});
