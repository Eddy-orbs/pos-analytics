// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { GuardianDelegatorElement } from './guardian-delegator';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ i18n: { language: 'ja' } })
}));

describe('GuardianDelegatorElement', () => {
    it('keeps delegator navigation on the address and copies from a separate localized button', async () => {
        const address = '0x1234567890abcdef';
        const writeText = vi.fn().mockResolvedValue(undefined);
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
        const copyButton = getByLabelText(/^デリゲーターアドレスをコピー/);

        expect(addressLink && addressLink.getAttribute('href')).toBe(`/delegators/stake/${address}`);
        expect(copyButton.closest('a')).toBeNull();

        fireEvent.click(copyButton);

        expect(writeText).toHaveBeenCalledWith(address);
        await wait(() => expect(getByRole('status').textContent).toBe('アドレスをコピーしました。'));
    });
});
