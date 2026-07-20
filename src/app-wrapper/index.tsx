import React, { useEffect, useState } from 'react';
import App from '../app';
import { getRouterBaseName } from '../utils/router';
import { useDispatch } from 'react-redux';
import { setInitialConfiguration } from '../redux/actions/global-actions';
import { AppLoader } from '../components/app-loader/app-loader';
import { getRefBlocks } from 'pos-analytics-graph';
import { chains } from '../config';
import { CHAINS } from '../types';

const chain = getRouterBaseName();

function AppWrapper() {
    const [appLoading, setAppLoading] = useState(true);

    const dispatch = useDispatch();

    useEffect(() => {
        const onLoad = async () => {
            const chainConfig = chains[chain] || chains[CHAINS.ETHEREUM];
            const { getWeb3 } = chainConfig;

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
