import React from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { Redirect, Route } from 'react-router-dom';
import { routes } from 'routes/routes';

interface StateProps {
    addressParam?: string;
}

export const CheckDelegatorAddress = ({ addressParam }: StateProps) => {
    const { selectedDelegator } = useSelector((state: AppState) => state.delegator);
    const addressToReplace = selectedDelegator?.address || addressParam || '';
    return (
        <Route exact path={routes.delegators.default}>
            <Redirect to={routes.delegators.stake.replace(':address', addressToReplace)} />
        </Route>
    );
};
