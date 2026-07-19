import React from 'react';
import { routes } from '../../routes/routes';
import { Redirect, Route, useParams } from 'react-router-dom';
import { DelegatorsStake } from './sections/delegators-stake/delegators-stake';
import { DelegatorSearch } from './components/delegator-search/delegator-search';
import { RouteParams } from '../../global/types';
import { generateDelegatorsRoutes } from '../../utils/delegators';
import { useTranslation } from 'react-i18next';
import { SectionMenu } from '../../components/section-menu/section-menu';
import './delegators.scss';
import { CheckDelegatorAddress } from './sections/delegators-stake/components/check-delegator-address/check-delegator-address';

const DelegatorsComponent = () => {
  const params: RouteParams = useParams();
  const { address } = params;
  const { t } = useTranslation();
  return (
    <div className="delegators screen">
      <div className="delegators-top">
        <div className="component-wrapper">
          <DelegatorSearch />
        </div>
      </div>
      <div className="screen-section">
        <SectionMenu options={generateDelegatorsRoutes(t, address || '')} />
        <div className="screen-section-container">
          <Route
            path={routes.delegators.stake}
            render={() => <DelegatorsStake />}
          />
          <Route
            path={routes.delegators.rewards}
            render={() => <Redirect to={routes.delegators.stake.replace(':address?', address || '')} />}
          />
          <Route
            path={routes.delegators.actions}
            render={() => <Redirect to={routes.delegators.stake.replace(':address?', address || '')} />}
          />
          <CheckDelegatorAddress addressParam={address} />
        </div>
      </div>
    </div>
  );
};

export const Delegators = React.memo(DelegatorsComponent);
