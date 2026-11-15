import { useGuardianColor } from './use-guardian-color';
import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { AppState } from 'redux/types/types';
import { NetworkSelector } from 'screens/overview/network-selector';
import { stakeChartDomain } from 'screens/overview/renewal-data';
import './details.scss';

export { Address, validAddress, shortAddress } from './address';
export const amount = (value?: number) =>
    value == null || !Number.isFinite(value)
        ? '—'
        : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(value);
export const compactAmount = (value?: number) =>
    value == null || !Number.isFinite(value)
        ? '—'
        : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
export function safeWebsite(value?: string) {
    if (!value) return null;
    try {
        const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch {
        return null;
    }
}
export function useCopy() {
    const { i18n } = useTranslation();
    return (en: string, ko: string, ja: string) => {
        const language = (i18n.language || 'en').toLowerCase();
        return language.startsWith('ko') ? ko : language.startsWith('ja') ? ja : en;
    };
}
export function useLocale() {
    const { i18n } = useTranslation();
    return i18n.language || 'en-US';
}
export function PageHeading({
    title,
    subtitle,
    showStakeCta = false,
    children
}: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    showStakeCta?: boolean;
    children?: React.ReactNode;
}) {
    const { chain } = useSelector((s: AppState) => s.main);
    const copy = useCopy();
    return (
        <div className="rn-heading">
            <div className="rn-heading-copy">
                <h1>{title}</h1>
                {subtitle && <div className="rd-subtitle">{subtitle}</div>}
                {children}
            </div>
            <div className="rn-actions">
                <NetworkSelector chain={chain} />
                {showStakeCta && (
                    <a className="rn-cta" href="https://staking.orbs.network" target="_blank" rel="noopener noreferrer">
                        {copy('Stake your tokens', '토큰 스테이킹', 'トークンをステーキング')}
                    </a>
                )}
            </div>
        </div>
    );
}
export function Avatar({ name, address }: { name: string; address: string }) {
    const guardianColor = useGuardianColor();
    return (
        <span className="rd-avatar" style={{ background: guardianColor(address) }} aria-hidden="true">
            {name
                .split(/\s+/)
                .map((s) => s[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'OR'}
        </span>
    );
}

export function SearchBox({
    value,
    onChange,
    placeholder,
    onSubmit
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    onSubmit?: () => void;
}) {
    return (
        <form
            className="rd-search"
            role="search"
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit?.();
            }}
        >
            <button type="submit" aria-label={placeholder}>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 5 5" />
                </svg>
            </button>
            <input
                aria-label={placeholder}
                type="search"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
            />
        </form>
    );
}
export function Pagination({
    page,
    total,
    size,
    onChange
}: {
    page: number;
    total: number;
    size: number;
    onChange: (page: number) => void;
}) {
    const copy = useCopy();
    const pages = Math.max(1, Math.ceil(total / size));
    return (
        <div className="rd-pagination">
            <span>{total ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} / ${total}` : '0'}</span>
            <div>
                <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
                    {copy('Previous', '이전', '前へ')}
                </button>
                <span aria-live="polite">
                    {page} / {pages}
                </span>
                <button disabled={page >= pages} onClick={() => onChange(page + 1)}>
                    {copy('Next', '다음', '次へ')}
                </button>
            </div>
        </div>
    );
}
export function Metric({
    title,
    value,
    icon = 'total-staked',
    note
}: {
    title: string;
    value: React.ReactNode;
    icon?: 'total-staked' | 'self-stake' | 'reward-share' | 'delegated-to' | 'cooldown' | 'non-staked';
    note?: React.ReactNode;
}) {
    return (
        <section className="rd-metric">
            <span className="rd-metric-icon" aria-hidden="true">
                <img src={`/renewal/metric-icons/${icon}.svg`} width="20" height="20" alt="" />
            </span>
            <p>{title}</p>
            <h2>{value}</h2>
            {note && <small>{note}</small>}
        </section>
    );
}
export function Notice({
    children,
    error = false,
    retry
}: {
    children: React.ReactNode;
    error?: boolean;
    retry?: () => void;
}) {
    const copy = useCopy();
    return (
        <div className="rd-notice" role={error ? 'alert' : 'status'}>
            {children}
            {retry && (
                <button className="rn-link" onClick={retry}>
                    {copy('Retry', '다시 시도', '再試行')}
                </button>
            )}
        </div>
    );
}
export interface StakePoint {
    time: number;
    value: number;
    secondary?: number;
    delegates?: number;
}
export function StakeChart({
    points,
    days,
    onDays,
    loading,
    error,
    retry,
    periods = [30, 60, 300]
}: {
    periods?: number[];
    points: StakePoint[];
    days: number;
    onDays: (days: number) => void;
    loading?: boolean;
    error?: boolean;
    retry?: () => void;
}) {
    const copy = useCopy();
    const { i18n } = useTranslation();
    const locale = i18n.language || 'en-US';
    const [hovered, setHovered] = useState<StakePoint | null>(null);
    const [selected, setSelected] = useState<StakePoint | null>(null);
    const active = hovered || selected;
    const clearActive = () => {
        setHovered(null);
        setSelected(null);
    };
    useEffect(() => {
        clearActive();
    }, [days, loading]);
    const formatValue = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 0 });
    const ordered = [...points].filter((p) => Number.isFinite(p.value)).sort((a, b) => a.time - b.time);
    const end = ordered.length ? ordered[ordered.length - 1].time : Date.now() / 1000;
    const start = end - days * 86400;
    const before = ordered.filter((p) => p.time < start).pop();
    const visible = [...(before ? [{ ...before, time: start }] : []), ...ordered.filter((p) => p.time >= start)];
    const hasSecondary = visible.some((p) => p.secondary !== undefined);
    const countLabel = copy('Delegator count', '델리게이터 수', 'デリゲーター数');
    const hasDelegates = visible.some((p) => p.delegates !== undefined && Number.isFinite(p.delegates));
    const countMax = Math.max(3, Math.ceil(Math.max(0, ...visible.map((p) => p.delegates || 0)) / 3) * 3);
    const countY = (count: number) => 230 - (count / countMax) * 190;
    const plotRight = hasDelegates ? 670 : 720;
    const domain = stakeChartDomain(
        visible.flatMap((p) => (p.secondary === undefined ? [p.value] : [p.value, p.secondary]))
    );
    const x = (time: number) => 70 + ((time - start) / (days * 86400)) * (plotRight - 70);
    const y = (value: number) => 230 - ((value - domain.min) / (domain.max - domain.min)) * 190;
    const path = (secondary = false) =>
        visible.map((p, i) => `${i ? 'L' : 'M'}${x(p.time)},${y(secondary ? p.secondary || 0 : p.value)}`).join(' ');
    return (
        <section className="rn-panel rd-chart">
            <div className="rn-panel-heading">
                <h2>{copy('Stake over time', '스테이킹 수량 변동', 'ステーキング数量の推移')}</h2>
                <span className="rn-chart-period">
                    <select
                        aria-label={copy('Chart period', '차트 기간', 'チャート期間')}
                        value={days}
                        onChange={(e) => {
                            clearActive();
                            onDays(Number(e.target.value));
                        }}
                    >
                        {periods.map((d) => (
                            <option key={d} value={d}>
                                {d} {copy('days', '일', '日')}
                            </option>
                        ))}
                    </select>
                </span>
            </div>
            {loading ? (
                <Notice>
                    {copy('Loading stake history…', '스테이킹 이력 로딩 중…', 'ステーキング履歴を読み込み中…')}
                </Notice>
            ) : error ? (
                <Notice error retry={retry}>
                    {copy(
                        'Unable to load stake history. Current balances are still available.',
                        '이력을 불러오지 못했습니다. 현재 잔액은 계속 확인할 수 있습니다.',
                        'ステーキング履歴を読み込めませんでした。現在の残高は引き続き確認できます。'
                    )}
                </Notice>
            ) : !visible.length ? (
                <Notice>
                    {copy('No history available', '조회 가능한 이력이 없습니다', '表示できる履歴がありません')}
                </Notice>
            ) : (
                <>
                    <div className="rd-chart-legend">
                        <span>● {copy('Total staked', '총 스테이킹', '総ステーキング量')}</span>
                        {hasSecondary && <span>● {copy('Self-stake', '자체 수량', '自己ステーキング')}</span>}
                        {hasDelegates && <span className="rd-count-label">● {countLabel}</span>}
                    </div>
                    <div
                        className="rd-chart-plot"
                        onClick={(event) => {
                            if (!(event.target as Element).closest('.rn-chart-hit')) clearActive();
                        }}
                    >
                        <svg
                            viewBox="0 0 760 275"
                            className="rn-chart-svg"
                            role="group"
                            aria-label={copy('Stake history', '스테이킹 이력', 'ステーキング履歴')}
                        >
                            {domain.ticks.map((tick, i) => (
                                <g key={i}>
                                    <line x1="70" x2={plotRight} y1={230 - (i * 190) / 3} y2={230 - (i * 190) / 3} />
                                    <text x="60" y={234 - (i * 190) / 3} textAnchor="end">
                                        {compactAmount(tick)}
                                    </text>
                                </g>
                            ))}
                            {hasDelegates &&
                                [0, 1, 2, 3].map((i) => (
                                    <text
                                        key={`count-${i}`}
                                        x={plotRight + 12}
                                        y={234 - (i * 190) / 3}
                                        className="rd-count-label"
                                    >
                                        {formatValue((countMax * i) / 3)}
                                    </text>
                                ))}
                            {hasDelegates && (
                                <path
                                    className="rd-count-line"
                                    d={visible
                                        .map((p, i) =>
                                            p.delegates === undefined
                                                ? ''
                                                : `${i === 0 || visible[i - 1].delegates === undefined ? 'M' : 'L'}${x(
                                                      p.time
                                                  )},${countY(p.delegates)}`
                                        )
                                        .join(' ')}
                                />
                            )}
                            <path d={path()} className="rn-chart-line" />
                            {hasSecondary && <path d={path(true)} className="rd-secondary-line" />}
                            {visible.map((p, i) => (
                                <g
                                    key={i}
                                    className="rn-chart-hit"
                                    tabIndex={0}
                                    role="button"
                                    aria-label={`${new Date(p.time * 1000).toLocaleDateString(locale)}: ${formatValue(
                                        p.value
                                    )} ORBS`}
                                    aria-pressed={selected?.time === p.time}
                                    aria-describedby={active?.time === p.time ? 'rd-stake-tooltip' : undefined}
                                    onFocus={() => setHovered(p)}
                                    onBlur={() => setHovered(null)}
                                    onMouseEnter={() => setHovered(p)}
                                    onMouseLeave={() => setHovered(null)}
                                    onClick={() => {
                                        setHovered(null);
                                        setSelected(selected?.time === p.time ? null : p);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setHovered(null);
                                            setSelected(selected?.time === p.time ? null : p);
                                        }
                                        if (e.key === 'Escape') clearActive();
                                    }}
                                >
                                    {p.delegates !== undefined && (
                                        <>
                                            <circle cx={x(p.time)} cy={countY(p.delegates)} r="12" fill="transparent" />
                                            <circle
                                                cx={x(p.time)}
                                                cy={countY(p.delegates)}
                                                r="4"
                                                className="rd-count-point"
                                            />
                                        </>
                                    )}
                                    <circle cx={x(p.time)} cy={y(p.value)} r="12" fill="transparent" />
                                    <circle
                                        cx={x(p.time)}
                                        cy={y(p.value)}
                                        r={active?.time === p.time ? 6 : 4}
                                        className="rn-chart-point"
                                    />
                                </g>
                            ))}
                            {[start, start + days * 43200, end].map((time, i) => (
                                <text
                                    key={i}
                                    x={70 + (i * (plotRight - 70)) / 2}
                                    y="265"
                                    textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                                >
                                    {new Date(time * 1000).toLocaleDateString(locale, {
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </text>
                            ))}
                        </svg>
                        {active && (
                            <div
                                id="rd-stake-tooltip"
                                role="tooltip"
                                className="rn-chart-tooltip"
                                style={{
                                    left: `clamp(105px, ${(x(active.time) / 760) * 100}%, calc(100% - 105px))`,
                                    top: `${(y(active.value) / 275) * 100}%`
                                }}
                            >
                                <strong>
                                    {new Date(active.time * 1000).toLocaleDateString(locale, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </strong>
                                <span>
                                    {hasSecondary ? `${copy('Total staked', '총 스테이킹', '総ステーキング量')}: ` : ''}
                                    {formatValue(active.value)} ORBS
                                </span>
                                {active.delegates !== undefined && (
                                    <span>
                                        {countLabel}: {formatValue(active.delegates)}
                                    </span>
                                )}
                                {active.secondary !== undefined && (
                                    <span>
                                        {copy('Self-stake', '자체 수량', '自己ステーキング')}:{' '}
                                        {formatValue(active.secondary)} ORBS
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
