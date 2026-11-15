import { LanguageSelector } from './language-selector';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from 'services/api';
import { SupportedLanguage } from 'global/types';
import { OVERVIEW_STATUS_LINK } from 'global/variables';
import { renewalLabels } from 'screens/overview/renewal-labels';
import { fetchNetworkStatus, NetworkStatus, RootNodeHealth } from 'screens/overview/root-node-health';
import { fetchOrbsPrice, OrbsPrice } from 'screens/overview/orbs-price';
import 'screens/overview/renewal.scss';

const NetworkContext = createContext<{
    networkStatus: NetworkStatus | null;
    statusLoading: boolean;
    retryStatus: () => void;
}>({ networkStatus: null, statusLoading: true, retryStatus: () => {} });
export const useNetworkStatus = () => useContext(NetworkContext);
function PriceWidget() {
    const [price, setPrice] = useState<OrbsPrice | null>(null);
    useEffect(() => {
        let mounted = true;
        const refresh = async () => {
            const result = await fetchOrbsPrice();
            if (mounted) setPrice(result);
        };
        void refresh();
        const interval = setInterval(refresh, 60000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);
    const change = price?.change24h;
    return (
        <section className="rn-price" aria-label="ORBS market price" aria-live="polite">
            <p>ORBS / USD</p>
            <strong className="rn-price-value">
                {price
                    ? new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: 'USD',
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 6
                      }).format(price.usd)
                    : '—'}
            </strong>
            <div
                className="rn-price-change"
                data-direction={change == null || change === 0 ? 'flat' : change > 0 ? 'up' : 'down'}
            >
                {change == null ? '—' : `${change > 0 ? '+' : ''}${change.toFixed(2)}%`} <span>(24h)</span>
            </div>
            <a
                className="rn-price-source"
                href="https://www.coingecko.com/en/coins/orbs"
                target="_blank"
                rel="noopener noreferrer"
            >
                CoinGecko
            </a>
        </section>
    );
}

export function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        root.current?.scrollTo(0, 0);
    }, [location.pathname]);
    const [theme, setTheme] = useState(() => {
        try {
            return localStorage.getItem('overview-theme') === 'dark' ? 'dark' : 'light';
        } catch {
            return 'light';
        }
    });
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (meta) meta.content = theme === 'dark' ? '#130f1d' : '#ffffff';
    }, [theme]);
    const [languages, setLanguages] = useState<{ [key: string]: SupportedLanguage }>({});
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusRetry, setStatusRetry] = useState(0);
    const [rootNodeHealth, setRootNodeHealth] = useState<Exclude<RootNodeHealth, null> | 'checking' | 'unavailable'>(
        'checking'
    );
    useEffect(() => {
        let mounted = true;
        const refresh = async () => {
            if (mounted) {
                setRootNodeHealth('checking');
                setStatusLoading(true);
            }
            const status = await fetchNetworkStatus();
            if (mounted) {
                setNetworkStatus(status);
                setRootNodeHealth(status?.health ?? 'unavailable');
                setStatusLoading(false);
            }
        };
        void refresh();
        const interval = setInterval(refresh, 600000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [statusRetry]);
    useEffect(() => {
        let mounted = true;
        api.getSupportedlanguages().then((result) => {
            if (mounted && result) setLanguages(result);
        });
        return () => {
            mounted = false;
        };
    }, []);
    const lang = i18n.language || 'en-US';
    const label = (key: string, fallback: string) =>
        renewalLabels[lang.split('-')[0]]?.[key] || t(`renewal.${key}`, { defaultValue: fallback });
    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        try {
            localStorage.setItem('overview-theme', next);
        } catch {
            /* session-only preference */
        }
    };
    return (
        <NetworkContext.Provider
            value={{ networkStatus, statusLoading, retryStatus: () => setStatusRetry((n) => n + 1) }}
        >
            <div className="rn-overview" data-theme={theme} ref={root}>
                <header className="rn-header">
                    <Link to="/overview/stake" aria-label="Orbs Analytics" className="rn-logo">
                        <img src={theme === 'dark' ? '/renewal/logo-dark.svg' : '/renewal/logo.svg'} alt="ORBS" />
                    </Link>
                    <div className="rn-utilities">
                        <button
                            type="button"
                            className="rn-theme"
                            onClick={toggleTheme}
                            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                {theme === 'light' ? (
                                    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
                                ) : (
                                    <>
                                        <circle cx="12" cy="12" r="4" />
                                        <path d="M12 2v2" />
                                        <path d="M12 20v2" />
                                        <path d="m4.93 4.93 1.41 1.41" />
                                        <path d="m17.66 17.66 1.41 1.41" />
                                        <path d="M2 12h2" />
                                        <path d="M20 12h2" />
                                        <path d="m6.34 17.66-1.41 1.41" />
                                        <path d="m19.07 4.93-1.41 1.41" />
                                    </>
                                )}
                            </svg>
                        </button>
                        <LanguageSelector
                            language={lang}
                            options={languages}
                            label={label('language', 'Language')}
                            onChange={(value) => {
                                void i18n.changeLanguage(value);
                            }}
                        />
                    </div>
                </header>
                <nav className="rn-nav" aria-label="Main navigation">
                    <p>ANALYTICS</p>
                    {[
                        ['/overview/stake', 'Overview'],
                        ['/guardians', 'Guardians'],
                        ['/delegators', 'Delegators']
                    ].map(([url, name]) => (
                        <Link
                            key={url}
                            to={url}
                            aria-current={
                                location.pathname.startsWith(url.split('/').slice(0, 2).join('/')) ? 'page' : undefined
                            }
                        >
                            {t(`main.${name.toLowerCase()}`, { defaultValue: name })}
                        </Link>
                    ))}
                </nav>
                {children}
                <div className="rn-sidebar-bottom">
                    <footer className="rn-links">
                        <a href="https://staking.orbs.network" target="_blank" rel="noopener noreferrer">
                            {label('guardianList', 'Guardians list')}{' '}
                            <span className="rn-external-arrow" aria-hidden="true">
                                ↗
                            </span>
                        </a>
                        <a
                            href={OVERVIEW_STATUS_LINK}
                            data-health={rootNodeHealth}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={
                                rootNodeHealth === 'checking'
                                    ? 'Checking Root Node Health…'
                                    : rootNodeHealth === 'unavailable'
                                    ? 'Unable to retrieve Root Node Health. This does not indicate a network outage.'
                                    : 'Root Node Health only. GOOD means Green; it does not guarantee all Orbs services are healthy.'
                            }
                        >
                            <i aria-hidden="true" />
                            <span role="status" aria-live="polite">
                                Status: {rootNodeHealth}
                            </span>{' '}
                            <span className="rn-external-arrow" aria-hidden="true">
                                ↗
                            </span>
                        </a>
                    </footer>
                    <div className="rn-price-area">
                        <PriceWidget />
                    </div>
                </div>
            </div>
        </NetworkContext.Provider>
    );
}
