import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AddressCopyButton } from 'components/address-copy-button/address-copy-button';

export const validAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value);
export const shortAddress = (value: string) => (value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—');

// Keep as much of the address as the available single line can actually display.
export function fitAddress(address: string, available: number, widthOf: (text: string) => number): string {
    if (widthOf(address) <= available) return address;
    let low = 0,
        high = address.length - 1,
        best = '…';
    while (low <= high) {
        const count = Math.floor((low + high) / 2);
        const left = Math.ceil(count / 2),
            right = Math.floor(count / 2);
        const candidate = `${address.slice(0, left)}…${right ? address.slice(-right) : ''}`;
        if (widthOf(candidate) <= available) {
            best = candidate;
            low = count + 1;
        } else high = count - 1;
    }
    return best;
}

export function Address({
    address,
    name,
    to,
    subject = 'guardian',
    adaptive = false
}: {
    address: string;
    name?: string;
    to?: string;
    subject?: 'guardian' | 'delegator' | 'node';
    adaptive?: boolean;
}) {
    const container = useRef<HTMLSpanElement>(null);
    const measure = useRef<HTMLSpanElement>(null);
    const [displayAddress, setDisplayAddress] = useState(address);
    useEffect(() => {
        if (!adaptive || !container.current || !measure.current) return;
        const element = container.current;
        const measurement = measure.current;
        const button = element.querySelector('.address-copy');
        const check = () => {
            const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
            const available =
                element.getBoundingClientRect().width - (button?.getBoundingClientRect().width || 0) - gap;
            const result = fitAddress(address, available, (text) => {
                measurement.textContent = text;
                return measurement.getBoundingClientRect().width;
            });
            measurement.textContent = address;
            setDisplayAddress(result);
        };
        const observer = new ResizeObserver(check);
        observer.observe(element);
        observer.observe(measurement);
        if (button) observer.observe(button);
        check();
        return () => observer.disconnect();
    }, [address, adaptive]);
    const value = adaptive ? displayAddress : shortAddress(address);
    return (
        <span ref={container} className={`rd-address${adaptive ? ' rd-address-adaptive' : ''}`}>
            <span className="rd-address-text">
                {to ? (
                    <Link to={to} title={address}>
                        {value}
                    </Link>
                ) : (
                    <span title={address}>{value}</span>
                )}
                {adaptive && (
                    <span ref={measure} className="rd-address-measure" aria-hidden="true">
                        {address}
                    </span>
                )}
            </span>
            <AddressCopyButton address={address} name={name} subject={subject} />
        </span>
    );
}
