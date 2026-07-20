import React from 'react';
import { routes } from 'routes/routes';
import { convertToString } from 'utils/number';
import { Link } from 'react-router-dom';
import CopyImg from 'assets/images/copy.svg';
import { GuardianDelegator } from 'pos-analytics-graph';
import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
interface StateProps {
  delegator: GuardianDelegator;
}

export const GuardianDelegatorElement = ({ delegator }: StateProps) => {
  const { address, stake, non_stake } = delegator;
  return (
    <TableRow>
      <TableCell align="left">
        <Link
          className="list-item flex-start-center"
          to={routes.delegators.stake.replace(':address', address)}
        >
          <p> {address}</p>
          <img src={CopyImg} alt="" />
        </Link>
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
