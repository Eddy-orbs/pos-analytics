import React from 'react'
import './loaders.scss';

export const BigLoader = () => {
    return (
        <div className='loader loader-big' role="status" aria-live="polite" aria-label="Loading data">
            <figure></figure>
            <span className="loader-label">Loading…</span>
        </div>
    )
}
