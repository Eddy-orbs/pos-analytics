import React, {
  FunctionComponent as Component,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DelegatorsSections,
  GuardiansSections,
  OverviewSections,
} from '../../global/enums';
import { MenuOption, RouteParams } from '../../global/types';
import './section-menu.scss';

interface Props {
  selected: string | null;
  disabled?: boolean;
  key: DelegatorsSections | GuardiansSections | OverviewSections;
}

const generateClassName = ({ key, selected, disabled }: Props): string => {
  let className = `flex-center section-menu-element`;
  const isSelected = key.toLocaleLowerCase() === selected;
  if (isSelected) {
    className = `${className} section-menu-element-selected`;
  }
  if (disabled) {
    className = `${className} section-menu-element-disabled`;
  }
  return className;
};

interface StateProps {
  options: MenuOption[];
}

export const SectionMenu: Component<StateProps> = ({ options }: StateProps) => {
  const params: RouteParams = useParams();
  const selected = params.section;

  return (
    <ul className="section-menu flex-start">
      {options.map((option: MenuOption, index: number) => {
        const { route, key, name, disabled } = option;

        return (
          <li
            key={index}
            className={generateClassName({ key, selected, disabled })}
          >
            <Link to={route} className="flex-center">
              <p className="capitalize"> {name}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
