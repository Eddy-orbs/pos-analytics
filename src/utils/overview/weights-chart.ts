import { PosOverview, PosOverviewSlice, PosOverviewData } from '@orbs-network/pos-analytics-lib';
import { OverviewGuardianDataset, GuardiansChartDatasetObject } from 'global/types';
import { findIndexInArray } from 'utils/array';
import { ChartUnit } from '../../global/enums';
import { OVERVIEW_CHART_LIMIT } from '../../global/variables';
import { generateWeeks, generateDays } from '../dates';
import { createGuardianDatasets, getLastSlice, getSampledStateDataset } from './overview';

export const generateDataset = (arr: any) => {
    const result = Object.keys(arr).map((key) => {
        return arr[key];
    });
    return result;
};

const calcTotalWeight = (data: PosOverviewData[]) => {
    let total = 0;
    data.forEach((el) => {
        if (!el.weight || !el.name ) return; 

        total += el.weight;
    });
    return total;
};
const insertGuardiansByDate = (
    slices: PosOverviewSlice[],
    guardianDatasets: { [id: string]: OverviewGuardianDataset },
    dates: Date[]
) => {
    const grouped = getSampledStateDataset(slices, dates);
    const totalObject: any = {};
    grouped.forEach(({ slice, date }: any) => {
        const { data, total_weight, total_effective_stake } = slice;
        totalObject[date] = total_effective_stake;
        const total = calcTotalWeight(data)
        data.forEach(({ weight, address }: PosOverviewData) => {
          
            const currDataset = guardianDatasets[address];
            if (!currDataset) return;
            const index = findIndexInArray(currDataset.data as any, 'x', date);
            if (index < 0) {
                return;
            }
            const percent = (weight / total) * 100;
            const point: GuardiansChartDatasetObject = {
                group: date,
                x: date,
                y: percent
            };

            currDataset.data.splice(index, 1, point);
        });
    });

    guardianDatasets.totalObject = totalObject;
    return guardianDatasets;
};

export const getOverviewChartData = (
    dates: any,
    unit: ChartUnit,
    { slices }: PosOverview,
    guardiansColors?: { [id: string]: string }
) => {
    const lastSlice = getLastSlice(slices);
    if (!lastSlice) return;
    const sortedGuardians = lastSlice.data.sort((s1, s2) => s2.weight - s1.weight);
    const guardianDatasets = createGuardianDatasets(sortedGuardians, dates, unit, guardiansColors);
    insertGuardiansByDate(slices, guardianDatasets, dates);
    const obj = {
        data: generateDataset(guardianDatasets),
        unit,
        guardianDatasets
    };
    return obj;
};
export const getWeightsChartData = (
    unit: ChartUnit,
    overviewData?: PosOverview,
    guardiansColors?: { [id: string]: string }
): any => {
    if (!overviewData) return;
    let dates;
    switch (unit) {
        case ChartUnit.WEEK:
            dates = generateWeeks(OVERVIEW_CHART_LIMIT);
            break;
        case ChartUnit.DAY:
            dates = generateDays(OVERVIEW_CHART_LIMIT);
            break;
        default:
            dates = generateWeeks(OVERVIEW_CHART_LIMIT);
            break;
    }
    if (!dates) return;
    return getOverviewChartData(dates, unit, overviewData, guardiansColors);
};
