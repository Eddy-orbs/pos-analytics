import { Guardian } from 'pos-analytics-graph';
import { BlockRef } from 'redux/types/main-types';
import { CHAINS } from 'types';
import { getChainConfig } from 'utils/chain';
import { getGuardianColor } from 'utils/overview/overview';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import { types } from '../types/types';
import { getAvgBlockTime, getRefBlock } from './utils';

export const getGuardianAction = (address: string, web3: any, blockRef: BlockRef) => async (dispatch: any, getState: any) => {
    
    dispatch(resetguardian());
    const guardian = await api.getGuardianApi(address, web3, blockRef);
    if (!guardian) return dispatch(setGuardianNotFound(true));

    // get reference block for calculating estimated block time
    const refBlock = await getRefBlock(web3, guardian.actions[0].block_number);
    const avgBlockTime = await getAvgBlockTime(web3, refBlock);

    guardian.actions = guardian.actions.map((action: any) => {
        return {
            ...action,
            block_time: refBlock.time + Math.round((action.block_number - refBlock.number) * avgBlockTime)
        };
    });

    dispatch(setGuardianLoading(false));
    dispatch({
        type: types.GUARDIAN.SET_GUARDIAN,
        payload: guardian
    });
};

export const getGuardiansAction = (chain: CHAINS) => async (dispatch: any) => {
    const {node} = getChainConfig(chain)
    const guardians = await api.getGuardiansApi(node);
    if (!guardians) return null;
    const guardiansColors: { [id: string]: string } = {};
    guardians
        .sort((a, b) => b.effective_stake - a.effective_stake)
        .forEach((guardian: Guardian, index: number) => {
            guardiansColors[guardian.address] = getGuardianColor(index);
        });
    return dispatch({
        type: types.GUARDIAN.SET_GUARDIANS,
        payload: { guardians, guardiansColors }
    });
};

export const setGuardianLoading = (value: boolean) => async (dispatch: any) => {
    return dispatch({
        type: types.GUARDIAN.GUARDIAN_LOADING,
        payload: value
    });
};

export const setGuardianNotFound = (value: boolean) => async (dispatch: any) => {
    return dispatch({
        type: types.GUARDIAN.GUARDIAN_NOT_FOUND,
        payload: value
    });
};

export const setGuardianChartData = (chartData: ChartData | undefined) => async (dispatch: any) => {
    return dispatch({
        type: types.GUARDIAN.SET_GUARDIAN_CHART_DATA,
        payload: chartData
    });
};

export const resetguardian = () => async (dispatch: any) => {
    return dispatch({
        type: types.GUARDIAN.RESET_GUARDIAN
    });
};
