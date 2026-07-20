import { PosOverviewData } from 'pos-analytics-graph';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { routes } from 'routes/routes';

interface StateProps {
    selected: PosOverviewData | null;
    value: string | number;
}
export const SelectedGuardian = ({ selected, value }: StateProps) => {
    const history = useHistory();
    const goToGuardian = () => {
        if (!selected) return;
        history.push(routes.guardians.stake.replace(':address', selected.address));
    };
    return selected ? (
        <button className="mobile-overview-chart-selected" onClick={goToGuardian} type="button">
            <p className="text-overflow">{selected?.name}</p>
            <h5>{value}</h5>
        </button>
    ) : null;
};
