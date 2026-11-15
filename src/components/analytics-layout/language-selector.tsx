import React, { useEffect, useRef, useState } from 'react';

export function LanguageSelector({
    language,
    options,
    onChange,
    label
}: {
    language: string;
    options: Record<string, { name: string }>;
    onChange: (value: string) => void;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const code = (id: string) => (id.startsWith('ja') ? 'JP' : id.split('-')[0].toUpperCase());
    const entries = Object.entries(options);
    if (!entries.some(([id]) => id === language)) entries.unshift([language, { name: code(language) }]);
    const close = () => {
        setOpen(false);
        trigger.current?.focus();
    };
    useEffect(() => {
        if (!open) return;
        root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
        const outside = (e: MouseEvent) => {
            if (!root.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', outside);
        return () => document.removeEventListener('mousedown', outside);
    }, [open]);
    return (
        <div
            className="rn-language"
            ref={root}
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
            }}
        >
            <button
                type="button"
                ref={trigger}
                className="rn-language-trigger"
                aria-label={label}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls="rn-language-options"
                onClick={() => setOpen(!open)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setOpen(true);
                    }
                    if (e.key === 'Escape') close();
                }}
            >
                {code(language)}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
            </button>
            {open && (
                <div
                    id="rn-language-options"
                    className="rn-language-options"
                    role="listbox"
                    aria-label={label}
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            close();
                        }
                        const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
                        if (!keys.includes(e.key)) return;
                        e.preventDefault();
                        const items = Array.from(
                            e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')
                        );
                        const index = items.indexOf(document.activeElement as HTMLButtonElement);
                        const next =
                            e.key === 'Home'
                                ? 0
                                : e.key === 'End'
                                ? items.length - 1
                                : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                        items[next]?.focus();
                    }}
                >
                    {entries.map(([id, item]) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={id === language}
                            key={id}
                            title={item.name}
                            onClick={() => {
                                onChange(id);
                                close();
                            }}
                        >
                            {code(id)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
