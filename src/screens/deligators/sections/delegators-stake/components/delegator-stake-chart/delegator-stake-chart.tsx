import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { TimeRangeSelector } from 'components/date-format-picker/time-range-selector';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { ChartColors, ChartUnit, LoaderType } from 'global/enums';
import { cancelDelegatorHistoryRequest, loadDelegatorHistory } from 'redux/actions/actions';
import { AppState } from 'redux/types/types';
import { buildDelegatorDetailChartData } from 'utils/detail-chart-data';
import { Chart } from './chart';
import './delegator-stake-chart.scss';



export const DelegatorStakeChart = () => {
    const dispatch = useDispatch();
    const {
        delegatorCurrent,
        delegatorIsLoading,
        activeDelegatorKey,
        activeDelegatorHistoryUnit,
        historyByKey
    } = useSelector(
        (state: AppState) => state.delegator
    );
    const { web3 } = useSelector((state: AppState) => state.main);
    const { t } = useTranslation();

    const historyEntry = activeDelegatorKey
        ? historyByKey[`${activeDelegatorKey}:${activeDelegatorHistoryUnit}`]
        : undefined;
    const history = historyEntry && historyEntry.status === 'loaded' ? historyEntry.data : undefined;
    const delegatorChartData = delegatorCurrent && history
        ? buildDelegatorDetailChartData(history, delegatorCurrent, activeDelegatorHistoryUnit)
        : undefined;
    const delegatorAddress = delegatorCurrent && delegatorCurrent.address;

    useEffect(() => {
        if (!delegatorAddress || !web3) return;
        dispatch(loadDelegatorHistory(delegatorAddress, web3, activeDelegatorHistoryUnit));
    }, [activeDelegatorHistoryUnit, delegatorAddress, dispatch, web3]);

    useEffect(() => {
        return () => {
            dispatch(cancelDelegatorHistoryRequest());
        };
    }, [dispatch]);

    const selectChartData = (unit: ChartUnit) => {
        if (!delegatorCurrent || !web3 || (unit !== ChartUnit.WEEK && unit !== ChartUnit.MONTH)) return;
        dispatch(loadDelegatorHistory(delegatorCurrent.address, web3, unit));
    };
    const noData = !delegatorIsLoading && !delegatorCurrent;
    const historyLoading = !!delegatorCurrent && (
        !historyEntry || historyEntry.status === 'idle' || historyEntry.status === 'loading'
    );
    const historyError = historyEntry && historyEntry.status === 'error'
        ? historyEntry.error || t('main.loadFailed')
        : undefined;
    return (
        noData ? null : <div className="delegator-stake-chart">
            <LoadingComponent
                loaderType={LoaderType.BIG}
                isLoading={delegatorIsLoading || historyLoading}
            >
                {delegatorChartData ? (
                    <>
                        <header className="flex-between">
                            <div>
                                <h4>{t('delegators.stakeChangeOverTime')}</h4>
                                <div className="delegator-chart-series flex-start-center">
                                    <span style={{ background: ChartColors.TOTAL_STAKE }} />
                                    <p>{t('main.stake')}</p>
                                    <span style={{ background: ChartColors.SELF_STAKE }} />
                                    <p>{t('guardians.cooldown')}</p>
                                </div>
                            </div>
                            <TimeRangeSelector
                                selected={delegatorChartData.unit}
                                selectCallBack={selectChartData}
                                unitsToHide={[ChartUnit.DAY]}
                            />
                        </header>
                        <div className="line-chart">
                            <Chart chartData={delegatorChartData} />
                        </div>
                    </>
                ) : historyError ? (
                    <div className="delegator-stake-chart-feedback flex-column">
                        <p>{historyError}</p>
                        <button type="button" onClick={() => selectChartData(activeDelegatorHistoryUnit)}>
                            {t('main.retry')}
                        </button>
                    </div>
                ) : null}
            </LoadingComponent>
        </div>
    );
};
