import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CopyImg from 'assets/images/copy.svg';
import './address-copy-button.scss';

type AddressSubject = 'guardian' | 'delegator';

interface StateProps {
    address: string;
    subject: AddressSubject;
}

interface AddressCopyMessages {
    label: string;
    copied: string;
}

export const getAddressCopyMessages = (language: string, subject: AddressSubject): AddressCopyMessages => {
    const normalizedLanguage = (language || 'en-US').toLowerCase();

    if (normalizedLanguage.indexOf('ko') === 0) {
        return {
            label: subject === 'guardian' ? '가디언 주소 복사' : '델리게이터 주소 복사',
            copied: '주소가 복사되었습니다.'
        };
    }

    if (normalizedLanguage.indexOf('ja') === 0) {
        return {
            label: subject === 'guardian' ? 'ガーディアンアドレスをコピー' : 'デリゲーターアドレスをコピー',
            copied: 'アドレスをコピーしました。'
        };
    }

    return {
        label: subject === 'guardian' ? 'Copy guardian address' : 'Copy delegator address',
        copied: 'Address copied.'
    };
};

const fallbackCopy = (address: string): boolean => {
    if (!document.execCommand) return false;

    const textArea = document.createElement('textarea');
    textArea.value = address;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();

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

export const AddressCopyButton = ({ address, subject }: StateProps) => {
    const { i18n } = useTranslation();
    const [copied, setCopied] = useState(false);
    const hideTimer = useRef<number | undefined>(undefined);
    const messages = getAddressCopyMessages(i18n.language, subject);

    useEffect(() => () => {
        if (hideTimer.current !== undefined) window.clearTimeout(hideTimer.current);
    }, []);

    const onCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!(await copyAddress(address))) return;

        setCopied(true);
        if (hideTimer.current !== undefined) window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <span className="address-copy">
            <button type="button" aria-label={messages.label} onClick={onCopy}>
                <img src={CopyImg} alt="" />
            </button>
            {copied ? (
                <span className="address-copy-status" role="status" aria-live="polite">
                    {messages.copied}
                </span>
            ) : null}
        </span>
    );
};
