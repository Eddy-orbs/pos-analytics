import React from 'react';
import { StakeBarChart } from './components/stake-bar-chart/skate-bar-chart';
import { MobileStakeChart } from './components/mobile-stake-chart/mobile-stake-chart';
import './overview-stake.scss';
import { useIsMobileViewport } from 'hooks/useViewport';

export const OverviewStake = () => {
  const isMobile = useIsMobileViewport();
  return (
    <div className="overview-chart">
      {isMobile ? <MobileStakeChart /> : <StakeBarChart />}
    </div>
  );
};
