// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { vi } from 'vitest';
import { AddressCopyButton, getAddressCopyMessages } from './address-copy-button';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ i18n: { language: 'en-US' } })
}));

describe('AddressCopyButton', () => {
    it('returns localized labels and completion messages with an English fallback', () => {
        expect(getAddressCopyMessages('en-US', 'guardian')).toEqual({
            label: 'Copy guardian address',
            copied: 'Address copied.'
        });
        expect(getAddressCopyMessages('ko-KR', 'delegator')).toEqual({
            label: '델리게이터 주소 복사',
            copied: '주소가 복사되었습니다.'
        });
        expect(getAddressCopyMessages('ja-JP', 'guardian')).toEqual({
            label: 'ガーディアンアドレスをコピー',
            copied: 'アドレスをコピーしました。'
        });
        expect(getAddressCopyMessages('ko-KR', 'node')).toEqual({
            label: '노드 주소 복사',
            copied: '주소가 복사되었습니다.'
        });
        expect(getAddressCopyMessages('ja-JP', 'node')).toEqual({
            label: 'ノードアドレスをコピー',
            copied: 'アドレスをコピーしました。'
        });
        expect(getAddressCopyMessages('en-US', 'node')).toEqual({
            label: 'Copy node address',
            copied: 'Address copied.'
        });
        expect(getAddressCopyMessages('unknown', 'delegator')).toEqual({
            label: 'Copy delegator address',
            copied: 'Address copied.'
        });
    });

    it('uses the exact address and clears its two-second completion timer on unmount', async () => {
        vi.useFakeTimers();
        const address = '0xAbCdEf1234567890';
        const writeText = vi.fn().mockResolvedValue(undefined);
        const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });

        const { getByLabelText, getByRole, queryByRole, unmount } = render(
            <AddressCopyButton address={address} subject="delegator" />
        );

        await act(async () => {
            fireEvent.click(getByLabelText(/^Copy delegator address/));
            await Promise.resolve();
        });

        expect(getByRole('status').textContent).toBe('Address copied.');
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith(address);

        act(() => {
            vi.advanceTimersByTime(1999);
        });
        expect(getByRole('status')).toBeTruthy();
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(queryByRole('status')).toBeNull();

        unmount();
        expect(clearTimeoutSpy).toHaveBeenCalled();
        clearTimeoutSpy.mockRestore();
        vi.useRealTimers();
    });

    it('falls back to execCommand when the Clipboard API rejects', async () => {
        const address = '0xFallbackAddress';
        const writeText = vi.fn().mockRejectedValue(new Error('denied'));
        const execCommand = vi.fn().mockImplementation(() => {
            const textArea = document.querySelector('textarea');
            expect(textArea && textArea.value).toBe(address);
            return true;
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText }
        });
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: execCommand
        });

        const { getByLabelText, getByRole } = render(<AddressCopyButton address={address} subject="guardian" />);

        fireEvent.click(getByLabelText(/^Copy guardian address/));

        await wait(() => expect(getByRole('status').textContent).toBe('Address copied.'));
        expect(writeText).toHaveBeenCalledWith(address);
        expect(execCommand).toHaveBeenCalledWith('copy');
        expect(document.querySelector('textarea')).toBeNull();
    });
});

it('offers the full selectable address when clipboard and fallback fail', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: vi.fn().mockReturnValue(false) });
    const { getByRole, queryByRole, unmount } = render(<AddressCopyButton address="0x123456" subject="guardian" />);
    fireEvent.click(getByRole('button'));
    await wait(() => expect(getByRole('alert')).toBeTruthy());
    expect((getByRole('textbox') as HTMLInputElement).value).toBe('0x123456');
    expect(queryByRole('status')).toBeNull();
    unmount();
});
