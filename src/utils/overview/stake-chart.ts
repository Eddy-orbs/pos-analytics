import { PosOverview, PosOverviewSlice, PosOverviewData } from '@orbs-network/pos-analytics-lib';
import { GuardiansChartDatasetObject, OverviewGuardianDataset } from 'global/types';
import { ChartUnit } from '../../global/enums';
import {  OVERVIEW_CHART_LIMIT } from '../../global/variables';
import {  generateDays, generateWeeks } from '../dates';
import { createGuardianDatasets, getLastSlice, getSampledStateDataset } from './overview';
import { findIndexInArray } from 'utils/array';
import _ from 'lodash';
export const generateDataset = (arr: any) => {
    const result = Object.keys(arr).map((key) => {
        return arr[key];
    });
    return result;
};


const insertGuardiansByDate = (
    slices: PosOverviewSlice[],
    guardianDatasets: { [id: string]: OverviewGuardianDataset },
    dates: Date[]
) => {
    const totalObject: any = {};
    const grouped = getSampledStateDataset(slices, dates);
    grouped.forEach(({ slice, date }: any) => {
    
        const { data, total_effective_stake } = slice;
        totalObject[date] = total_effective_stake;
        data.forEach(({ effective_stake, address }: PosOverviewData) => {
            const currDataset = guardianDatasets[address];
            if (!currDataset) return;
            const index = findIndexInArray(currDataset.data as any, 'x', date);
            if (index < 0) return;
            const point: GuardiansChartDatasetObject = {
                group: date,
                x: date,
                y: effective_stake
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
    const sortedGuardians = lastSlice.data.sort((s1, s2) => s2.effective_stake - s1.effective_stake);
    const guardianDatasets = createGuardianDatasets(sortedGuardians, dates, unit, guardiansColors);
    insertGuardiansByDate(slices, guardianDatasets, dates);
    const obj = {
        data: generateDataset(guardianDatasets),
        unit,
        guardianDatasets
    };
    return obj;
};

export const getStakeChartData = (
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
