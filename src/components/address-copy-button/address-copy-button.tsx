import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CopyImg from 'assets/images/copy.svg';
import './address-copy-button.scss';

type AddressSubject = 'guardian' | 'delegator' | 'node';

interface StateProps {
    address: string;
    subject: AddressSubject;
    name?: string;
}

interface AddressCopyMessages {
    label: string;
    copied: string;
}

export const getAddressCopyMessages = (language: string, subject: AddressSubject): AddressCopyMessages => {
    const normalizedLanguage = (language || 'en-US').toLowerCase();

    if (normalizedLanguage.indexOf('ko') === 0) {
        return {
            label:
                subject === 'guardian'
                    ? '가디언 주소 복사'
                    : subject === 'delegator'
                    ? '델리게이터 주소 복사'
                    : '노드 주소 복사',
            copied: '주소가 복사되었습니다.'
        };
    }

    if (normalizedLanguage.indexOf('ja') === 0) {
        return {
            label:
                subject === 'guardian'
                    ? 'ガーディアンアドレスをコピー'
                    : subject === 'delegator'
                    ? 'デリゲーターアドレスをコピー'
                    : 'ノードアドレスをコピー',
            copied: 'アドレスをコピーしました。'
        };
    }

    return {
        label:
            subject === 'guardian'
                ? 'Copy guardian address'
                : subject === 'delegator'
                ? 'Copy delegator address'
                : 'Copy node address',
        copied: 'Address copied.'
    };
};

const fallbackCopy = (address: string): boolean => {
    if (typeof document.execCommand !== 'function') return false;

    const textArea = document.createElement('textarea');
    textArea.value = address;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, address.length);

    try {
        return document.execCommand('copy');
    } catch (error) {
        return false;
    } finally {
        document.body.removeChild(textArea);
    }
};

const copyAddress = async (address: string): Promise<boolean> => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(address);
            return true;
        } catch (error) {
            return fallbackCopy(address);
        }
    }

    return fallbackCopy(address);
};

export const AddressCopyButton = ({ address, subject, name }: StateProps) => {
    const { i18n } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);
    const hideTimer = useRef<number | undefined>(undefined);
    const mounted = useRef(true);
    const messages = getAddressCopyMessages(i18n.language, subject);

    useEffect(
        () => () => {
            mounted.current = false;
            if (hideTimer.current !== undefined) window.clearTimeout(hideTimer.current);
        },
        []
    );

    const onCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        const success = await copyAddress(address);
        if (!mounted.current) return;
        setFailed(!success);
        if (!success) {
            setCopied(false);
            return;
        }

        setCopied(true);
        if (hideTimer.current !== undefined) window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => {
            if (mounted.current) setCopied(false);
        }, 2000);
    };

    return (
        <span className="address-copy">
            <button
                type="button"
                aria-label={`${messages.label}: ${name || address}`}
                title={`${messages.label}: ${address}`}
                onClick={onCopy}
            >
                {copied ? <span aria-hidden="true">✓</span> : <img src={CopyImg} alt="" />}
            </button>
            <span className="address-copy-hint" role="tooltip">
                {messages.label}: {address}
            </span>
            {failed && (
                <span className="address-copy-failure" role="alert">
                    {i18n.language.startsWith('ko')
                        ? '복사하지 못했습니다. 주소를 선택해 복사하세요.'
                        : i18n.language.startsWith('ja')
                        ? 'コピーできませんでした。アドレスを選択してコピーしてください。'
                        : 'Copy failed. Select the address to copy it.'}
                    <input
                        aria-label={messages.label}
                        readOnly
                        value={address}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.select();
                        }}
                    />
                    <button
                        type="button"
                        aria-label={
                            i18n.language.startsWith('ko')
                                ? '닫기'
                                : i18n.language.startsWith('ja')
                                ? '閉じる'
                                : 'Close'
                        }
                        onClick={(e) => {
                            e.stopPropagation();
                            setFailed(false);
                        }}
                    >
                        ×
                    </button>
                </span>
            )}
            {copied ? (
                <span className="address-copy-status" role="status" aria-live="polite">
                    {messages.copied}
                </span>
            ) : null}
        </span>
    );
};
