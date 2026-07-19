import { DelegatorAction } from '@orbs-network/pos-analytics-lib';
import React from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { DelegatorRewardAction } from './components/delegator-reward-actions/delegator-reward-action';
import { getDelegatorRewardActions } from 'utils/delegators';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { ListMaterial } from 'components/list/list-material';
import { LoaderType } from 'global/enums';
import { useIsMobileViewport } from 'hooks/useViewport';

import './delegator-rewards-actions.scss';

export const DelegatorRewardsActions = () => {
    const isMobile = useIsMobileViewport();
    const { selectedDelegator, delegatorIsLoading } = useSelector((state: AppState) => state.delegator);
    const { t } = useTranslation();
    const titles = [
        t('main.action'),
        t('main.sum'),
        `${t('main.block')} #`,
        `Time (${t('main.gmt')}+${moment(moment().utcOffset()).format('H')})`
    ];
    return !selectedDelegator && !delegatorIsLoading ? null : (
        <div className="delegators-rewards-actions">
            <LoadingComponent
                isLoading={delegatorIsLoading}
                listElementAmount={4}
                loaderType={LoaderType.LIST}
                listLength={3}>
                <ListMaterial titles={titles} titleClassName="list-titles" listHeaderBg={isMobile ? 'transparent' : "#F7F7F7"} listClassName='reward-list'>
                    {selectedDelegator &&
                        getDelegatorRewardActions(selectedDelegator.actions).map(
                            (action: DelegatorAction, key: number) => {
                                return <DelegatorRewardAction action={action} key={key} />;
                            }
                        )}
                </ListMaterial>
            </LoadingComponent>
        </div>
    );
};
