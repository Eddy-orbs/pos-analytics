import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useParams } from 'react-router-dom';
import { RouteParams } from 'global/types';
import { findDelegatorAction, setDelegatorLoading } from 'redux/actions/actions';
import { AppState } from 'redux/types/types';
import { routes } from 'routes/routes';
import { useClickOutside } from 'react-click-outside-hook';
import LoupeImg from 'assets/images/loupe.svg';

import './delegator-search.scss';

export const DelegatorSearch = () => {
    const { delegatorNotFound, delegatorCurrentError } = useSelector((state: AppState) => state.delegator);
    const { web3, chain } = useSelector((state: AppState) => state.main);
    const [ref, hasClickedOutside] = useClickOutside();
    const [inputValue, setInputValue] = useState<string>('');
    const dispatch = useDispatch();
    const history = useHistory();
    const params: RouteParams = useParams();
    const { t } = useTranslation();

    const pushAddressAndFindDelegator = (address: string) => {
        const { section } = params;
        history.push(routes.delegators.main.replace(':section?', section).replace(':address?', address));
    };
    useEffect(() => {
        const { address } = params;
        if (hasClickedOutside) {
            if (!address) return;
            setInputValue(address);
        }
    }, [hasClickedOutside]);

    useEffect(() => {
        const { address } = params;
        if (!address || inputValue) return;
        setInputValue(address);
    }, [params.address]);

    useEffect(() => {
        const { address } = params;
        if (!address) {
            dispatch(setDelegatorLoading(false));
            return;
        }
        if (web3) dispatch(findDelegatorAction(address, web3));
    }, [params.address, chain, web3]);

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const value = e.clipboardData.getData('Text');
        pushAddressAndFindDelegator(value);
    };

    const submit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!inputValue) return;
        if (e.key === 'Enter' || e.keyCode === 13) {
            pushAddressAndFindDelegator(inputValue);
        }
    };

    return (
        <div className="delegator-search search-input flex-column">
            <p className="search-input-title">{t('main.address')}</p>
            <section className="search-input-box" ref={ref}>
                <button
                    type="button"
                    className="search-input-box-btn flex-center"
                    onClick={() => pushAddressAndFindDelegator(inputValue)}>
                    <img src={LoupeImg} alt="" />
                </button>
                <input
                    onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => submit(e)}
                    type="text"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                    value={inputValue}
                    onPaste={(e: React.ClipboardEvent<HTMLInputElement>) => handlePaste(e)}
                    placeholder={t('delegators.inputPlaceholder')}
                />
            </section>
            {delegatorNotFound && <p className="search-input-not-found">{t('delegators.notFound')}</p>}
            {delegatorCurrentError && params.address ? (
                <div className="search-input-load-error">
                    <p>{delegatorCurrentError}</p>
                    <button
                        type="button"
                        onClick={() => web3 && dispatch(findDelegatorAction(params.address as string, web3))}
                    >
                        {t('main.retry')}
                    </button>
                </div>
            ) : null}
        </div>
    );
};
