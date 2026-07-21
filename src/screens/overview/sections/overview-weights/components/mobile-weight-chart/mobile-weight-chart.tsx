import React, { useEffect, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { PosOverviewData, PosOverviewSlice } from 'pos-analytics-graph';
import { generateDoghnutDataset, getDoughnutWeightChartData } from 'utils/overview/doghnut-chart';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import moment from 'moment';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import { DaysSelector } from 'components/days-selector/days-selector';
import { SelectedGuardian } from 'screens/overview/sections/parts/selected-guardian/selected-guardian';

export const MobileWeightChart = () => {
    const ref = useRef<any>(null);
    const { guardiansColors } = useSelector((state: AppState) => state.guardians);
    const { overviewData } = useSelector((state: AppState) => state.overview);
    const [rawData, setRawData] = useState<PosOverviewSlice | null>(null);
    const [selected, setSelected] = useState<null | PosOverviewData>(null);
    useEffect(() => {
        createChartDataset(moment().toDate());
    }, []);

    const createChartDataset = (date: Date) => {
        const newRawData = getDoughnutWeightChartData(date, overviewData);
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
        const guardian = rawData.data.filter((m: PosOverviewData) => m.name === name)[0];
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
    const getGuardianPercent = () => {
        if(!rawData || !selected) return '';
            const result = (selected?.weight / rawData?.total_weight) * 100
            return `${result.toFixed(2)} %`
    }
    const chartData = rawData && generateDoghnutDataset(rawData.data, guardiansColors);
    return (
        <div className="mobile-overview-chart">
           
                <div className="mobile-overview-chart-title flex-center">
                    <h5 className="mobile-overview-chart-title-name">Overall stats</h5>
                    <DaysSelector selectDate={createChartDataset} />
                </div>
                <div className="mobile-overview-chart-chart">
                <LoadingComponent isLoading={!chartData} loaderType={LoaderType.BIG}>
                    <Doughnut data={chartData} ref={ref} options={options} />
                    <SelectedGuardian selected={selected} value = {getGuardianPercent()}/>
                    </LoadingComponent>
                </div>
            
        </div>
    );
};
