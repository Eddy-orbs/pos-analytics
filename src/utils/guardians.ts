import { TFunction } from 'i18next';
import { ChartData, GuardiansChartDataset, GuardiansChartDatasets, MenuOption } from '../global/types';
import { routes } from '../routes/routes';
import { ChartColors, ChartUnit, ChartYaxis, GuardianActionsTypes, GuardiansSections } from '../global/enums';
import { Guardian, GuardianAction, GuardianInfo, GuardianStake } from 'pos-analytics-graph';
import { generateDays, generateMonths, generateWeeks } from './dates';
import { STACK_GRAPH_MONTHS_LIMIT } from '../global/variables';
import moment from 'moment';
import DAItoken from '../assets/images/bootstrap-token.png';
import { convertToString } from './number';
import { chartDatasetObjectComparer } from './chart';

export const generateGuardiansRoutes = (t: TFunction, address: string): MenuOption[] => {
    return [
        {
            name: t('main.stake'),
            route: routes.guardians.stake.replace(':address', address),
            key: GuardiansSections.STAKE
        },
        // {
        //     name: t('main.rewards'),
        //     route: routes.guardians.rewards.replace(':address', address),
        //     key: GuardiansSections.REWARDS
        // },
        {
            name: t('main.delegetors'),
            route: routes.guardians.delegators.replace(':address', address),
            key: GuardiansSections.DELEGATORS
        },
        // {
        //     name: t('main.actions'),
        //     route: routes.guardians.actions.replace(':address', address),
        //     key: GuardiansSections.ACTIONS
        // }
    ];
};

export const checkIfLoadDelegator = (address?: string, selectedGuardianAddress?: string): boolean => {
    if (!address) return false;
    if (selectedGuardianAddress && address.indexOf(selectedGuardianAddress) > -1) return false;
    return true;
};

const generateDatasets = (): GuardiansChartDatasets => {
    return {
        self_stake: {
            data: [],
            color: ChartColors.SELF_STAKE,
            yAxis: ChartYaxis.Y2
        },
        total_stake: {
            data: [],
            color: ChartColors.TOTAL_STAKE,
            yAxis: ChartYaxis.Y2
        },
        n_delegates: {
            data: [],
            color: ChartColors.DELEGATORS,
            yAxis: ChartYaxis.Y1
        }
    };
};

export const getGuardianChartData = (unit: ChartUnit, { stake_slices }: GuardianInfo): ChartData => {
    let datasets = generateDatasets();

    stake_slices.forEach((m) => {
        insertChartDataByType(datasets, m, moment.unix(m.block_time).valueOf());
    });
    const sortedDatasets = [datasets.total_stake, datasets.n_delegates, datasets.self_stake];
    sortedDatasets.map((dataset: GuardiansChartDataset) => {
        dataset.data.sort(chartDatasetObjectComparer);
    });
    return {
        datasets: sortedDatasets,
        unit
    };
};

const insertChartDataByType = (chartData: GuardiansChartDatasets, stake: GuardianStake, date: number): any => {
    const { self_stake, n_delegates, total_stake } = stake;
    const x = date;
    const selftStake = {
        x,
        y: self_stake
    };
    const delegators = {
        x,
        y: n_delegates
    };
    const delegatedStake = {
        x,
        y: total_stake
    };
    chartData.self_stake.data.push(selftStake);
    chartData.n_delegates.data.push(delegators);
    chartData.total_stake.data.push(delegatedStake);
};

export const generateGuardiansChartData = (unit: ChartUnit, selectedGuardian?: GuardianInfo): ChartData | undefined => {
    if (!selectedGuardian) return;
    let dates;
    switch (unit) {
        case ChartUnit.MONTH:
            dates = generateMonths(STACK_GRAPH_MONTHS_LIMIT);
            break;
        case ChartUnit.WEEK:
            dates = generateWeeks(STACK_GRAPH_MONTHS_LIMIT);
            break;
        case ChartUnit.DAY:
            dates = generateDays(STACK_GRAPH_MONTHS_LIMIT);
            break;
        default:
            dates = generateWeeks(STACK_GRAPH_MONTHS_LIMIT);
            break;
    }
    return getGuardianChartData(unit, selectedGuardian);
};

export const getGuardianByAddress = (guardians?: Guardian[], address?: string): Guardian | undefined => {
    if (!guardians || !address) return;
    const guardian = guardians.filter((g: Guardian) => {
        return g.address.toLowerCase() === address.toLowerCase();
    })[0];

    return guardian;
};

export const getGuardianByName = (guardians?: Guardian[], name?: string): string | undefined => {
    if (!guardians || !name) return;
    const guardian = guardians.filter((g: Guardian) => {
        return g.name === name;
    })[0];
    return guardian.address;
};

export const filterGuardians = (list: Guardian[], value: string) => {
    if (!value || !list) return list || [];
    const filtered = list.filter((guardian: Guardian) => {
        const { name, address } = guardian;
        const string = `${name} ${address}`;
        return string.toLowerCase().indexOf(value.toLowerCase()) > -1;
    });
    return filtered || [];
};

export const getGuardiansRewardActions = (actions?: GuardianAction[]) => {
    const arr = [
        GuardianActionsTypes.CLAIM_GUARDIAN_REWARDS,
        GuardianActionsTypes.DELEGATOR_STAKING_REWARDS_CLAIMED,
        GuardianActionsTypes.BOOTSTRAP_REWARDS_WITHDREW,
        GuardianActionsTypes.FEES_WITHDRAWN
    ];
    if (!actions) return [];
    return actions.filter((action: GuardianAction) => {
        const { event } = action;
        if (arr.includes(event as GuardianActionsTypes)) {
            return actions;
        }
    });
};

export const generateGuardiansActionColors = (type: GuardianActionsTypes): string => {
    switch (type) {
        case GuardianActionsTypes.STAKED:
        case GuardianActionsTypes.RESTAKED:
            return 'green';
        case GuardianActionsTypes.UNSTAKED:
        case GuardianActionsTypes.WITHDREW:
            return 'red';
        case GuardianActionsTypes.CLAIM_GUARDIAN_REWARDS:
        case GuardianActionsTypes.DELEGATOR_STAKING_REWARDS_CLAIMED:
        case GuardianActionsTypes.BOOTSTRAP_REWARDS_WITHDREW:
        case GuardianActionsTypes.FEES_WITHDRAWN:
            return 'black';
        default:
            return 'black';
    }
};

export const generateGuardiansCurrentStake = (event: GuardianActionsTypes, currentStake?: number) => {
    switch (event) {
        case GuardianActionsTypes.STAKED:
        case GuardianActionsTypes.RESTAKED:
        case GuardianActionsTypes.UNSTAKED:
        case GuardianActionsTypes.WITHDREW:
            return convertToString(currentStake, '0');
        default:
            return '-';
    }
};

export const generateGuardiansActionIcon = (event: GuardianActionsTypes): string | undefined => {
    switch (event) {
        case GuardianActionsTypes.BOOTSTRAP_REWARDS_WITHDREW:
            return DAItoken;
        default:
            break;
    }
};

export const getGuardianName = (guardians?: Guardian[], address?: string): string | null => {
    if (!address) return null;
    const guardian = getGuardianByAddress(guardians, address);
    if (!guardian) return null;
    return `${guardian.name} (${guardian.address})`;
};


export const getGuardianNameFromChart = async (i: any, ref?: any) => {
    var activeElement = ref.current.chartInstance.getElementAtEvent(i);
    if (!activeElement[0]) return;
    const name = activeElement[0]._view.datasetLabel;
    return name
    // const address = getGuardianByName(guardians, name);
    // if (!address) return;
    // await ref.current.chartInstance.clear();
    // history.push(routes.guardians.stake.replace(':address', address));
};