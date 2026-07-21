interface DelegatorHistoryMessages {
    loadFailed: string;
    retry: string;
}

export const getDelegatorHistoryMessages = (language: string): DelegatorHistoryMessages => {
    const normalizedLanguage = (language || 'en-US').toLowerCase();

    if (normalizedLanguage.indexOf('ko') === 0) {
        return {
            loadFailed: '델리게이터 스테이킹 내역을 불러올 수 없습니다. 다시 시도해 주세요.',
            retry: '다시 시도'
        };
    }

    if (normalizedLanguage.indexOf('ja') === 0) {
        return {
            loadFailed: 'デリゲーターのステーキング履歴を読み込めません。もう一度お試しください。',
            retry: '再試行'
        };
    }

    return {
        loadFailed: "Unable to load the delegator's staking history. Please try again.",
        retry: 'Try again'
    };
};
