import React from 'react';
import { DelegatorStakeChart } from './components/delegator-stake-chart/delegator-stake-chart';
import { DelegatorsStakeBalance } from './components/delegators-stake-balance/delegators-stake-balance';

import './delegators-stake.scss';

export const DelegatorsStake = () => {
  return (
    <div className="delegators-stake">
      <DelegatorsStakeBalance />
      <DelegatorStakeChart />
    </div>
  );
};
