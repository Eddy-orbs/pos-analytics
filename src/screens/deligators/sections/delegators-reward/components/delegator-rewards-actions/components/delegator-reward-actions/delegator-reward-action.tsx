import { TableCell, TableRow } from '@material-ui/core';
import { DelegatorAction } from 'pos-analytics-graph';
import moment from 'moment';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ETHERSCAN_BLOCK_ADDRESS } from 'keys/keys';
import { convertToString } from 'utils/number';

interface StateProps {
    action: DelegatorAction;
}

export const DelegatorRewardAction = ({ action }: StateProps) => {
    const { amount, block_time, block_number, additional_info_link, event } = action;
    const { t } = useTranslation();
    const eventName = `delegators.${event}`;

    return (
        <TableRow>
            <TableCell>
                {additional_info_link ? (
                    <a href={additional_info_link} target="_blank" rel="noopener noreferrer" className="list-item">
                        <p className="capitalize">{t(eventName)}</p>
                    </a>
                ) : (
                    <p className="list-item capitalize">{t(eventName)}</p>
                )}
            </TableCell>
            <TableCell>
                <p className="list-item">{convertToString(amount)}</p>
            </TableCell>
            <TableCell>
                <a
                    href={`${ETHERSCAN_BLOCK_ADDRESS}/${block_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="list-item">
                    <p>{block_number}</p>
                </a>
            </TableCell>
            <TableCell>
                <p className="list-item">{moment.unix(block_time).format('YYYY-MM-DD HH:mm')}</p>
            </TableCell>
        </TableRow>
    );
};
