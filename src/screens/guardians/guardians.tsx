import React from 'react';
import { Route, useParams, Redirect } from 'react-router-dom';
import { routes } from '../../routes/routes';
import { GuardianDelegators } from './sections/guardian-delegators/guardian-delegators';
import { GuardiansStake } from './sections/guardians-stake/guardians-stake';
import './guardians.scss';
import { GuardianTop } from './components/guardian-top/guardian-top';
import { RouteParams } from '../../global/types';
import { SectionMenu } from '../../components/section-menu/section-menu';
import { generateGuardiansRoutes } from '../../utils/guardians';
import { useTranslation } from 'react-i18next';
import { CheckGuardianAddress } from './sections/guardians-stake/components/check-guardian-address/check-guardian-address';

const GuardiansComponent = () => {
    const params: RouteParams = useParams();
    const { t } = useTranslation();
    const { address } = params;
    return (
        <div className="guardians screen">
            <GuardianTop params={params} />
            <div className="screen-section">
                <SectionMenu options={generateGuardiansRoutes(t, address || '')} />
                <div className="screen-section-container">
                    <Route path={routes.guardians.stake} render={() => <GuardiansStake />} />
                    <Route
                        path={routes.guardians.rewards}
                        render={() => <Redirect to={routes.guardians.stake.replace(':address?', address || '')} />}
                    />
                    <Route path={routes.guardians.delegators} render={() => <GuardianDelegators />} />
                    <Route
                        path={routes.guardians.actions}
                        render={() => <Redirect to={routes.guardians.stake.replace(':address?', address || '')} />}
                    />
                    <CheckGuardianAddress addressParam={address} />
                </div>
            </div>
        </div>
    );
};

export const Guardians = React.memo(GuardiansComponent);
