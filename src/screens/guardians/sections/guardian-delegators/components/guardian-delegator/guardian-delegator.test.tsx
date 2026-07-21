import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GuardianDelegatorElement } from './guardian-delegator';

jest.mock('react-i18next', () => ({
    useTranslation: () => ({ i18n: { language: 'en-US' } })
}));

describe('GuardianDelegatorElement', () => {
    it('copies the address without making the copy button a navigation link', async () => {
        const address = '0x1234567890abcdef';
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        const { getByLabelText, getByRole, getByText } = render(
            <MemoryRouter>
                <table>
                    <tbody>
                        <GuardianDelegatorElement
                            delegator={{ address, stake: 100, non_stake: 20 } as any}
                        />
                    </tbody>
                </table>
            </MemoryRouter>
        );

        const addressLink = getByText(address).closest('a');
        const copyButton = getByLabelText('Copy delegator address');

        expect(addressLink && addressLink.getAttribute('href')).toBe(`/delegators/stake/${address}`);
        expect(copyButton.closest('a')).toBeNull();

        fireEvent.click(copyButton);

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith(address);
        await wait(() => expect(getByRole('status').textContent).toBe('Address copied.'));
    });
});
