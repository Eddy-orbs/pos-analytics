import { DelegatorAction } from 'pos-analytics-graph';
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { routes } from 'routes/routes';
import {
  generateDelegatorsActionColors,
  generateDelegatorsCurrentStake,
} from 'utils/delegators';
import LinkIcon from 'assets/images/copy.svg';
import { convertToString } from 'utils/number';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import { DelegatorActionsTypes } from 'global/enums';
import { TableCell, TableRow } from '@material-ui/core';
import { isMobile } from 'react-device-detect';
import { getExplorerUrl } from 'utils/chain';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';

interface StateProps {
  action: DelegatorAction;
}

export const DelegatorActionElement = ({ action }: StateProps) => {
  const {
    amount,
    block_time,
    block_number,
    event,
    to,
    current_stake,
    additional_info_link,
  } = action;
  const { t } = useTranslation();
  const { chain } = useSelector((state: AppState) => state.main);
  const generateAction = () => {
    const isDeligated = event === DelegatorActionsTypes.DELEGATED;
    const eventName = `delegators.${event}`;
    if (isDeligated && to) {
      return (
        <div className="list-item">
          <a
            href={additional_info_link}
            target="_blank"
            rel="noopener noreferrer"
            className="list-item"
          >
            {isDeligated ? <p>{t(eventName)}</p> : <p>{event}</p>}
          </a>
          <section className="list-item-tooltip">
            <Link
              to={routes.guardians.stake.replace(':address', to)}
              className="flex-start-center"
            >
              <p className="text-overflow">{to}</p>
              <figure className="flex-start-center">
                {to} <img src={LinkIcon} alt="" />
              </figure>
            </Link>
          </section>
        </div>
      );
    }
    return (
      <a
        href={additional_info_link}
        target="_blank"
        rel="noopener noreferrer"
        className="list-item"
      >
        <p>{t(eventName)}</p>
      </a>
    );
  };
  const color = generateDelegatorsActionColors(event as DelegatorActionsTypes);
  const currentStake = generateDelegatorsCurrentStake(
    event as DelegatorActionsTypes,
    current_stake
  );
  const explorerUrl = useMemo(() => getExplorerUrl(chain), [chain])

  return (
    <TableRow>
      <TableCell>{generateAction()}</TableCell>
      <TableCell>
        <p className="list-item" style={{ color }}>
          {convertToString(amount, '-')}
        </p>
      </TableCell>
      <TableCell>
        <p className="list-item">{currentStake}</p>
      </TableCell>
      <TableCell>
        <a
          href={`${explorerUrl}/${block_number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="list-item"
        >
          <p>{block_number}</p>
        </a>
      </TableCell>
      {!isMobile && (
        <TableCell>
          <p className="list-item">
            {moment.unix(block_time).format('YYYY-MM-DD HH:mm')}
          </p>
        </TableCell>
      )}
    </TableRow>
  );
};
