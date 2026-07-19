import React, { useEffect, useState } from 'react';
import App from '../app';
import { getRouterBaseName } from '../utils/router';
import { useDispatch } from 'react-redux';
import { setInitialConfiguration } from '../redux/actions/global-actions';
import { AppLoader } from '../components/app-loader/app-loader';
import { chains } from '../config';
import { CHAINS } from '../types';

const chain = getRouterBaseName();

function AppWrapper() {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [retrySequence, setRetrySequence] = useState(0);
    const [error, setError] = useState<string>();

    const dispatch = useDispatch();

    useEffect(() => {
        let mounted = true;
        const onLoad = async () => {
            setStatus('loading');
            setError(undefined);
            const chainConfig = chains[chain] || chains[CHAINS.ETHEREUM];
            const { getWeb3 } = chainConfig;
            try {
                const web3 = await getWeb3();
                if (!web3) throw new Error('Web3 provider was not created');
                if (!mounted) return;
                dispatch(setInitialConfiguration(chain, web3));
                setStatus('ready');
            } catch (_loadError) {
                if (!mounted) return;
                setError('Unable to connect to the RPC provider');
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
            <div className="app-loader app-loader-error">
                <h5>{error || 'Unable to connect to the RPC provider'}</h5>
                <button type="button" onClick={() => setRetrySequence((value) => value + 1)}>Retry</button>
            </div>
        );
    }
    return <AppLoader />;
}

export default AppWrapper;
