// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { vi } from 'vitest';
import { OverviewStakeGuadians } from './overview-guardians';

vi.mock('react-redux', () => ({
    useSelector: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ko' }
    })
}));

describe('OverviewStakeGuadians', () => {
    it('keeps guardian navigation on the name and copies from a separate localized button', async () => {
        const address = '0xabcdef1234567890';
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        vi.mocked(useSelector).mockImplementation((selector) => selector({
            overview: {
                overviewData: {
                    slices: [{ data: [{ address, name: 'Guardian One' }] }]
                },
                overviewDataLoding: false
            },
            guardians: { guardiansColors: {} }
        }));

        const { getByLabelText, getByRole, getByText } = render(
            <MemoryRouter>
                <OverviewStakeGuadians />
            </MemoryRouter>
        );

        const guardianLink = getByText('Guardian One').closest('a');
        const copyButton = getByLabelText(/^가디언 주소 복사/);

        expect(guardianLink && guardianLink.getAttribute('href')).toBe(`/guardians/stake/${address}`);
        expect(copyButton.closest('a')).toBeNull();

        fireEvent.click(copyButton);

        expect(writeText).toHaveBeenCalledWith(address);
        await wait(() => expect(getByRole('status').textContent).toBe('주소가 복사되었습니다.'));
    });
});
