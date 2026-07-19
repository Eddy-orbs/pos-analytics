import React, { useRef } from 'react'
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { ChartData } from 'global/types';
import { generateDatasets, getLineChartBaseSettings } from 'utils/chart';
import { useIsMobileViewport } from 'hooks/useViewport';

interface StateProps {
    chartData: ChartData;
}

export const Chart = ({ chartData }: StateProps) => {
    const ref = useRef<any>(null);
    const isMobile = useIsMobileViewport();
    const {t} = useTranslation()
    const data = {
        datasets: generateDatasets(chartData)
    };
    const options = getLineChartBaseSettings(chartData.unit, ref, t, isMobile);
    return <Line data={data} options={options} ref={ref} />;
};
