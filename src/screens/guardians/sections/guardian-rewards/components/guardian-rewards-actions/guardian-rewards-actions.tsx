import { GuardianAction } from '@orbs-network/pos-analytics-lib';
import React from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { GuardianRewardAction } from './guardian-reward-action';
import './guardian-rewards-actions.scss';
import { getGuardiansRewardActions } from 'utils/guardians';
import { ListMaterial } from 'components/list/list-material';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import { useIsMobileViewport } from 'hooks/useViewport';
export const GuardianRewardsActions = () => {
    const isMobile = useIsMobileViewport();
    const { selectedGuardian, guardianIsLoading } = useSelector((state: AppState) => state.guardians);
    const { t } = useTranslation();
    const titles = [
        t('main.action'),
        t('main.sum'),
        `${t('main.block')} #`,
        `Time (${t('main.gmt')}+${moment(moment().utcOffset()).format('H')})`
    ];

    const noData = !selectedGuardian && !guardianIsLoading;
    return noData ? null : (
        <div className="guardian-rewards-actions">
            <LoadingComponent
                isLoading={guardianIsLoading}
                listElementAmount={4}
                loaderType={LoaderType.LIST}
                listLength={3}>
                <ListMaterial titles={titles} titleClassName="list-titles" listHeaderBg={isMobile ? 'transparent' : "#F7F7F7"}>
                    {selectedGuardian &&
                        getGuardiansRewardActions(selectedGuardian.actions).map(
                            (action: GuardianAction, key: number) => {
                                return <GuardianRewardAction action={action} key={key} />;
                            }
                        )}
                </ListMaterial>
            </LoadingComponent>
        </div>
    );
};
