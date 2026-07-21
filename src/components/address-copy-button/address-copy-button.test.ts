import { getAddressCopyMessages } from './address-copy-button';

describe('getAddressCopyMessages', () => {
    it('returns localized guardian copy text for every configured language', () => {
        expect(getAddressCopyMessages('en-US', 'guardian')).toEqual({
            label: 'Copy guardian address',
            copied: 'Address copied.'
        });
        expect(getAddressCopyMessages('ko', 'guardian')).toEqual({
            label: '가디언 주소 복사',
            copied: '주소가 복사되었습니다.'
        });
        expect(getAddressCopyMessages('ja', 'guardian')).toEqual({
            label: 'ガーディアンアドレスをコピー',
            copied: 'アドレスをコピーしました。'
        });
    });

    it('localizes the delegator accessibility label', () => {
        expect(getAddressCopyMessages('en-US', 'delegator').label).toBe('Copy delegator address');
        expect(getAddressCopyMessages('ko-KR', 'delegator').label).toBe('델리게이터 주소 복사');
        expect(getAddressCopyMessages('ja-JP', 'delegator').label).toBe('デリゲーターアドレスをコピー');
    });
});
