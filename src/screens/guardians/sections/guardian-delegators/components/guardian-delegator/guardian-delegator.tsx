import React from 'react';
import { routes } from 'routes/routes';
import { convertToString } from 'utils/number';
import { Link } from 'react-router-dom';
import { GuardianDelegator } from '@orbs-network/pos-analytics-lib';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import { AddressCopyButton } from 'components/address-copy-button/address-copy-button';
import './guardian-delegator.scss';

interface StateProps {
  delegator: GuardianDelegator;
}

export const GuardianDelegatorElement = ({ delegator }: StateProps) => {
  const { address, stake, non_stake } = delegator;

  return (
    <TableRow>
      <TableCell align="left">
        <div className="guardian-delegator-address flex-start-center">
          <Link
            className="list-item flex-start-center"
            to={routes.delegators.stake.replace(':address', address)}
          >
            <p> {address}</p>
          </Link>
          <AddressCopyButton address={address} subject="delegator" />
        </div>
      </TableCell>
      <TableCell align="left">
        <p className="list-item">{convertToString(stake)}</p>
      </TableCell>
      <TableCell align="left">
        <p className="list-item">{convertToString(non_stake)}</p>
      </TableCell>
    </TableRow>
  );
};
