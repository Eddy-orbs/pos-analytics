import { Artwork } from './artwork';
import { pageRead } from './read-cache';
import React, { useEffect, useState } from 'react';
import { Link, Redirect, useHistory, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { api } from 'services/api';
import { DelegatorInfo } from 'pos-analytics-graph';
import {
    Address,
    Metric,
    Notice,
    PageHeading,
    SearchBox,
    StakeChart,
    compactAmount,
    amount,
    shortAddress,
    useCopy,
    useLocale,
    validAddress
} from './shared';

export function RenewalDelegators() {
    const { address = '', section = 'stake' } = useParams<{ address?: string; section?: string }>();
    if (section !== 'stake') return <Redirect to={address ? `/delegators/stake/${address}` : '/delegators/stake'} />;
    return <DelegatorPage key={address.toLowerCase()} address={address} />;
}
function DelegatorPage({ address }: { address: string }) {
    const copy = useCopy();
    const locale = useLocale();
    const history = useHistory();
    const { web3, blockRef } = useSelector((s: AppState) => s.main);
    const { guardians } = useSelector((s: AppState) => s.guardians);
    const [query, setQuery] = useState(address),
        [invalid, setInvalid] = useState(false),
        [current, setCurrent] = useState<DelegatorInfo | null>(null);
    const [loading, setLoading] = useState(false),
        [error, setError] = useState(false),
        [retry, setRetry] = useState(0);
    const [days, setDays] = useState(30),
        [historyData, setHistoryData] = useState<DelegatorInfo['stake_slices']>([]),
        [historyLoading, setHistoryLoading] = useState(false),
        [historyError, setHistoryError] = useState(false),
        [historyRetry, setHistoryRetry] = useState(0);
    useEffect(() => {
        if (!address) return;
        let alive = true;
        setLoading(true);
        setError(false);
        if (!validAddress(address)) {
            setLoading(false);
            setError(true);
            return;
        }
        pageRead(web3, `delegator-current:${address.toLowerCase()}`, () =>
            api.getDelegatorCurrentApi(address.toLowerCase(), web3, blockRef || {})
        )
            .then((d) => {
                if (alive) {
                    setCurrent(d || null);
                    setError(!d);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (alive) {
                    setError(true);
                    setLoading(false);
                }
            });
        return () => {
            alive = false;
        };
    }, [address, web3, blockRef, retry]);
    useEffect(() => {
        if (!current) return;
        let alive = true;
        setHistoryLoading(true);
        setHistoryError(false);
        pageRead(web3, `delegator-stake:${address.toLowerCase()}:${current.block_number}:${days}`, () =>
            api.getDelegatorStakeHistoryApi(
                address.toLowerCase(),
                web3,
                { fromTime: current.block_time - days * 86400, toTime: current.block_time },
                current
            )
        )
            .then((d) => {
                if (alive) {
                    setHistoryData(d?.stake_slices || []);
                    setHistoryError(!d);
                    setHistoryLoading(false);
                }
            })
            .catch(() => {
                if (alive) {
                    setHistoryError(true);
                    setHistoryLoading(false);
                }
            });
        return () => {
            alive = false;
        };
    }, [current, address, web3, days, historyRetry]);
    const submit = () => {
        const next = query.trim();
        if (!validAddress(next)) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        history.push(`/delegators/stake/${next}`);
    };
    const guardian = guardians?.find((g) => g.address.toLowerCase() === current?.delegated_to.toLowerCase());
    return (
        <main className="rn-main rd-main">
            <PageHeading title={copy('Delegators', '델리게이터', 'デリゲーター')} />
            <p className="rd-page-intro">
                {copy(
                    'Enter a delegator address and press Enter to view their stake.',
                    '델리게이터 주소를 입력하고 Enter를 눌러 스테이킹 정보를 확인하세요.',
                    'デリゲーターのアドレスを入力し、Enterキーを押すとステーキング情報を確認できます。'
                )}
            </p>
            <div className="rd-address-lookup">
                <SearchBox
                    value={query}
                    onChange={(v) => {
                        setQuery(v);
                        setInvalid(false);
                    }}
                    placeholder={copy('Search wallet address', '지갑 주소 검색', 'ウォレットアドレスを検索')}
                    onSubmit={submit}
                />
                {validAddress(query.trim()) && <Address address={query.trim()} subject="delegator" />}
            </div>
            {invalid && (
                <Notice error>
                    {copy(
                        'Enter a valid Ethereum / Polygon wallet address (0x + 40 hex characters).',
                        '올바른 Ethereum / Polygon 지갑 주소를 입력하세요 (0x + 40자리).',
                        '有効なEthereum / Polygonのウォレットアドレス（0x + 40桁の16進数）を入力してください。'
                    )}
                </Notice>
            )}
            {!address ? (
                <section className="rn-panel rd-wallet-empty">
                    <Artwork kind="wallet" />
                    <h2>
                        {copy('Look up a delegator wallet', '델리게이터 지갑 조회', 'デリゲーターのウォレットを検索')}
                    </h2>
                    <p>
                        {copy(
                            'Enter a wallet address above to see its stake, balances and chosen Guardian.',
                            '위에 지갑 주소를 입력하면 스테이킹 수량, 잔액, 위임 가디언을 확인할 수 있습니다.',
                            '上にウォレットアドレスを入力すると、ステーキング量、残高、委任先のガーディアンを確認できます。'
                        )}
                    </p>
                    <Link to="/delegators/stake/0x578f069393c3c18af8e440510e236006e66a73f1">
                        {copy('View example wallet', '예시 지갑 보기', 'サンプルウォレットを見る')} ↗
                    </Link>
                </section>
            ) : loading ? (
                <Notice>{copy('Loading wallet…', '지갑 정보 로딩 중…', 'ウォレット情報を読み込み中…')}</Notice>
            ) : error ? (
                <Notice error retry={() => setRetry((n) => n + 1)}>
                    {copy(
                        'Unable to load wallet data. Check the address or retry.',
                        '지갑 정보를 불러오지 못했습니다. 주소를 확인하거나 다시 시도하세요.',
                        'ウォレット情報を読み込めませんでした。アドレスを確認するか、再試行してください。'
                    )}
                </Notice>
            ) : (
                current && (
                    <>
                        <div className="rd-metrics rd-two">
                            <Metric
                                title={copy('Delegated to', '위임 가디언', '委任先')}
                                icon="delegated-to"
                                value={
                                    validAddress(current.delegated_to) && !/^0x0{40}$/.test(current.delegated_to) ? (
                                        <Link to={`/guardians/stake/${current.delegated_to}`}>
                                            {guardian?.name || shortAddress(current.delegated_to)} ↗
                                        </Link>
                                    ) : (
                                        copy('Not delegated', '위임 없음', '委任なし')
                                    )
                                }
                            />
                            <Metric
                                title={copy('Total staked', '총 스테이킹', '総ステーキング量')}
                                value={`${compactAmount(current.total_stake)} ORBS`}
                            />
                        </div>
                        <div className="rd-stake-layout">
                            <StakeChart
                                points={historyData.map((s) => ({ time: s.block_time, value: s.stake }))}
                                days={days}
                                onDays={setDays}
                                loading={historyLoading}
                                error={historyError}
                                retry={() => setHistoryRetry((n) => n + 1)}
                            />
                            <aside className="rd-additional">
                                <h2>{copy('Additional balances', '추가 수량 정보', 'その他の残高')}</h2>
                                <p>{copy('Cooldown', '언락 진행 중', 'クールダウン')}</p>
                                <strong>{amount(current.cooldown_stake)} ORBS</strong>
                                <small>
                                    {copy('ORBS awaiting withdrawal', '출금 대기 중인 ORBS', '出金待ちのORBS')}
                                </small>
                                {current.cooldown_stake > 0 && current.current_cooldown_time > 0 && (
                                    <small>
                                        {new Date(current.current_cooldown_time * 1000).toLocaleString(locale)}
                                    </small>
                                )}
                                <hr />
                                <p>{copy('Non-staked balance', '미스테이킹 잔액', '未ステーキング残高')}</p>
                                <strong>{amount(current.non_stake)} ORBS</strong>
                                <small>
                                    {copy(
                                        'ORBS held outside staking',
                                        '스테이킹하지 않은 ORBS',
                                        'ステーキングしていないORBS'
                                    )}
                                </small>
                            </aside>
                        </div>
                    </>
                )
            )}
        </main>
    );
}
