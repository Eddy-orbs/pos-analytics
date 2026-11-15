// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { vi } from 'vitest';
import { GuardianInfo } from './guardian-info';

vi.mock('react-redux', () => ({
    useSelector: vi.fn()
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ko-KR' }
    })
}));

describe('GuardianInfo', () => {
    it('renders four uniform information items and copies the exact node address', async () => {
        const nodeAddress = '0xe61e7f9a1231396a394271da509ee6f82113ae56';
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        vi.mocked(useSelector).mockImplementation((selector) => selector({
            guardians: {
                guardianIsLoading: false,
                selectedGuardian: {
                    details: {
                        website: 'https://example.com',
                        details_URL: 'https://example.com/details',
                        ip: '127.0.0.1',
                        node_address: nodeAddress
                    }
                }
            }
        }));

        const { container, getByLabelText, getByRole } = render(<GuardianInfo showInfo />);

        expect(container.querySelectorAll('.guardian-info-item')).toHaveLength(4);

        fireEvent.click(getByLabelText(/^노드 주소 복사/));

        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith(nodeAddress);
        await wait(() => expect(getByRole('status').textContent).toBe('주소가 복사되었습니다.'));
    });
});
