import { TFunction } from 'i18next';
import { DelegatorsSections } from '../global/enums';
import { generateDelegatorsRoutes } from './delegators';

const translate = ((key: string) => key) as TFunction;

describe('Delegator utilities', () => {
    it('exposes only the enabled Stake route and consumes the optional address marker', () => {
        expect(generateDelegatorsRoutes(translate, '0xAbC')).toEqual([
            {
                name: 'main.stake',
                route: '/delegators/stake/0xAbC',
                key: DelegatorsSections.STAKE
            }
        ]);
    });

    it('does not leave the optional route token in an address-less route', () => {
        const [stakeRoute] = generateDelegatorsRoutes(translate, '');

        expect(stakeRoute.route).toBe('/delegators/stake/');
        expect(stakeRoute.route).not.toContain(':address');
        expect(stakeRoute.route).not.toContain('?');
    });
});
