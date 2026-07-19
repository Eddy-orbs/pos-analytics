import React, { useEffect, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { PosOverviewData } from '@orbs-network/pos-analytics-lib';
import {
    generateDoghnutDataset,
    getDoughnutStakeChartData,
    getLatestOverviewDate
} from 'utils/overview/doghnut-chart';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import { DaysSelector } from '../../../../../../components/days-selector/days-selector';
import { SelectedGuardian } from '../../../parts/selected-guardian/selected-guardian';
import './mobile-stake-chart.scss';
import { convertToString } from 'utils/number';

export const MobileStakeChart = () => {
    const ref = useRef<any>(null);
    const { guardiansColors } = useSelector((state: AppState) => state.guardians);
    const { overviewData } = useSelector((state: AppState) => state.overview);
    const [rawData, setRawData] = useState<PosOverviewData[] | null>(null);
    const [selected, setSelected] = useState<null | PosOverviewData>(null);
    const latestDate = getLatestOverviewDate(overviewData);

    useEffect(() => {
        const initialDate = getLatestOverviewDate(overviewData);
        const initialRawData = initialDate ? getDoughnutStakeChartData(initialDate, overviewData) : null;
        if (!initialRawData) return;
        setRawData(initialRawData);
        setSelected(null);
    }, [overviewData]);

    const createChartDataset = (date: Date) => {
        const newRawData = getDoughnutStakeChartData(date, overviewData);
        if (!newRawData) return;
        setRawData(newRawData);
        setSelected(null);
    };

    const selectGuardian = (i: any) => {
        const activeElement = ref.current.chartInstance.getElementAtEvent(i);
        if (!activeElement[0]) return;
        // eslint-disable-next-line no-underscore-dangle
        const name = activeElement[0]._view.label;
        if (!rawData) return;
        const guardian = rawData.filter((m: PosOverviewData) => m.name === name)[0];
        setSelected(guardian);
    };

    const options = {
        maintainAspectRatio: false,
        responsive: true,
        tooltips: {
            enabled: false
        },
        legend: {
            display: false
        },
        cutoutPercentage: 80,
        onClick: (e: any) => selectGuardian(e)
    };

    const chartData = generateDoghnutDataset(rawData, guardiansColors);
    return (
        <div className="mobile-overview-chart">
            <div className="mobile-overview-chart-title flex-center">
                <h5 className="mobile-overview-chart-title-name">Overall stats</h5>
                <DaysSelector selectDate={createChartDataset} initialDate={latestDate} />
            </div>
            <div className="mobile-overview-chart-chart">
                <LoadingComponent isLoading={!chartData} loaderType={LoaderType.BIG}>
                    <Doughnut data={chartData} ref={ref} options={options} />
                    <SelectedGuardian selected={selected} value={convertToString(selected?.effective_stake)} />
                </LoadingComponent>
            </div>
        </div>
    );
};
