import React, { useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { ChartColors } from 'global/enums';
import { ChartData } from 'global/types';
import { generateDatasets, getLineChartBaseSettings } from 'utils/chart';
import { useIsMobileViewport } from 'hooks/useViewport';
interface StateProps {
    chartData: ChartData;
}

export const Chart = ({ chartData }: StateProps) => {
    const ref = useRef<any>(null)
    const isMobile = useIsMobileViewport();
    const { t } = useTranslation();
    const data = {
        datasets: generateDatasets(chartData)
    };


    const options = getLineChartBaseSettings(chartData.unit,ref, t, isMobile);
    return options ? (
        <div className="line-chart">
            <div className="line-chart-text line-chart-text-left">
                <p className="one-line" style={{ color: ChartColors.DELEGATORS }}>
                    {t('guardians.delegatedStake', 'Delegated stake')}
                </p>
            </div>
            <Line data={data} options={options} ref = {ref} />
            <div className="line-chart-text line-chart-text-right flex-center">
                <p className="one-line" style={{ color: ChartColors.TOTAL_STAKE }}>
                    {`${t('guardians.totalDelegation')}`}
                </p>
                <small>{`&`}</small>
                <p className="one-line" style={{ color: ChartColors.SELF_STAKE }}>{`${t('guardians.ownDelegation')}`}</p>
            </div>
        </div>
    ) : null;
};
