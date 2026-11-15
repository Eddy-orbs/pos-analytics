import React from 'react';
import assets from './artwork-assets.json';

// Figma handoff 221:613: original transparent artwork, delivered at 1x/2x/3x.
// Content-hashed URLs prevent stale artwork after a new export.
export function Artwork({ kind, className }: { kind: keyof typeof assets; className?: string }) {
    return <img {...assets[kind]} className={className} alt="" decoding="async" />;
}
