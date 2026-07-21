import { getDelegatorHistoryMessages } from './delegator-history-messages';

describe('getDelegatorHistoryMessages', () => {
    it('returns failure and retry text for every configured language', () => {
        expect(getDelegatorHistoryMessages('en-US')).toEqual({
            loadFailed: "Unable to load the delegator's staking history. Please try again.",
            retry: 'Try again'
        });
        expect(getDelegatorHistoryMessages('ko-KR')).toEqual({
            loadFailed: '델리게이터 스테이킹 내역을 불러올 수 없습니다. 다시 시도해 주세요.',
            retry: '다시 시도'
        });
        expect(getDelegatorHistoryMessages('ja')).toEqual({
            loadFailed: 'デリゲーターのステーキング履歴を読み込めません。もう一度お試しください。',
            retry: '再試行'
        });
    });

    it('falls back to English for an unknown language', () => {
        expect(getDelegatorHistoryMessages('unknown')).toEqual(getDelegatorHistoryMessages('en-US'));
    });
});
