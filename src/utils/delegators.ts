import { DelegatorAction } from '@orbs-network/pos-analytics-lib';
import { TFunction } from 'i18next';
import { DelegatorActionsTypes, DelegatorsSections } from '../global/enums';
import { MenuOption } from '../global/types';
import { routes } from '../routes/routes';
import { convertToString } from './number';

export const generateDelegatorsRoutes = (t: TFunction, address: string): MenuOption[] => {
    return [
        {
            name: t('main.stake'),
            route: routes.delegators.stake.replace(':address?', address),
            key: DelegatorsSections.STAKE
        }
    ];
};

export const generateDelegatorsActionColors = (event: DelegatorActionsTypes) => {
    switch (event) {
        case DelegatorActionsTypes.STAKED:
        case DelegatorActionsTypes.RESTAKED:
            return 'green';
        case DelegatorActionsTypes.UNSTAKED:
        case DelegatorActionsTypes.WITHDREW:
            return 'red';
        case DelegatorActionsTypes.CLAIMED:
            return 'black';
        default:
            break;
    }
};

export const generateDelegatorsCurrentStake = (event: DelegatorActionsTypes, currentStake?: number) => {
    switch (event) {
        case DelegatorActionsTypes.STAKED:
        case DelegatorActionsTypes.RESTAKED:
        case DelegatorActionsTypes.UNSTAKED:
        case DelegatorActionsTypes.WITHDREW:
            return convertToString(currentStake, '0');
        default:
            return convertToString(currentStake, '-');
    }
};

export const getDelegatorRewardActions = (actions?: DelegatorAction[]) => {
    if (!actions) return [];
    return actions.filter((action: DelegatorAction) => action.event === DelegatorActionsTypes.CLAIMED);
};
