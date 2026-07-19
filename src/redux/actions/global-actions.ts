import { types } from 'redux/types/types';
import { CHAINS } from 'types';

export const setInitialConfiguration = (chain: CHAINS, web3: any) => async (dispatch: any) => {
    dispatch({
        type: types.SET_INITIAL_CONFIG,
        payload: { web3, chain }
    });
};
