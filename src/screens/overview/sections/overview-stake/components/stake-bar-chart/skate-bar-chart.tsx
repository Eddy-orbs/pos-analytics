import React, { useEffect, useRef } from 'react';
import { TimeRangeSelector } from 'components/date-format-picker/time-range-selector';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { NoData } from 'components/no-data/no-data';
import { ChartUnit, LoaderType, OverviewChartType } from 'global/enums';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { setOverviewStakeChartData } from 'redux/actions/actions';
import { AppState } from 'redux/types/types';
import { getBarChartConfigOptions } from 'utils/bar-chart';
import { getStakeChartData } from 'utils/overview/stake-chart';

export const StakeBarChart = () => {
    const dispatch = useDispatch();

    const { overviewData, overviewStakeChartData, overviewDataLoding } = useSelector(
        (state: AppState) => state.overview
    );
    const { guardiansColors } = useSelector((state: AppState) => state.guardians);
    const { t } = useTranslation();

    useEffect(() => {
        if (overviewData && !overviewStakeChartData) {
            const data = getStakeChartData(ChartUnit.WEEK, overviewData, guardiansColors);
            dispatch(setOverviewStakeChartData(data));
        }
    }, [dispatch, guardiansColors, overviewData, overviewStakeChartData]);

    const selectChartData = (unit: ChartUnit) => {
        const data = getStakeChartData(unit, overviewData, guardiansColors);
        dispatch(setOverviewStakeChartData(data));
    };

    const noData = !overviewData && !overviewDataLoding;

    return noData ? (
        <NoData />
    ) : (
        <div className="overview-chart-panel">
            <LoadingComponent isLoading={!overviewStakeChartData} loaderType={LoaderType.BIG}>
                {overviewStakeChartData && (
                    <>
                        <header className="flex-between">
                            <h4 className="capitalize">{t('overview.graphText')}</h4>
                            <TimeRangeSelector
                                selected={overviewStakeChartData.unit}
                                selectCallBack={selectChartData}
                                unitsToHide={[ChartUnit.MONTH]}
                            />
                        </header>
                        <div className="bar-chart">
                            <BarComponent chartData={overviewStakeChartData} total={overviewData?.total_stake} />
                        </div>
                    </>
                )}
            </LoadingComponent>
        </div>
    );
};

interface StateProps {
    chartData: any;
    total?: number;
}
const BarComponent = ({ chartData, total }: StateProps) => {
    const ref = useRef<any>(null);
    const { t } = useTranslation();
    const goToGuardian = () => {};
    const options = getBarChartConfigOptions(
        OverviewChartType.STAKE,
        goToGuardian,
        ref,
        t,
        chartData.unit,
        chartData.guardianDatasets.totalObject
    );
    const barChartData = {
        datasets: chartData.data
    };

    return <Bar data={barChartData} options={options} ref={ref} />;
};
