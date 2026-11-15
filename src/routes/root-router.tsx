import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import React from 'react';

import { routes } from './routes';
import { RenewalDelegators as Delegators } from 'screens/renewal/delegators';
import { AnalyticsLayout } from 'components/analytics-layout/analytics-layout';
import { RenewalGuardians as Guardians } from 'screens/renewal/guardians';
import { CHAINS } from 'types';
import { RenewalOverview } from '../screens/overview/renewal';

interface Props {
    chain: CHAINS;
}
export const RootRouter = ({ chain }: Props) => {
    return (
        <Router basename={`${process.env.PUBLIC_URL}/${chain}`}>
            <AnalyticsLayout>
                <Switch>
                    <Route exact path="/">
                        <Redirect to={routes.overview.stake} />
                    </Route>
                    <Route path={routes.overview.main} component={RenewalOverview} />
                    <Route path={routes.guardians.main} component={Guardians} />
                    <Route path={routes.delegators.main} component={Delegators} />
                    <Route>
                        <Redirect to={routes.overview.stake} />
                    </Route>
                </Switch>
            </AnalyticsLayout>
        </Router>
    );
};
