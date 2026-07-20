import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { TimeRangeSelector } from 'components/date-format-picker/time-range-selector';
import { BigLoader } from 'components/loaders/big-loader';
import { NoData } from 'components/no-data/no-data';
import { ChartUnit } from 'global/enums';
import { loadGuardianHistory } from 'redux/actions/actions';
import { doesDetailRangeCover, getDetailHistoryStartTime } from 'redux/actions/detail-history';
import { AppState } from 'redux/types/types';
import { buildGuardianDetailChartData } from 'utils/detail-chart-data';
import { Chart } from './chart';
import './guardian-stake-chart.scss';

export const GuardianStakeChart = () => {
    const dispatch = useDispatch();
    const {
        guardianCurrent,
        guardianIsLoading,
        activeGuardianKey,
        activeGuardianHistoryUnit,
        historyByKey
    } = useSelector(
        (state: AppState) => state.guardians
    );
    const { web3 } = useSelector((state: AppState) => state.main);
    const { t } = useTranslation();

    const historyEntry = activeGuardianKey
        ? historyByKey[activeGuardianKey]
        : undefined;
    const requestedFromTime = guardianCurrent
        ? getDetailHistoryStartTime(activeGuardianHistoryUnit, guardianCurrent.block_time)
        : undefined;
    const rangeAvailable = requestedFromTime !== undefined && doesDetailRangeCover(
        historyEntry,
        requestedFromTime
    );
    const history = rangeAvailable && historyEntry ? historyEntry.data : undefined;
    const guardianChartData = guardianCurrent && history
        ? buildGuardianDetailChartData(history, guardianCurrent, activeGuardianHistoryUnit)
        : undefined;
    const guardianAddress = guardianCurrent && guardianCurrent.address;

    useEffect(() => {
        if (!guardianAddress || !web3) return;
        dispatch(loadGuardianHistory(guardianAddress, web3, activeGuardianHistoryUnit));
    }, [activeGuardianHistoryUnit, dispatch, guardianAddress, web3]);

    const selectChartData = (unit: ChartUnit) => {
        if (!guardianCurrent || !web3 || (
            unit !== ChartUnit.DAY && unit !== ChartUnit.WEEK && unit !== ChartUnit.MONTH
        )) return;
        dispatch(loadGuardianHistory(guardianCurrent.address, web3, unit));
    };
    const noData = !guardianIsLoading && !guardianCurrent;
    const historyError = !rangeAvailable && historyEntry && historyEntry.error
        ? historyEntry.error || t('main.loadFailed')
        : undefined;
    const historyLoading = !!guardianCurrent && !rangeAvailable && !historyError;
    return noData ? null : (
        <div className="guardian-stake-chart">
            <header>
                <h4>{t('delegators.stakeChangeOverTime')}</h4>
                <TimeRangeSelector
                    selected={guardianChartData ? guardianChartData.unit : activeGuardianHistoryUnit}
                    selectCallBack={selectChartData}
                />
            </header>
            <div className="guardian-stake-chart-stage">
                {guardianIsLoading || historyLoading ? (
                    <BigLoader />
                ) : guardianChartData ? (
                    <Chart chartData={guardianChartData} />
                ) : historyError ? (
                    <div className="guardian-stake-chart-feedback flex-column">
                        <p>{historyError}</p>
                        <button type="button" onClick={() => selectChartData(activeGuardianHistoryUnit)}>
                            {t('main.retry')}
                        </button>
                    </div>
                ) : (
                    <NoData />
                )}
            </div>
        </div>
    );
};
