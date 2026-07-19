import React from 'react';
import { useIsMobileViewport } from 'hooks/useViewport';
import {DelegatorRewardsTopMobile} from './mobile/delegator-rewards-top-mobile';
import {DelegatorRewardsTopDesktop} from './desktop/delegator-rewards-top-desktop'
import './delegator-rewards-top.scss';

export const DelegatorRewardsTop = () => {
    const isMobile = useIsMobileViewport();

    return (
        isMobile ? <DelegatorRewardsTopMobile /> : <DelegatorRewardsTopDesktop />
    )
};
