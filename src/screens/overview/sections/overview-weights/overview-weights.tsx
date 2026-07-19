import React from 'react';
import { OverviewWeightChart } from './components/weight-chart/weight-chart';
import { MobileWeightChart } from './components/mobile-weight-chart/mobile-weight-chart';
import { useIsMobileViewport } from 'hooks/useViewport';

export const OverviewWeights = () => {
  const isMobile = useIsMobileViewport();
  return (
    <div className="overview-chart">
      {isMobile ? <MobileWeightChart /> : <OverviewWeightChart />}
    </div>
  );
};
