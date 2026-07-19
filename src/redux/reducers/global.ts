import { CHAINS } from 'types';
import { MainState } from '../types/main-types';
import { types } from '../types/types';

const initialState: MainState = {
    chain: CHAINS.ETHEREUM,
    web3: undefined
};

export const mainReducer = (state = initialState, { payload, type }: any): MainState => {
    switch (type) {
       
            case types.SET_INITIAL_CONFIG:
                return {
                    ...state,
                    web3: payload.web3,
                    chain: payload.chain
                };
        default:
            return state;
    }
};
