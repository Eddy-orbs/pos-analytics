import React, { useEffect, useState } from 'react';
import localforage from 'localforage';
import App from '../app';
import { getRouterBaseName } from '../utils/router';
import { useDispatch } from 'react-redux';
import { setInitialConfiguration } from '../redux/actions/global-actions';
import { AppLoader } from '../components/app-loader/app-loader';
import { getRefBlocks, configureStreamCache, configurePosAnalyticsSubgraph } from 'pos-analytics-graph';
import { chains } from '../config';
import { CHAINS } from '../types';
import { useTranslation } from 'react-i18next';
import { getAppInitializationMessages } from './app-status-messages';

const chain = getRouterBaseName();

// Incremental subgraph-stream cache (session memory + IndexedDB). Toggle per visit:
//   ?cache=off   disable    ?cache=on   enable    ?cache=clear   wipe, then enable
// Default comes from REACT_APP_EVENT_CACHE ('off' disables); otherwise enabled.
// Subgraph endpoints default to the production Fastly proxy on hub.orbs.network
// (subgraph-events.ts). Environment variables can optionally override them:
//   REACT_APP_SUBGRAPH_ETH=https://hub.orbs.network/posAnalyticsSubgraphEth
//   REACT_APP_SUBGRAPH_POLYGON=https://hub.orbs.network/posAnalyticsSubgraphPol
const setupSubgraphEndpoints = () => {
    const overrides: { [chainId: number]: string } = {};
    if (process.env.REACT_APP_SUBGRAPH_ETH) overrides[1] = process.env.REACT_APP_SUBGRAPH_ETH;
    if (process.env.REACT_APP_SUBGRAPH_POLYGON) overrides[137] = process.env.REACT_APP_SUBGRAPH_POLYGON;
    const alternatives: { [chainId: number]: string } = {};
    if (process.env.REACT_APP_SUBGRAPH_ETH_ALT) alternatives[1] = process.env.REACT_APP_SUBGRAPH_ETH_ALT;
    if (process.env.REACT_APP_SUBGRAPH_POLYGON_ALT) alternatives[137] = process.env.REACT_APP_SUBGRAPH_POLYGON_ALT;
    configurePosAnalyticsSubgraph(overrides, alternatives);
};

const setupStreamCache = async () => {
    const store = localforage.createInstance({ name: 'pos-analytics', storeName: 'stream_cache' });
    const param = new URLSearchParams(window.location.search).get('cache');
    if (param === 'clear') await store.clear();
    const enabled = param
        ? param !== 'off' && param !== '0' && param !== 'false'
        : process.env.REACT_APP_EVENT_CACHE !== 'off';
    configureStreamCache({ storage: store, enabled });
    console.log(`stream cache: ${enabled ? 'enabled' : 'disabled'}${param === 'clear' ? ' (cleared)' : ''}`);
};

function AppWrapper() {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [retrySequence, setRetrySequence] = useState(0);

    const dispatch = useDispatch();
    const { i18n } = useTranslation();
    const initializationMessages = getAppInitializationMessages(i18n.language);

    useEffect(() => {
        let mounted = true;
        const onLoad = async () => {
            setStatus('loading');
            const chainConfig = chains[chain] || chains[CHAINS.ETHEREUM];
            const { getWeb3 } = chainConfig;

            try {
                setupSubgraphEndpoints();
                await setupStreamCache();
                const web3 = await getWeb3();
                if (!web3) throw new Error('Web3 provider was not created');
                const blockRef = await getRefBlocks([web3]);
                if (!blockRef) throw new Error('Reference blocks were not loaded');
                if (!mounted) return;
                dispatch(setInitialConfiguration(chain, web3, blockRef));
                setStatus('ready');
            } catch (_loadError) {
                if (!mounted) return;
                setStatus('error');
            }
        };
        onLoad();
        return () => {
            mounted = false;
        };
    }, [dispatch, retrySequence]);

    if (status === 'ready') return <App />;
    if (status === 'error') {
        return (
            <AppLoader
                title={initializationMessages.title}
                description={initializationMessages.description}
                retryLabel={initializationMessages.retry}
                onRetry={() => setRetrySequence((value) => value + 1)}
            />
        );
    }
    return <AppLoader />;
}

export default AppWrapper;
