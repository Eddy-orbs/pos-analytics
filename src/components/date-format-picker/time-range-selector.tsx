import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChartUnit } from '../../global/enums';
import './time-range-selector.scss';

interface Option {
  name: string;
  unit: ChartUnit;
}
interface StateProps {
  selectCallBack: (value: ChartUnit) => void;
  selected: ChartUnit;
  unitsToHide?: ChartUnit[];
}

const filterUnits = (units: Option[], unitsToHide?: ChartUnit[]) => {
  if (!unitsToHide) return units;
  return units.filter((option: Option) => !unitsToHide.includes(option.unit));
};

export const TimeRangeSelector = ({
  selectCallBack,
  selected,
  unitsToHide,
}: StateProps) => {
  const { t } = useTranslation();
  const options = [
    { name: t('main.months'), unit: ChartUnit.MONTH },
    { name: t('main.weeks'), unit: ChartUnit.WEEK },
    { name: t('main.days'), unit: ChartUnit.DAY },
  ];
  const select = (option: Option) => {
    selectCallBack(option.unit);
  };

  return (
    <div className="time-range-selector" role="group" aria-label="Chart period">
      {filterUnits(options, unitsToHide).map(
        (option: Option, index: number) => {
          const className =
            selected === option.unit
              ? 'time-range-selector-btn time-range-selector-selected'
              : 'time-range-selector-btn';
          return (
            <button
              onClick={() => select(option)}
              className={className}
              key={index}
              type="button"
              aria-pressed={selected === option.unit}
            >
              {option.name}
            </button>
          );
        }
      )}
    </div>
  );
};
