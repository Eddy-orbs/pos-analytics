import { TFunction } from 'i18next';
import { ChartUnit, ChartYaxis } from '../global/enums';
import { ChartData, ChartDataset, ChartDatasetObject } from '../global/types';
import { formatNumber } from './number';
import moment from 'moment';
import { TIME_UNIT_FORMAT } from '../global/variables';

export const getGuardiansLineChartSettings = (unit: ChartUnit, ref: any, t: TFunction, isMobile: boolean) => {
    const settings = getLineChartBaseSettings(unit, ref, t, isMobile);
    settings.layout.padding.left = 20;
    settings.layout.padding.right = 20;
    settings.scales.yAxes[0].ticks.callback = function (value: number) {
        return formatNumber(value, '0a').toUpperCase();
    };
    const yAxis: any = {
        id: ChartYaxis.Y2,
        position: 'right',
        display: true,
        gridLines: {
            display: true,
            color: 'rgba(255,99,132,0.2)',
            borderDash: [5],
            zeroLineBorderDash: [5],
            zeroLineColor: 'rgba(255,99,132,0.2)',
            drawBorder: false
        },
        ticks: {
            maxTicksLimit: 7,
            fontSize: isMobile ? 9 : 12,
            fontFamily: 'Montserrat',
            fontColor: '#666666',
            callback: function (value: number) {
                return formatNumber(value, '0.0a').toUpperCase();
            },
            padding: 15
        }
    };
    settings.scales.yAxes.push(yAxis);
    return settings;
};

export const getLineChartBaseSettings = (unit: ChartUnit, ref: any, t: TFunction, isMobile?: boolean) => {
    return {
        maintainAspectRatio: false,
        responsive: true,
        margin: 0,
        type: 'line',
        elements: {
            line: {
                tension: 0
            }
        },
        legend: {
            display: false
        },
        title: {
            display: false
        },
        layout: {
            padding: {
                right: 10,
                bottom: 3,
                left: 0
            }
        },
        animation: {
            duration: 0
        },
        interaction: {
            mode: 'index'
        },

        tooltips: {
            enabled: false,
            animation: 0,
            custom: !isMobile ?  (event: any) => lineChartCustomTooltip(event, ref, t) : null
        },
        scales: {
            xAxes: [
                {
                    distribution: 'linear',
                    type: 'time',
                    time: {
                        unit,
                      
                        displayFormats: {
                            millisecond: TIME_UNIT_FORMAT,
                            second: TIME_UNIT_FORMAT,
                            minute: TIME_UNIT_FORMAT,
                            hour: TIME_UNIT_FORMAT,
                            day: TIME_UNIT_FORMAT,
                            week: TIME_UNIT_FORMAT,
                            month: TIME_UNIT_FORMAT,
                            quarter: TIME_UNIT_FORMAT,
                            year: TIME_UNIT_FORMAT
                        }
                    },
                    scaleLabel: {
                        display: false
                    },
                    gridLines: {
                        tickMarkLength: 10,
                        display: false,
                        drawBorder: false,
                        zeroLineColor: 'rgba(255,99,132,0.2)'
                    },
                    ticks: {
                        callback: function (value: any, index: any, values: any) {
                            const date = values[index].value;
                            return ['|', '', value, moment(date).format('YYYY')];
                        },
                        autoSkip: true,
                        padding: -10,
                        fontSize: isMobile ? 9 : 12,
                        fontFamily: 'Montserrat',
                        fontColor: '#666666'
                    }
                }
            ],
            yAxes: [
                {
                    id: ChartYaxis.Y1,
                    scaleLabel: {
                        display: false,
                        labelString: '',
                        fontSize: isMobile ? 9 : 12,
                        fontFamily: 'Montserrat',
                        fontColor: '#666666'
                    },
                    position: 'left',
                    gridLines: {
                        display: true,
                        color: 'rgba(255,99,132,0.2)',
                        borderDash: [5],
                        zeroLineBorderDash: [5],
                        zeroLineColor: 'rgba(255,99,132,0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        autoskip: true,
                        maxTicksLimit: 7,
                        fontSize: isMobile ? 9 : 12,
                        fontFamily: 'Montserrat',
                        fontColor: '#666666',
                        suggestedMin: 0,
                        callback: function (value: number) {
                            return formatNumber(value, '0.0a').toUpperCase();
                        },
                        padding: 15
                    }
                }
            ]
        }
    };
};

const lineChartBaseStyle = {
    label: '0',
    fill: false,
    lineTension: 0,
    backgroundColor: '',
    borderColor: '',
    borderDash: [],
    borderDashOffset: 0.0,
    pointBorderColor: '',
    pointBackgroundColor: '',
    pointHoverBackgroundColor: '',
    pointHoverBorderColor: '',
    yAxisID: ChartYaxis.Y1,
    pointStyle: 'circle',
    pointRadius: 4,
    pointHitRadius: 5
};

export const chartDatasetObjectComparer = (a: ChartDatasetObject, b: ChartDatasetObject) => {
    return a.x - b.x;
};

export const generateDatasets = ({ datasets }: ChartData) => {
    return datasets.map((dataset: ChartDataset, index: number) => {
        const { color, yAxis, data } = dataset;
        const style = lineChartBaseStyle;
        style.label = `${index}`;
        style.borderColor = color;
        style.pointBorderColor = color;
        style.pointBackgroundColor = color;
        style.pointHoverBackgroundColor = color;
        style.pointHoverBorderColor = color;
        style.yAxisID = yAxis;
        return {
            data,
            ...style
        };
    });
};

export const lineChartCustomTooltip = function (tooltip: any, ref: any, t: TFunction) {
    // Tooltip Element
    if (!ref || !ref.current) return;
    let tooltipEl = document.getElementById('chartjs-tooltip');

    const chart: any = ref.current.chartInstance;

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.innerHTML = '<table></table>';
        if (!chart) return;
        chart?.tooltip._chart.canvas.parentNode?.appendChild(tooltipEl);
    }
    // Hide if no tooltip
    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0 as any;
        return;
    }
    // Set caret Position
    tooltipEl.classList.remove('above', 'below', 'no-transform');
    if (tooltip.yAlign) {
        tooltipEl.classList.add(tooltip.yAlign);
    } else {
        tooltipEl.classList.add('no-transform');
    }
    function getBody(bodyItem: any) {
        return bodyItem.lines;
    }
    // Set Text
    if (tooltip.body) {
        const titleLines = tooltip.title || [];
        const bodyLines = tooltip.body.map(getBody);
        let innerHtml = '<thead>';
        titleLines.forEach(function (title: any) {
            const date = moment(title).format('DD/MM/YYYY HH:mm');
            const gmt = t('main.gmt');
            const titleP = `<p class='chart-tootlip-title'>${date} (${gmt}+${moment(moment().utcOffset()).format(
                'H'
            )})</p>`;
            innerHtml += '<tr><th>' + titleP + '</th></tr>';
        });
        innerHtml += '</thead><tbody>';
        let arr: string[] = [];
        bodyLines.forEach(function (body: any, i: any) {
            let number = body[0].split(':')[1];
            if (arr.includes(number)) return;
            arr.push(number);
            number = Number(number).toLocaleString();

            let stake = `<p>${number}</p>`;

            const div = `<div class='chart-tootlip-data'>${stake}</div>`;
            const span = '<span class="chartjs-tooltip-key"></span>';
            innerHtml += '<tr><td>' + span + div + '</td></tr>';
        });
        innerHtml += '</tbody>';
        const tableRoot = tooltipEl.querySelector('table');
        tableRoot!.innerHTML = innerHtml;
    }
    const positionY = chart?.tooltip._chart.canvas.offsetTop;
    const positionX = chart?.tooltip._chart.canvas.offsetLeft;
    // Display, position, and set styles for font
    const navigation = document.querySelector('.navigation');
    if (!navigation) return;
    const navigationWidth = navigation.clientWidth;
    const isOut = window.innerWidth - navigationWidth - tooltip.caretX < 300;
    if (isOut) {
        tooltipEl.style.transform = 'translate(calc(-100% - 20px) ,  -50%)';
    } else {
        tooltipEl.style.transform = 'translate(0,  -50%)';
    }
    tooltipEl.classList.add('chart-tootlip');
    tooltipEl.classList.add('line-chart-tootlip');
    tooltipEl.style.opacity = 1 as any;
    tooltipEl.style.left = positionX + tooltip.caretX + 10 + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.fontFamily = tooltip._bodyFontFamily;
    tooltipEl.style.fontSize = tooltip.bodyFontSize + 'px';
    tooltipEl.style.fontStyle = tooltip._bodyFontStyle;
    tooltipEl.style.padding = tooltip.yPadding + 'px ' + tooltip.xPadding + 'px';
};
