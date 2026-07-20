import { PosOverviewData, PosOverviewSlice } from 'pos-analytics-graph';
import { TFunction } from 'i18next';
import moment from 'moment';
import _ from 'lodash';
import { ChartUnit, OverviewSections } from '../../global/enums';
import { GuardiansChartDatasetObject, MenuOption, OverviewGuardianDataset } from '../../global/types';
import { routes } from '../../routes/routes';
import { getDateFormatByUnit } from '../dates';
import { overviewguardiansColors } from '../../ui/colors';
import { DATE_FORMAT, OVERVIEW_CHART_LIMIT } from '../../global/variables';

export const generateOverviewRoutes = (t: TFunction): MenuOption[] => {
    return [
        {
            name: t('main.stake'),
            route: routes.overview.stake,
            key: OverviewSections.STAKE
        },
        {
            name: t('main.weights'),
            route: routes.overview.weights,
            key: OverviewSections.WEIGHTS
        }
    ];
};

export const getGuardianColor = (index: number) => {
    const colorIndex = index % overviewguardiansColors.length;
    return overviewguardiansColors[colorIndex];
};

const fillChartData = (dates: Date[], unit: ChartUnit): GuardiansChartDatasetObject[] => {
    return dates.map((date) => {
        const blockTimeDate = moment(date);
        const blockTimeByUnit = getDateFormatByUnit(blockTimeDate, unit);
        return {
            group: blockTimeByUnit,
            x: moment(date).format(DATE_FORMAT),
            y: null
        };
    });
};

export const createGuardianDatasets = (
    sortedGuardians: PosOverviewData[],
    dates: Date[],
    unit: ChartUnit,
    guardiansColors?: { [id: string]: string }
): { [id: string]: OverviewGuardianDataset } => {
    const guardiansObject: { [id: string]: OverviewGuardianDataset } = {};
    sortedGuardians.forEach((guardian: PosOverviewData, index: number) => {
        const obj = {
            order: index,
            backgroundColor: guardiansColors ? guardiansColors[guardian.address] : getGuardianColor(index),
            label: guardian.name,
            data: fillChartData(dates, unit),
            maxBarThickness: 30,
            hoverBackgroundColor: undefined
        };
        guardiansObject[guardian.address] = obj;
    });
    return guardiansObject;
};

export const getLastSlice = (slices: PosOverviewSlice[]): PosOverviewSlice | null => {
    if (!slices || slices.length === 0) return null;
    const sorted = slices.sort((s1, s2) => s2.block_time - s1.block_time);
    return sorted[0];
};

export const getMinDateByUnitOverview = (unit: ChartUnit): Date => {
    switch (unit) {
        case ChartUnit.WEEK:
            return moment().add(1, 'days').subtract(OVERVIEW_CHART_LIMIT, 'weeks').toDate();
        case ChartUnit.DAY:
            return moment().subtract(OVERVIEW_CHART_LIMIT, 'days').toDate();
        default:
            return moment().subtract(OVERVIEW_CHART_LIMIT, 'weeks').toDate();
    }
};

export const groupDataset = (slices: PosOverviewSlice[], unit: ChartUnit) => {
    const limit = getMinDateByUnitOverview(unit);
    const limitMilliseconds = moment(limit).valueOf();
    const filtered = slices.filter((slice) => {
        const { block_time } = slice;
        const blockTimeMilliseconds = moment.unix(block_time).valueOf();
        return blockTimeMilliseconds > limitMilliseconds;
    });
    const mapped = filtered.map((slice) => {
        let prev: PosOverviewData[] = [];
        const { block_time, data } = slice;
        const date = moment.unix(block_time).format(DATE_FORMAT);
        const { length } = data;
        if (length > 0) {
            prev = data;
        }
        return {
            ...slice,
            date,
            data: length > 0 ? data : prev
        };
    });
    const result = createGroupedDataset(mapped);
    return result;
};

const createGroupedDataset = (mapped: any) => {
    const grouped = _(mapped)
        .groupBy((x) => x.date)
        .map((value, key) => {
            const sorted = value.sort((s1: PosOverviewSlice, s2: PosOverviewSlice) => s1.block_time - s2.block_time);
            const slice = sorted[sorted.length - 1];
            return { date: key, slice };
        })
        .value();
    return grouped;
};
