import { Artwork } from 'screens/renewal/artwork';
import { useGuardianColor } from 'screens/renewal/use-guardian-color';
import { PageHeading } from 'screens/renewal/shared';
import { useNetworkStatus } from 'components/analytics-layout/analytics-layout';
import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Redirect, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppState } from 'redux/types/types';
import { getOverviewAction } from 'redux/actions/actions';
import { chains } from 'config';
import { AddressCopyButton } from 'components/address-copy-button/address-copy-button';
import { committeePresentation, committeeSeries, committeeThirtyDayChange, stakeChartDomain } from './renewal-data';
import { PosOverviewSlice } from 'pos-analytics-graph';
import { renewalLabels } from './renewal-labels';

const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(n);
const stakeUrl = 'https://staking.orbs.network';
const emptySlices: PosOverviewSlice[] = [];

export const RenewalOverview = () => {
    const guardianColor = useGuardianColor();
    const { overviewData: data, overviewDataLoding: loading } = useSelector((s: AppState) => s.overview);
    const { chain, web3 } = useSelector((s: AppState) => s.main);
    const dispatch = useDispatch();
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const [days, setDays] = useState(30);
    const [hoveredTime, setHoveredTime] = useState<number | null>(null);
    const [selectedTime, setSelectedTime] = useState<number | null>(null);
    useEffect(() => {
        setHoveredTime(null);
        setSelectedTime(null);
    }, [days, chain]);
    const [search, setSearch] = useState('');
    const [guardianTab, setGuardianTab] = useState<'committee' | 'registered'>('committee');
    const { networkStatus, statusLoading, retryStatus } = useNetworkStatus();
    const delegatorCount =
        chains[chain].chainId === 1 ? networkStatus?.ethDelegators : networkStatus?.polygonDelegators;
    const delegatorCountState = statusLoading ? 'loading' : delegatorCount == null ? 'error' : 'ready';
    useEffect(() => {
        if (!data) dispatch(getOverviewAction(chain, web3));
    }, [chain, web3, dispatch, data]);
    const model = useMemo(() => committeePresentation(data?.slices || emptySlices), [data?.slices]);
    const series = useMemo(
        () => committeeSeries(model.ordered, days, data?.block_time || Math.floor(Date.now() / 1000)),
        [model.ordered, days, data?.block_time]
    );
    const thirtyDayChange = useMemo(
        () => (data ? committeeThirtyDayChange(model.ordered, data.block_time) : null),
        [model.ordered, data]
    );
    const registeredModel = useMemo(
        () =>
            committeePresentation([
                {
                    block_number: 0,
                    block_time: 0,
                    total_weight: 0,
                    total_effective_stake: 0,
                    data: data?.registered_guardians || []
                }
            ]),
        [data?.registered_guardians]
    );
    const listModel = guardianTab === 'committee' ? model : registeredModel;
    const visible = useMemo(
        () =>
            listModel.guardians.filter((g) =>
                `${g.name || ''} ${g.address}`.toLowerCase().includes(search.trim().toLowerCase())
            ),
        [listModel.guardians, search]
    );
    const share = (n: number) => (listModel.total > 0 ? (n / listModel.total) * 100 : 0);
    const domain = stakeChartDomain(series.map((p) => p.value));
    let tickLabels: string[] = [];
    for (let digits = 2; digits <= 9; digits++) {
        const formatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: digits });
        tickLabels = domain.ticks.map((value) => formatter.format(value));
        if (new Set(tickLabels).size === domain.ticks.length) break;
    }
    // Reserve room for precise tick labels, including the larger mobile font.
    const plotLeft = Math.max(58, ...tickLabels.map((text) => text.length * 14 + 12));
    const plotWidth = 738 - plotLeft;
    const points = series.map((p, i) => ({
        ...p,
        x: plotLeft + (i / days) * plotWidth,
        y: p.value === null ? 0 : 230 - ((p.value - domain.min) / (domain.max - domain.min)) * 200
    }));
    const activePoint = points.find((p) => p.time === (hoveredTime ?? selectedTime) && p.value !== null);
    const path = points
        .filter((p) => p.value !== null)
        .map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`)
        .join(' ');
    const lang = i18n.language || 'en-US';
    const label = (key: string, fallback: string) =>
        renewalLabels[lang.split('-')[0]]?.[key] || t(`renewal.${key}`, { defaultValue: fallback });
    const stakeLabel = t('overview.stakeYourTokens', { defaultValue: 'Stake your tokens' });
    if (location.pathname === '/overview/weights') return <Redirect to="/overview/stake" />;
    return (
        <main className="rn-main">
            <PageHeading
                showStakeCta
                title={label('title', 'Network overview')}
                subtitle={
                    <>
                        {label('activity', 'Staking activity on')} {chains[chain].name}
                    </>
                }
            />

            {!data && !loading && (
                <div role="alert" className="rn-error">
                    {label('unavailable', 'Unable to load network data.')}{' '}
                    <button onClick={() => dispatch(getOverviewAction(chain, web3))}>{label('retry', 'Retry')}</button>
                </div>
            )}
            <div className="rn-metrics" aria-busy={!data && loading}>
                <section>
                    <Artwork kind="coin" className="rn-metric-artwork" />
                    <div>
                        <p>
                            {label('total', 'Total staked')}
                        </p>
                        <h2>{data ? `${compact(data.total_stake)} ORBS` : '—'}</h2>
                        <div
                            className="rn-stake-change"
                            data-direction={
                                thirtyDayChange && thirtyDayChange.delta > 0
                                    ? 'up'
                                    : thirtyDayChange && thirtyDayChange.delta < 0
                                    ? 'down'
                                    : 'flat'
                            }
                            title={
                                thirtyDayChange
                                    ? `${new Date(thirtyDayChange.from * 1000).toLocaleDateString(lang)} → ${new Date(
                                          thirtyDayChange.to * 1000
                                      ).toLocaleDateString(lang)}: ${thirtyDayChange.before.toLocaleString(
                                          lang
                                      )} → ${thirtyDayChange.current.toLocaleString(lang)} ORBS`
                                    : label('noHistory', 'No history available')
                            }
                        >
                            <span>Effective Stake · {label('change30', '30-day change')}</span>
                            <strong>
                                {thirtyDayChange
                                    ? `${thirtyDayChange.percent > 0 ? '+' : ''}${thirtyDayChange.percent.toFixed(2)}%`
                                    : '—'}
                            </strong>
                        </div>
                    </div>
                </section>
                <section>
                    <Artwork kind="shield" className="rn-metric-artwork" />
                    <div>
                        <p>{label('participation', 'Network participation')}</p>
                        <h2>
                            {data ? data.n_guardians : '—'} {t('main.guardians', { defaultValue: 'Guardians' })}
                        </h2>
                        <div
                            className="rn-delegator-count"
                            role="status"
                            title={label(
                                'delegatorScope',
                                'Sum of guardian delegator counts reported by the official Orbs status page for this network; self-delegation excluded. Reference value.'
                            )}
                        >
                            {delegatorCountState === 'loading' ? (
                                label('delegatorsLoading', 'Counting delegators…')
                            ) : delegatorCountState === 'error' ? (
                                <>
                                    {label('delegatorsUnavailable', 'Delegator count unavailable')}{' '}
                                    <button type="button" className="rn-link" onClick={retryStatus}>
                                        {label('retry', 'Retry')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {delegatorCount?.toLocaleString(lang)} {label('activeDelegators', 'delegators')}
                                </>
                            )}
                        </div>
                    </div>
                </section>
            </div>
            <div className="rn-content">
                <section className="rn-panel rn-chart">
                    <div className="rn-panel-heading">
                        <h2>{label('history', 'Effective Stake over time')}</h2>
                        <span className="rn-chart-period">
                            <select
                                aria-label="Chart period"
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                            >
                                {[7, 30, 60].map((n) => (
                                    <option key={n} value={n}>
                                        {n} {label('days', 'days')}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </div>
                    {path ? (
                        <div
                            className="rn-chart-plot"
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    setHoveredTime(null);
                                    setSelectedTime(null);
                                }
                            }}
                        >
                            <svg
                                className="rn-chart-svg"
                                viewBox="0 0 760 275"
                                role="group"
                                aria-label="Committee Effective Stake history"
                            >
                                {domain.ticks.map((_tick, i) => (
                                    <g key={i}>
                                        <line
                                            x1={plotLeft}
                                            x2="738"
                                            y1={230 - (i * 200) / 3}
                                            y2={230 - (i * 200) / 3}
                                        />
                                        <text
                                            x={plotLeft - 12}
                                            y={234 - (i * 200) / 3}
                                            textAnchor="end"
                                            className="rn-chart-y-tick"
                                        >
                                            {tickLabels[i]}
                                        </text>
                                    </g>
                                ))}
                                <path d={path} className="rn-chart-line" />
                                {points
                                    .filter((p) => p.value !== null)
                                    .map((p) => (
                                        <g
                                            key={p.time}
                                            className="rn-chart-hit"
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`${new Date(p.time * 1000).toLocaleDateString(
                                                lang
                                            )}: ${p.value?.toLocaleString(lang, { maximumFractionDigits: 0 })} ORBS`}
                                            aria-pressed={selectedTime === p.time}
                                            aria-describedby={
                                                activePoint?.time === p.time ? 'rn-stake-tooltip' : undefined
                                            }
                                            onMouseEnter={() => setHoveredTime(p.time)}
                                            onMouseLeave={() => setHoveredTime(null)}
                                            onFocus={() => setHoveredTime(p.time)}
                                            onBlur={() => setHoveredTime(null)}
                                            onClick={() => setSelectedTime(selectedTime === p.time ? null : p.time)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedTime(selectedTime === p.time ? null : p.time);
                                                }
                                            }}
                                        >
                                            <circle
                                                cx={p.x}
                                                cy={p.y}
                                                r={Math.min(12, plotWidth / (2 * days))}
                                                fill="transparent"
                                            />
                                            <circle
                                                cx={p.x}
                                                cy={p.y}
                                                r={activePoint?.time === p.time ? 6 : 4}
                                                className="rn-chart-point"
                                            />
                                        </g>
                                    ))}
                                {[0, Math.floor(days / 2), days].map((i) => (
                                    <text
                                        key={i}
                                        x={points[i].x}
                                        y="260"
                                        textAnchor={i === 0 ? 'start' : i === days ? 'end' : 'middle'}
                                    >
                                        {new Date(points[i].time * 1000).toLocaleDateString(lang, {
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </text>
                                ))}
                            </svg>
                            {activePoint && (
                                <div
                                    id="rn-stake-tooltip"
                                    role="tooltip"
                                    className="rn-chart-tooltip"
                                    style={{
                                        left: `clamp(105px, ${(activePoint.x / 760) * 100}%, calc(100% - 105px))`,
                                        top: `${(activePoint.y / 275) * 100}%`
                                    }}
                                >
                                    <strong>
                                        {new Date(activePoint.time * 1000).toLocaleDateString(lang, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </strong>
                                    <span>
                                        {activePoint.value?.toLocaleString(lang, { maximumFractionDigits: 0 })} ORBS
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rn-empty">
                            {loading ? label('loading', 'Loading…') : label('noHistory', 'No history available')}
                        </div>
                    )}
                </section>
                <section className="rn-panel rn-list" data-guardian-tab={guardianTab}>
                    <div className="rn-guardian-tabs" role="tablist" aria-label="Guardian lists">
                        {(['committee', 'registered'] as const).map((tab) => (
                            <button
                                key={tab}
                                type="button"
                                role="tab"
                                id={`rn-tab-${tab}`}
                                aria-selected={guardianTab === tab}
                                aria-controls="rn-guardian-panel"
                                tabIndex={guardianTab === tab ? 0 : -1}
                                onClick={() => setGuardianTab(tab)}
                                onKeyDown={(e) => {
                                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                                        e.preventDefault();
                                        const next =
                                            e.key === 'Home'
                                                ? 'committee'
                                                : e.key === 'End'
                                                ? 'registered'
                                                : tab === 'committee'
                                                ? 'registered'
                                                : 'committee';
                                        setGuardianTab(next);
                                        document.getElementById(`rn-tab-${next}`)?.focus();
                                    }
                                }}
                            >
                                {tab === 'committee'
                                    ? label('committeeStakeTitle', 'Guardians in Committee')
                                    : label('registeredGuardiansTitle', 'All registered Guardians')}
                            </button>
                        ))}
                    </div>
                    <div id="rn-guardian-panel" role="tabpanel" aria-labelledby={`rn-tab-${guardianTab}`}>
                        <p>
                            {guardianTab === 'committee'
                                ? label('ranked', 'Committee Effective Stake · ranked largest first')
                                : label('registeredStakeDescription', 'Effective Stake · largest first')}
                        </p>
                        <div className="rn-guardian-search">
                            <svg
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <circle cx="10.5" cy="10.5" r="6.5" />
                                <path d="m16 16 5 5" />
                            </svg>
                            <input
                                type="search"
                                aria-label="Search Guardians"
                                placeholder={label('search', 'Search by name or address')}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="rn-table-head">
                            {guardianTab === 'committee' && <span>Rank</span>}
                            <span>{label('guardian', 'Guardian')}</span>
                            <span>Effective ORBS</span>
                            <span>
                                {guardianTab === 'committee'
                                    ? label('share', 'Share of committee')
                                    : label('registeredShare', 'Share of registered stake')}
                            </span>
                            <span>{label('address', 'Address')}</span>
                        </div>
                        <ul>
                            {visible.map((g) => (
                                <li
                                    key={g.address}
                                    style={{ '--row-color': guardianColor(g.address) } as React.CSSProperties}
                                >
                                    {guardianTab === 'committee' && (
                                        <span className="rn-rank" aria-label={`Rank ${g.rank}`}>
                                            {g.rank}
                                        </span>
                                    )}
                                    <Link
                                        className="rn-guardian-name"
                                        to={`/guardians/stake/${g.address}`}
                                        title={g.address}
                                    >
                                        <i />
                                        {g.name || `${g.address.slice(0, 6)}…${g.address.slice(-4)}`}
                                    </Link>
                                    <span className="rn-amount" title={g.effective_stake.toLocaleString(lang)}>
                                        {compact(g.effective_stake)}
                                        <span className="rn-mobile-unit"> ORBS</span>
                                    </span>
                                    <div className="rn-share">
                                        <span className="rn-track">
                                            <span style={{ width: `${share(g.effective_stake)}%` }} />
                                        </span>
                                        <span>{share(g.effective_stake).toFixed(1)}%</span>
                                    </div>
                                    <AddressCopyButton address={g.address} name={g.name} subject="guardian" />
                                </li>
                            ))}
                        </ul>
                        {!visible.length && (
                            <p className="rn-guardian-empty" role="status">
                                {loading ? label('loading', 'Loading…') : label('noResults', 'No matching Guardians')}
                            </p>
                        )}
                    </div>
                </section>
                <aside className="rn-panel rn-help">
                    <h2>{label('secure', 'Help secure the network')}</h2>
                    <p>{label('delegate', 'Delegate ORBS to a Guardian.')}</p>
                    <a className="rn-cta" href={stakeUrl} target="_blank" rel="noopener noreferrer">
                        {stakeLabel}
                    </a>
                    <a href={stakeUrl} target="_blank" rel="noopener noreferrer">
                        staking.orbs.network{' '}
                        <span className="rn-external-arrow" aria-hidden="true">
                            ↗
                        </span>
                    </a>
                </aside>
            </div>
        </main>
    );
};
