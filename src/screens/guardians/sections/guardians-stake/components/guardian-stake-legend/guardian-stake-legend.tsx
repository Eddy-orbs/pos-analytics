import React from 'react'
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { ChartColors, LoaderType } from 'global/enums';
import { AppState } from 'redux/types/types';

import './guardian-stake-legend.scss';

interface Legend {
    name: string;
    background: ChartColors;
}

export const GuardianStakeLegend = () => {
    const {
        guardianCurrent,
        guardianIsLoading,
        activeGuardianKey,
        historyByKey
    } = useSelector(
        (state: AppState) => state.guardians
    );
    const {t} = useTranslation()
    const historyEntry = activeGuardianKey
        ? historyByKey[activeGuardianKey]
        : undefined;
    const countAvailable = !historyEntry || !historyEntry.data ||
        historyEntry.data.data_quality.n_delegates_available === true;
    const legends = [
        {
            name: t('guardians.totalDelegation'),
            background: ChartColors.TOTAL_STAKE
        },
        {
            name: t('guardians.ownDelegation'),
            background: ChartColors.SELF_STAKE
        },
        ...(countAvailable ? [{
            name: `${t('guardians.delegatorsCount', 'Delegators count')}`,
            background: ChartColors.DELEGATORS
        }] : [])
    ];
    const noData = !guardianIsLoading && !guardianCurrent
    return (
        noData ? null  : <section className="guardian-stake-legend">
                {legends.map((legend: Legend) => {
                    const { name, background } = legend;
                    return (
                       <LoadingComponent key = {name} isLoading = {!guardianCurrent} loaderType ={LoaderType.TEXT} >
                            <div  className='flex-start-center'>
                            <figure
                                style={{
                                    background
                                }}></figure>
                            <p className='capitalize'>{name}</p>
                        </div>
                       </LoadingComponent>
                    );
                })}
            </section>
    )
}
