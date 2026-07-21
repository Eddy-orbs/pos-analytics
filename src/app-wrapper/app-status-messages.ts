interface AppConnectionMessages {
    title: string;
    description: string;
    retry: string;
}

export const getAppConnectionMessages = (language: string): AppConnectionMessages => {
    const normalizedLanguage = (language || 'en-US').toLowerCase();

    if (normalizedLanguage.indexOf('ko') === 0) {
        return {
            title: '블록체인 네트워크에 연결할 수 없습니다.',
            description: '연결 상태를 확인한 후 잠시 뒤 다시 시도해 주세요.',
            retry: '다시 시도'
        };
    }

    if (normalizedLanguage.indexOf('ja') === 0) {
        return {
            title: 'ブロックチェーンネットワークに接続できません。',
            description: '接続状況を確認し、しばらくしてからもう一度お試しください。',
            retry: '再試行'
        };
    }

    return {
        title: 'Unable to connect to the blockchain network.',
        description: 'Check your connection and try again shortly.',
        retry: 'Try again'
    };
};
