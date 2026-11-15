import { useIsMobileViewport } from 'hooks/useViewport';
import { pageRead } from './read-cache';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { getOverviewAction, getGuardiansAction } from 'redux/actions/actions';
import { getGuardian, getGuardianStakeView, GuardianInfo } from 'pos-analytics-graph';
import { committeePresentation } from 'screens/overview/renewal-data';
import {
    Address,
    Avatar,
    Metric,
    Notice,
    PageHeading,
    Pagination,
    SearchBox,
    StakeChart,
    amount,
    compactAmount,
    safeWebsite,
    useCopy,
    useLocale,
    validAddress
} from './shared';

export function RenewalGuardians() {
    const { address } = useParams<{ address?: string }>();
    return address ? <GuardianProfile key={address.toLowerCase()} address={address} /> : <GuardianDirectory />;
}
function GuardianDirectory() {
    const history = useHistory();
    const isMobile = useIsMobileViewport();
    const copy = useCopy();

    const dispatch = useDispatch();
    const { chain, web3 } = useSelector((s: AppState) => s.main);
    const { guardians } = useSelector((s: AppState) => s.guardians);
    const { overviewData: overview } = useSelector((s: AppState) => s.overview);
    const [query, setQuery] = useState(''),
        [filter, setFilter] = useState('all'),
        [sort, setSort] = useState('stake'),
        [view, setView] = useState('cards'),
        [page, setPage] = useState(1);
    const displayedView = isMobile ? 'cards' : view;
    useEffect(() => {
        if (!overview) dispatch(getOverviewAction(chain, web3));
    }, [chain, web3, dispatch, overview]);
    const committee = useMemo(
        () => new Set(committeePresentation(overview?.slices || []).guardians.map((g) => g.address.toLowerCase())),
        [overview]
    );
    const rows = useMemo(
        () =>
            (guardians || [])
                .filter(
                    (g) =>
                        (filter === 'all' ||
                            (filter === 'committee'
                                ? committee.has(g.address.toLowerCase())
                                : !committee.has(g.address.toLowerCase()))) &&
                        `${g.name} ${g.address}`.toLowerCase().includes(query.trim().toLowerCase())
                )
                .sort((a, b) =>
                    sort === 'stake'
                        ? b.effective_stake - a.effective_stake
                        : (a.name || a.address).localeCompare(b.name || b.address)
                ),
        [guardians, query, sort, filter, committee]
    );
    useEffect(() => setPage(1), [query, sort, filter, displayedView]);
    const selected = rows.slice((page - 1) * 9, page * 9);
    return (
        <main className="rn-main rd-main">
            <PageHeading title={copy('Guardians', '가디언', 'ガーディアン')} />
            <div className="rd-toolbar">
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    onSubmit={() => {
                        const address = query.trim();
                        if (validAddress(address)) history.push(`/guardians/stake/${address}`);
                    }}
                    placeholder={copy('Search by name or address', '이름 또는 주소 검색', '名前またはアドレスで検索')}
                />
                <span className="rd-guardian-sort">
                    <select
                        aria-label={copy('Sort Guardians', '가디언 정렬', 'ガーディアンの並び順')}
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    >
                        <option value="name">{copy('Name: A–Z', '이름순', '名前順：A–Z')}</option>
                        <option value="stake">
                            {copy(
                                'Effective stake: high to low',
                                '유효 스테이킹 내림차순',
                                '有効ステーキング量の多い順'
                            )}
                        </option>
                    </select>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </span>
            </div>
            <div className="rd-directory-controls">
                <div className="rd-tabs" aria-label={copy('Guardian filter', '가디언 필터', 'ガーディアンの絞り込み')}>
                    {[
                        ['all', copy('All', '전체', 'すべて'), guardians?.length],
                        [
                            'committee',
                            copy('In committee', 'Committee', '委員会メンバー'),
                            overview ? committee.size : undefined
                        ],
                        [
                            'candidates',
                            copy('Not in committee', 'Committee 외', '委員会メンバー以外'),
                            overview
                                ? (guardians || []).filter((g) => !committee.has(g.address.toLowerCase())).length
                                : undefined
                        ]
                    ].map(([key, name, count]) => (
                        <button
                            key={key}
                            aria-pressed={filter === key}
                            disabled={key !== 'all' && !overview}
                            onClick={() => setFilter(String(key))}
                        >
                            {name} {count ?? '—'}
                        </button>
                    ))}
                </div>
                {!isMobile && (
                    <div className="rd-view-toggle">
                        <button
                            aria-label={copy('Card view', '카드 보기', 'カード表示')}
                            aria-pressed={view === 'cards'}
                            onClick={() => setView('cards')}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                    d="M3 3H10V10H3V3ZM14 3H21V10H14V3ZM3 14H10V21H3V14ZM14 14H21V21H14V14Z"
                                    strokeWidth="1.7"
                                    strokeLinejoin="round"
                                    stroke="currentColor"
                                />
                            </svg>
                        </button>
                        <button
                            aria-label={copy('List view', '목록 보기', 'リスト表示')}
                            aria-pressed={view === 'list'}
                            onClick={() => setView('list')}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="4" cy="8" r="1" />
                                <circle cx="4" cy="12" r="1" />
                                <circle cx="4" cy="16" r="1" />
                                <path d="M7 7H21V9H7V7ZM7 11H21V13H7V11ZM7 15H21V17H7V15Z" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
            {!guardians ? (
                <Notice retry={() => dispatch(getGuardiansAction(chain))}>
                    {copy('Loading Guardians…', '가디언 로딩 중…', 'ガーディアンを読み込み中…')}
                </Notice>
            ) : !rows.length ? (
                <Notice>
                    {copy('No matching Guardians', '일치하는 가디언이 없습니다', '一致するガーディアンがありません')}
                </Notice>
            ) : (
                <div className={`rd-directory rd-directory-${displayedView}`}>
                    {selected.map((g) => (
                        <article className="rd-guardian-card" key={g.address}>
                            <Link className="rd-guardian-title" to={`/guardians/stake/${g.address}`}>
                                <Avatar name={g.name || ''} address={g.address} />
                                <h2>{g.name || g.address}</h2>
                            </Link>
                            <Address adaptive address={g.address} name={g.name} />
                            <div className="rd-card-stake">
                                <p>{copy('Effective stake', '유효 스테이킹', '有効ステーキング量')}</p>
                                <strong title={`${amount(g.effective_stake)} ORBS`}>
                                    {compactAmount(g.effective_stake)} <small>ORBS</small>
                                </strong>
                            </div>
                            <div className="rd-card-links">
                                {safeWebsite(g.website) ? (
                                    <a href={safeWebsite(g.website)!} target="_blank" rel="noopener noreferrer">
                                        {copy('Website', '웹사이트', 'ウェブサイト')} ↗
                                    </a>
                                ) : (
                                    <span>—</span>
                                )}
                                <Link to={`/guardians/stake/${g.address}`}>
                                    {copy('View details', '상세 보기', '詳細を見る')} →
                                </Link>
                            </div>
                        </article>
                    ))}
                </div>
            )}
            <Pagination page={page} total={rows.length} size={9} onChange={setPage} />
        </main>
    );
}
function GuardianProfile({ address }: { address: string }) {
    const copy = useCopy();
    const locale = useLocale();
    const { section = 'stake' } = useParams<{ section?: string }>();
    const { web3, blockRef, chain } = useSelector((s: AppState) => s.main);
    const { guardians } = useSelector((s: AppState) => s.guardians);
    const dispatch = useDispatch();
    const overview = useSelector((s: AppState) => s.overview?.overviewData);
    useEffect(() => {
        if (!overview) dispatch(getOverviewAction(chain, web3));
    }, [chain, web3, dispatch, overview]);
    const [current, setCurrent] = useState<GuardianInfo | null>(null);
    const [historyState, setHistoryState] = useState<{
        data: Pick<GuardianInfo, 'stake_slices' | 'delegators'> | null;
        loading: boolean;
        error: boolean;
    }>({ data: null, loading: true, error: false });
    const { data: full, loading: historyLoading, error: historyError } = historyState;
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(false),
        [retry, setRetry] = useState(0),
        [days, setDays] = useState(30);
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(false);
        setCurrent(null);
        setHistoryState({ data: null, loading: true, error: false });
        if (!validAddress(address)) {
            setLoading(false);
            setError(true);
            setHistoryState({ data: null, loading: false, error: true });
            return;
        }
        pageRead(web3, `guardian-current:${address.toLowerCase()}`, () =>
            getGuardian(address.toLowerCase(), web3, { read_history: false }, blockRef)
        )
            .then((result) => {
                if (alive) setCurrent(result);
            })
            .catch(() => {
                if (alive) setError(true);
            })
            .finally(() => {
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [address, web3, blockRef, retry]);
    useEffect(() => {
        if (!validAddress(address) || section === 'about') return;
        let alive = true;
        setHistoryState((previous) => ({ ...previous, loading: true, error: false }));
        pageRead(web3, `guardian-stake:${address.toLowerCase()}`, () =>
            getGuardianStakeView(address.toLowerCase(), web3, blockRef)
        )
            .then((result) => {
                if (alive) setHistoryState({ data: result, loading: false, error: !result });
            })
            .catch(() => {
                if (alive) setHistoryState({ data: null, loading: false, error: true });
            });
        return () => {
            alive = false;
        };
    }, [address, web3, blockRef, section, retry]);
    const data = current;
    const registered = guardians?.find((g) => g.address.toLowerCase() === address.toLowerCase());
    const name = data?.details.name || registered?.name || copy('Guardian', '가디언', 'ガーディアン');
    const active = ['stake', 'delegators', 'about'].includes(section) ? section : 'stake';
    return (
        <main className="rn-main rd-main">
            <PageHeading
                title={
                    <span className="rd-profile-title">
                        <Avatar name={name} address={address} />
                        {name}
                    </span>
                }
                subtitle={<Address adaptive address={address} name={name} />}
            />
            <Link className="rd-back" to="/guardians">
                ‹ {copy('All Guardians', '전체 가디언', 'すべてのガーディアン')}
            </Link>
            <nav
                className="rd-tabs rd-profile-tabs"
                aria-label={copy('Guardian sections', '가디언 정보 탭', 'ガーディアン情報のタブ')}
            >
                {[
                    ['stake', copy('Stake', '스테이킹', 'ステーキング')],
                    ['delegators', copy('Delegators', '델리게이터', 'デリゲーター')],
                    ['about', copy('About', '정보', '基本情報')]
                ].map(([tab, label]) => (
                    <Link
                        key={tab}
                        aria-current={active === tab ? 'page' : undefined}
                        to={`/guardians/${tab}/${address}`}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {loading && !data ? (
                <Notice>{copy('Loading Guardian…', '가디언 정보 로딩 중…', 'ガーディアン情報を読み込み中…')}</Notice>
            ) : error && !data ? (
                <Notice error retry={() => setRetry((n) => n + 1)}>
                    {copy(
                        'Unable to load this Guardian. Check the address or retry.',
                        '가디언을 조회하지 못했습니다. 주소를 확인하거나 다시 시도하세요.',
                        'ガーディアン情報を読み込めませんでした。アドレスを確認するか、再試行してください。'
                    )}
                </Notice>
            ) : (
                data && (
                    <>
                        {active === 'stake' && (
                            <>
                                <div className="rd-metrics rd-three">
                                    <Metric
                                        title={copy('Total staked', '총 스테이킹', '総ステーキング量')}
                                        value={`${compactAmount(data.stake_status.total_stake)} ORBS`}
                                    />
                                    <Metric
                                        title={copy('Self-stake', '자체 수량', '自己ステーキング')}
                                        value={`${compactAmount(data.stake_status.self_stake)} ORBS`}
                                        icon="self-stake"
                                    />
                                    <Metric
                                        title={copy(
                                            'Delegators’ reward share',
                                            '델리게이터 보상 비율',
                                            'デリゲーターへの報酬配分率'
                                        )}
                                        value={`${amount(data.reward_status.delegator_reward_share * 100)}%`}
                                        icon="reward-share"
                                    />
                                </div>
                                <div className="rd-stake-layout">
                                    <StakeChart
                                        points={(full?.stake_slices || []).map((s) => ({
                                            time: s.block_time,
                                            value: s.total_stake,
                                            secondary: s.self_stake,
                                            delegates: s.n_delegates
                                        }))}
                                        days={days}
                                        onDays={setDays}
                                        loading={historyLoading}
                                        error={historyError}
                                        retry={() => setRetry((n) => n + 1)}
                                    />
                                    <aside className="rd-additional">
                                        <h2>{copy('Additional balances', '추가 수량 정보', 'その他の残高')}</h2>
                                        <p>{copy('Cooldown', '언락 진행 중', 'クールダウン')}</p>
                                        <strong>{amount(data.stake_status.cooldown_stake)} ORBS</strong>
                                        <small>
                                            {copy('ORBS awaiting withdrawal', '출금 대기 중인 ORBS', '出金待ちのORBS')}
                                        </small>
                                        {data.stake_status.cooldown_stake > 0 &&
                                            data.stake_status.current_cooldown_time > 0 && (
                                                <small>
                                                    {new Date(
                                                        data.stake_status.current_cooldown_time * 1000
                                                    ).toLocaleString(locale)}
                                                </small>
                                            )}
                                        <hr />
                                        <p>{copy('Non-staked balance', '미스테이킹 잔액', '未ステーキング残高')}</p>
                                        <strong>{amount(data.stake_status.non_stake)} ORBS</strong>
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
                        )}
                        {active === 'delegators' &&
                            (historyLoading ? (
                                <Notice>
                                    {copy('Loading delegators…', '델리게이터 로딩 중…', 'デリゲーターを読み込み中…')}
                                </Notice>
                            ) : historyError ? (
                                <Notice error retry={() => setRetry((n) => n + 1)}>
                                    {copy(
                                        'Unable to load delegators',
                                        '델리게이터를 불러오지 못했습니다',
                                        'デリゲーターを読み込めませんでした'
                                    )}
                                </Notice>
                            ) : full ? (
                                <GuardianWallets guardian={full} totalStake={data.stake_status.total_stake} />
                            ) : (
                                <Notice>
                                    {copy('Loading delegators…', '델리게이터 로딩 중…', 'デリゲーターを読み込み中…')}
                                </Notice>
                            ))}
                        {active === 'about' && (
                            <section className="rd-about">
                                <h2>{copy('Guardian details', '가디언 정보', 'ガーディアン情報')}</h2>
                                <dl>
                                    <div>
                                        <dt>{copy('Guardian address', '가디언 주소', 'ガーディアンアドレス')}</dt>
                                        <dd>
                                            <Address adaptive address={address} name={name} />
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{copy('Node IP', '노드 IP', 'ノードIP')}</dt>
                                        <dd>{data.details.ip || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt>{copy('Node address', '노드 주소', 'ノードアドレス')}</dt>
                                        <dd>
                                            {data.details.node_address ? (
                                                <Address adaptive address={data.details.node_address} subject="node" />
                                            ) : (
                                                '—'
                                            )}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{copy('Website', '웹사이트', 'ウェブサイト')}</dt>
                                        <dd>
                                            <Website value={data.details.website} />
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>
                                            {copy('Guardian information', '가디언 상세 정보', 'ガーディアンの詳細情報')}
                                        </dt>
                                        <dd>
                                            <Website value={data.details.details_URL} />
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>{copy('Registered', '등록일', '登録日')}</dt>
                                        <dd>
                                            {data.details.registration_time
                                                ? new Date(data.details.registration_time * 1000).toLocaleDateString(
                                                      locale
                                                  )
                                                : '—'}
                                        </dd>
                                    </div>
                                </dl>
                            </section>
                        )}
                    </>
                )
            )}
        </main>
    );
}
function Website({ value }: { value?: string }) {
    const url = safeWebsite(value);
    return url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
            {value} ↗
        </a>
    ) : (
        <>—</>
    );
}
function GuardianWallets({ guardian, totalStake }: { guardian: Pick<GuardianInfo, 'delegators'>; totalStake: number }) {
    const copy = useCopy();
    const [query, setQuery] = useState(''),
        [page, setPage] = useState(1),
        [sort, setSort] = useState('stake');
    useEffect(() => setPage(1), [query, sort]);
    const rows = [...guardian.delegators]
        .filter((d) => d.address.toLowerCase().includes(query.toLowerCase().trim()))
        .sort((a, b) => (sort === 'stake' ? b.stake - a.stake : a.address.localeCompare(b.address)));
    const total = totalStake;
    return (
        <section className="rn-panel">
            <h2>
                {copy('Delegators', '델리게이터', 'デリゲーター')}{' '}
                <small>
                    {guardian.delegators.length} {copy('wallets', '지갑', 'ウォレット')}
                </small>
            </h2>
            <div className="rd-toolbar">
                <SearchBox
                    value={query}
                    onChange={setQuery}
                    placeholder={copy('Search wallet address', '지갑 주소 검색', 'ウォレットアドレスを検索')}
                />
                <select
                    value={sort}
                    aria-label={copy('Sort delegators', '델리게이터 정렬', 'デリゲーターの並び順')}
                    onChange={(e) => setSort(e.target.value)}
                >
                    <option value="stake">
                        {copy('Total staked: high to low', '스테이킹 수량 내림차순', 'ステーキング量の多い順')}
                    </option>
                    <option value="address">{copy('Address', '주소', 'アドレス')}</option>
                </select>
            </div>
            <div className="rd-wallet-table">
                <div className="rd-wallet-head">
                    <span>{copy('Address', '주소', 'アドレス')}</span>
                    <span>{copy('Total staked', '총 스테이킹', '総ステーキング量')}</span>
                    <span>{copy('Stake share', '점유율', 'ステーキング比率')}</span>
                    <span>{copy('Non-staked balance', '미스테이킹 잔액', '未ステーキング残高')}</span>
                </div>
                {rows.slice((page - 1) * 10, page * 10).map((d) => (
                    <div className="rd-wallet-row" key={d.address}>
                        <Address
                            adaptive
                            address={d.address}
                            subject="delegator"
                            to={`/delegators/stake/${d.address}`}
                        />
                        <span>
                            <small>{copy('Total staked', '총 스테이킹', '総ステーキング量')}</small>
                            {amount(d.stake)} ORBS
                        </span>
                        <span className="rd-share">
                            <span>
                                <i style={{ width: `${total ? (d.stake / total) * 100 : 0}%` }} />
                            </span>
                            {(total ? (d.stake / total) * 100 : 0).toFixed(2)}%
                        </span>
                        <span>
                            <small>{copy('Non-staked balance', '미스테이킹 잔액', '未ステーキング残高')}</small>
                            {amount(d.non_stake)} ORBS
                        </span>
                    </div>
                ))}
            </div>
            {!rows.length && (
                <Notice>
                    {copy(
                        'No matching delegators',
                        '일치하는 델리게이터가 없습니다',
                        '一致するデリゲーターがありません'
                    )}
                </Notice>
            )}
            <Pagination page={page} total={rows.length} size={10} onChange={setPage} />
        </section>
    );
}
