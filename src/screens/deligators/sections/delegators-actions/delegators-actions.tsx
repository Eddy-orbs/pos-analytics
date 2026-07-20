import React from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import moment from 'moment';
import { DelegatorAction } from 'pos-analytics-graph';
import { DelegatorActionElement } from './components/delegator-action';
import { NoData } from 'components/no-data/no-data';
import { useTranslation } from 'react-i18next';
import { ListMaterial } from 'components/list/list-material';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import './delegators-actions.scss';
import { isMobile } from 'react-device-detect';

export const DeligatorsActions = () => {
  const { selectedDelegator, delegatorIsLoading } = useSelector(
    (state: AppState) => state.delegator
  );
  const { t } = useTranslation();
  const titles = [
    t('main.action'),
    isMobile ? t('main.sum') : t('main.amount'),
    isMobile ? t('main.current') : t('main.currentStake'),
    `${t('main.block')} #`,
  ];

  if (!isMobile) {
    titles.push(
      `${t('main.time')} (${t('main.gmt')}+${moment(
        moment().utcOffset()
      ).format('H')})`
    );
  }

  const noData = !delegatorIsLoading && !selectedDelegator;
  return noData ? (
    <NoData />
  ) : (
    <div className="delegators-actions">
      <LoadingComponent
        isLoading={delegatorIsLoading}
        listElementAmount={5}
        loaderType={LoaderType.LIST}
      >
        <ListMaterial
          titles={titles}
          titleClassName="list-titles"
          listHeaderBg="#F7F7F7"
        >
          {selectedDelegator &&
            selectedDelegator.actions.map(
              (action: DelegatorAction, key: number) => {
                return <DelegatorActionElement action={action} key={key} />;
              }
            )}
        </ListMaterial>
      </LoadingComponent>
    </div>
  );
};
