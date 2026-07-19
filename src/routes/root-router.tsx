import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import React from 'react';

import { routes } from './routes';
import { Delegators } from '../screens/deligators/delegators';
import { NavigationMenu } from '../components/navigation-menu/navigation-menu';
import { Guardians } from '../screens/guardians/guardians';
import { Overview } from '../screens/overview/overview';
import { CHAINS } from 'types';
import { getRouterBasePath } from 'utils/router';

interface Props{
    chain: CHAINS
}
export const RootRouter = ({chain}: Props) => {
    return (
        <Router basename={getRouterBasePath(process.env.PUBLIC_URL, chain)}>
            <NavigationMenu />

            <Switch>
                <Route exact path="/">
                    <Redirect to={routes.overview.stake} />
                </Route>
                <Route path={routes.overview.main} component={Overview} />
                <Route path={routes.guardians.main} component={Guardians} />
                <Route path={routes.delegators.main} component={Delegators} />
                <Route>
                <Redirect to={routes.overview.stake} />
                </Route>
            </Switch>
        </Router>
    );
};
