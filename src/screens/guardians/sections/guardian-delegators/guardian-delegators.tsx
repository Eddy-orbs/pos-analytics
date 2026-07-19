import React, { useEffect } from 'react';
import { GuardianDelegatorPageItem } from '@orbs-network/pos-analytics-lib';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import {
  cancelGuardianDelegatorsRequest,
  getGuardianDelegatorsKey,
  loadGuardianDelegatorsPage,
} from 'redux/actions/guardians-actions';
import { NoData } from 'components/no-data/no-data';
import './guardian-delegators.scss';
import { GuardianDelegatorElement } from './components/guardian-delegator/guardian-delegator';
import { useTranslation } from 'react-i18next';
import { ListMaterial } from 'components/list/list-material';
import { useIsMobileViewport } from 'hooks/useViewport';

export const GuardianDelegators = () => {
  const dispatch = useDispatch();
  const {
    guardianCurrent,
    guardianIsLoading,
    delegatorsByKey,
  } = useSelector(
    (state: AppState) => state.guardians
  );
  const { chain, web3 } = useSelector((state: AppState) => state.main);
  const { t } = useTranslation();
  const isMobile = useIsMobileViewport();
  const address = guardianCurrent && guardianCurrent.address;
  const key = address ? getGuardianDelegatorsKey(chain, address) : undefined;
  const entry = key ? delegatorsByKey[key] : undefined;

  useEffect(() => {
    if (!address || !key || !web3) return undefined;
    dispatch(loadGuardianDelegatorsPage(address, web3));
    return () => {
      dispatch(cancelGuardianDelegatorsRequest(key));
    };
  }, [address, chain, dispatch, key, web3]);

  const titles = [
    isMobile ? t('main.address') : t('guardians.delegatorsAddress'),
    t('guardians.stake'),
    t('guardians.nonStakedBalance'),
  ];

  const retry = () => {
    if (!address || !web3) return;
    const cursor = entry && entry.items.length > 0 ? entry.nextCursor : undefined;
    dispatch(loadGuardianDelegatorsPage(address, web3, cursor));
  };

  const loadMore = () => {
    if (!address || !web3 || !entry || !entry.nextCursor) return;
    dispatch(loadGuardianDelegatorsPage(address, web3, entry.nextCursor));
  };

  const currentNotFound = !guardianIsLoading && !guardianCurrent;
  const initialLoading = guardianIsLoading || (!!address && (!entry || (entry.status === 'loading' && entry.items.length === 0)));
  const empty = !!entry && entry.status === 'loaded' && entry.items.length === 0;
  const initialError = !!entry && entry.status === 'error' && entry.items.length === 0;

  return currentNotFound ? (
    <NoData />
  ) : (
    <div className="guardian-delegators-list">
      {initialError ? (
        <div className="guardian-delegators-feedback">
          <NoData customMessage={entry && entry.error} />
          <button type="button" onClick={retry}>Retry</button>
        </div>
      ) : empty ? (
        <NoData />
      ) : (
        <>
          <ListMaterial
            titles={titles}
            titleClassName="list-titles"
            listClassName="guardian-delegators-table"
            listHeaderBg="#F7F7F7"
            isLoading={initialLoading}
            loadingRows={5}
          >
            {entry
              ? entry.items.map((delegator: GuardianDelegatorPageItem) => (
                <GuardianDelegatorElement
                  delegator={delegator}
                  key={delegator.address}
                />
                ))
              : null}
          </ListMaterial>
          {entry && entry.status === 'error' ? (
            <div className="guardian-delegators-feedback guardian-delegators-feedback-inline">
              <p>{entry.error}</p>
              <button type="button" onClick={retry}>Retry</button>
            </div>
          ) : null}
          {entry && entry.nextCursor && entry.status !== 'error' ? (
            <div className="guardian-delegators-pagination">
              <button type="button" onClick={loadMore} disabled={entry.status === 'loading'}>
                {entry.status === 'loading' ? 'Loading…' : 'Load more'}
              </button>
              <p>{`${entry.items.length} / ${entry.total}`}</p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};
