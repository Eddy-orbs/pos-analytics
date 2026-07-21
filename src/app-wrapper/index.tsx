import React, { useEffect, useState } from 'react';
import App from '../app';
import { getRouterBaseName } from '../utils/router';
import { useDispatch } from 'react-redux';
import { setInitialConfiguration } from '../redux/actions/global-actions';
import { AppLoader } from '../components/app-loader/app-loader';
import { chains } from '../config';
import { CHAINS } from '../types';
import { useTranslation } from 'react-i18next';
import { getAppConnectionMessages } from './app-status-messages';

const chain = getRouterBaseName();

function AppWrapper() {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [retrySequence, setRetrySequence] = useState(0);
    const dispatch = useDispatch();
    const { i18n } = useTranslation();
    const connectionMessages = getAppConnectionMessages(i18n.language);

    useEffect(() => {
        let mounted = true;
        const onLoad = async () => {
            setStatus('loading');
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
            <div className="app-loader app-loader-error" role="alert">
                <h5>{connectionMessages.title}</h5>
                <p>{connectionMessages.description}</p>
                <button type="button" onClick={() => setRetrySequence((value) => value + 1)}>
                    {connectionMessages.retry}
                </button>
            </div>
        );
    }
    return <AppLoader />;
}

export default AppWrapper;
