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

const chain = getRouterBaseName();

// Incremental subgraph-stream cache (session memory + IndexedDB). Toggle per visit:
//   ?cache=off   disable    ?cache=on   enable    ?cache=clear   wipe, then enable
// Default comes from REACT_APP_EVENT_CACHE ('off' disables); otherwise enabled.
// Subgraph endpoints default to The Graph Studio dev URLs (subgraph-events.ts);
// production overrides them via .env, e.g. the Fastly proxy on hub.orbs.network:
//   REACT_APP_SUBGRAPH_ETH=https://hub.orbs.network/posAnalyticsSubgraphEth
//   REACT_APP_SUBGRAPH_POLYGON=https://hub.orbs.network/posAnalyticsSubgraphPol
const setupSubgraphEndpoints = () => {
    const overrides: { [chainId: number]: string } = {};
    if (process.env.REACT_APP_SUBGRAPH_ETH) overrides[1] = process.env.REACT_APP_SUBGRAPH_ETH;
    if (process.env.REACT_APP_SUBGRAPH_POLYGON) overrides[137] = process.env.REACT_APP_SUBGRAPH_POLYGON;
    if (Object.keys(overrides).length) configurePosAnalyticsSubgraph(overrides);
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
    const [appLoading, setAppLoading] = useState(true);

    const dispatch = useDispatch();

    useEffect(() => {
        const onLoad = async () => {
            const chainConfig = chains[chain] || chains[CHAINS.ETHEREUM];
            const { getWeb3 } = chainConfig;

            setupSubgraphEndpoints();
            await setupStreamCache();
            const web3 = await getWeb3();
            const blockRef = await getRefBlocks([web3]);
            dispatch(setInitialConfiguration(chain, web3, blockRef));
            setAppLoading(false);
        };
        onLoad();
    }, []);

    return !appLoading ? <App /> : <AppLoader />;
}

export default AppWrapper;
