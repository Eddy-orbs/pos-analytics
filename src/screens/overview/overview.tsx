import React, { useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { routes } from '../../routes/routes';
import { OverviewSectionSelector } from './components/overview-section-selector/overview-section-selector';
import { OverviewTop } from './components/overview-top/overview-top';
import { OverviewStakeGuadians } from './components/overview-guardians/overview-guardians';
import { OverviewStake } from './sections/overview-stake/overview-stake';
import { OverviewWeights } from './sections/overview-weights/overview-weights';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { getOverviewAction } from 'redux/actions/actions';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import { NoData } from 'components/no-data/no-data';
import './overview.scss';

export const Overview = () => {
  const { overviewData, overviewDataLoding } = useSelector((state: AppState) => state.overview);
  const { chain, web3 } = useSelector((state: AppState) => state.main);
  
  const dispatch = useDispatch();
  useEffect(() => {    
    if (!overviewData) {
      dispatch(getOverviewAction(chain, web3));
    }
  }, [chain, dispatch, overviewData, web3]);

  return (
    <div className="overview screen">
      <OverviewTop />
      <div className="screen-section">
        <OverviewSectionSelector />
        <div className="screen-section-container">
          <LoadingComponent
            isLoading={overviewDataLoding}
            loaderType={LoaderType.BIG}
          >
            {overviewData ? (
              <div className="overview-flex">
                <Route
                  path={routes.overview.stake}
                  render={() => <OverviewStake />}
                />
                <Route
                  path={routes.overview.weights}
                  render={() => <OverviewWeights />}
                />
                <Route exact path={routes.overview.default}>
                  <Redirect to={routes.overview.stake} />
                </Route>
                <OverviewStakeGuadians />
              </div>
            ) : (
              <NoData />
            )}
          </LoadingComponent>
        </div>
      </div>
    </div>
  );
};
