import {  DelegatorInfo } from 'pos-analytics-graph';
import { Dispatch } from 'redux';
import { BlockRef } from 'redux/types/main-types';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import { types } from '../types/types';
import {getAvgBlockTime, getRefBlock} from "./utils";

export const findDelegatorAction = (address: string, web3: any, blockRef: BlockRef) => async (dispatch: any) => {
    dispatch(resetDelegator());
    const delegator = await api.getDelegatorApi(address, web3, blockRef);
    if (!delegator) {
        return dispatch(delegatorNotFound(true));
    }
    // get reference block for calculating estimated block time
    const refBlock = await getRefBlock(web3, delegator.actions[0].block_number);
    const avgBlockTime = await getAvgBlockTime(web3, refBlock);

    delegator.actions = delegator.actions.map((action: any) => {
        return {
            ...action,
            block_time: refBlock.time + Math.round((action.block_number - refBlock.number) * avgBlockTime)
        };
    });
    dispatch(setDelegatorLoading(false));
    dispatch(setDelegator(delegator));
};

const setDelegator = (delegator: DelegatorInfo) => async (dispatch: any) => {
    dispatch({
        type: types.DELEGATOR.SET_DELEGATOR,
        payload: delegator
    });
};

export const setDelegatorLoading = (value: boolean) => async (dispatch: any) => {
    return dispatch({
        type: types.DELEGATOR.DELEGATOR_LOADING,
        payload: value
    });
};

export const delegatorNotFound = (value: boolean) => async (dispatch: any) => {
    return dispatch({
        type: types.DELEGATOR.DELEGATOR_NOT_FOUND,
        payload: value
    });
};

export const setDelegatorChartData = (chartData: ChartData | undefined) => async (dispatch: Dispatch<any>) => {
    return dispatch({
        type: types.DELEGATOR.SET_DELEGATOR_CHART_DATA,
        payload: chartData
    });
};

export const resetDelegator = () => async (dispatch: any) => {
    return dispatch({
        type: types.DELEGATOR.RESET_DELEGATOR
    });
};
