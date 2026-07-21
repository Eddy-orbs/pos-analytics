import { getAppConnectionMessages } from './app-status-messages';

describe('getAppConnectionMessages', () => {
    it('returns polished RPC connection guidance for every configured language', () => {
        expect(getAppConnectionMessages('en-US')).toEqual({
            title: 'Unable to connect to the blockchain network.',
            description: 'Check your connection and try again shortly.',
            retry: 'Try again'
        });
        expect(getAppConnectionMessages('ko-KR')).toEqual({
            title: '블록체인 네트워크에 연결할 수 없습니다.',
            description: '연결 상태를 확인한 후 잠시 뒤 다시 시도해 주세요.',
            retry: '다시 시도'
        });
        expect(getAppConnectionMessages('ja')).toEqual({
            title: 'ブロックチェーンネットワークに接続できません。',
            description: '接続状況を確認し、しばらくしてからもう一度お試しください。',
            retry: '再試行'
        });
    });

    it('falls back to English for an unknown language', () => {
        expect(getAppConnectionMessages('unknown')).toEqual(getAppConnectionMessages('en-US'));
    });
});
