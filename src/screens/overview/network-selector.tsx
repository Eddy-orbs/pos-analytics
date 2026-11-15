import React, { useEffect, useRef, useState } from 'react';
import { chains } from 'config';
import { CHAINS } from 'types';

export function NetworkSelector({ chain }: { chain: CHAINS }) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const options = Object.values(CHAINS);
    useEffect(() => {
        if (!open) return;
        const outside = (event: MouseEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', outside);
        const selected = root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
        selected?.focus();
        return () => document.removeEventListener('mousedown', outside);
    }, [open]);
    const close = () => { setOpen(false); trigger.current?.focus(); };
    return <div className="rn-network" ref={root} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
        <button type="button" ref={trigger} className="rn-network-trigger" aria-label={`Network: ${chains[chain].name}`}
            aria-haspopup="listbox" aria-expanded={open} aria-controls="rn-network-options"
            onClick={() => setOpen(!open)} onKeyDown={event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
                if (event.key === 'Escape') close();
            }}>
            <img src={chains[chain].logo} alt="" /><span>{chains[chain].name}</span>
            <svg className="rn-network-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {open && <div className="rn-network-options" id="rn-network-options" role="listbox" aria-label="Network" onKeyDown={event => {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[next]?.focus();
            }
        }}>
            {options.map(value => <button type="button" role="option" key={value} aria-selected={value === chain} onClick={() => {
                close();
                if (value !== chain) window.location.assign(window.location.pathname.replace(/^\/(ethereum|polygon)(?=\/|$)/, `/${value}`) + window.location.search);
            }}><img src={chains[value].logo} alt="" /><span>{chains[value].name}</span>{value === chain && <span className="rn-network-check" aria-hidden="true">✓</span>}</button>)}
        </div>}
    </div>;
}
