import React, { useEffect, useRef, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { PosOverview, PosOverviewData } from 'pos-analytics-graph';
import { OverviewChartType } from '../../global/enums';
import './doughnat-chart.scss';
import { getDoughnutChartData } from 'utils/overview/doghnut-chart';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import moment from 'moment';

interface StateProps {
    chartData: PosOverview;
    total?: number;
    chartType: OverviewChartType;
}

interface Result {
    data: number[];
    labels: string[];
    backgroundColor: string[];
}
export const DoughnatChart = ({ chartData }: StateProps) => {
    const ref = useRef<any>(null);
    const { guardiansColors } = useSelector((state: AppState) => state.guardians);
    const [myData, setData] = useState<Result | null>(null);
    const [rawData, setRawData] = useState<any>(null);
    const [selected, setSelected] = useState<any>(null);
    useEffect(() => {
        const newData = getDoughnutChartData(moment(), chartData);
        if(!guardiansColors) return 
        setRawData(newData);
        const labels = newData.map((m: PosOverviewData) => m.name);
        const data = newData.map((m: PosOverviewData) => m.effective_stake);
        const backgroundColor = newData.map((m: PosOverviewData) => guardiansColors[m.address]) ;
        const result = {
            labels,
            data,
            backgroundColor
        };
        setData(result);
    }, []);

    const data = {
        labels: myData?.labels,
        datasets: [
            {
                data: myData?.data,
                backgroundColor: myData?.backgroundColor,
                hoverBackgroundColor: myData?.backgroundColor,
                borderWidth: 0,
                weight: 2
            }
        ]
    };
    const goToGuardianPage = (i: any) => {
        var activeElement = ref.current.chartInstance.getElementAtEvent(i);
        if (!activeElement[0]) return;
        const name = activeElement[0]._view.label;
        const guardian = rawData.filter((m: any) => m.name === name)[0];
        setSelected(guardian);
    };

    const options = {
        legend: {
            display: false
        },
        cutoutPercentage: 70,
        onClick: (e: any) => goToGuardianPage(e)
    };
    return (
        <div className="doughnat">
            <Doughnut data={data} ref={ref} options={options} />
        </div>
    );
};
