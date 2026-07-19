import React from 'react';
import { render } from '@testing-library/react';
import { ListMaterial } from './list-material';

describe('ListMaterial loading state', () => {
    it('keeps the real table columns while rendering skeleton rows', () => {
        const { container, getAllByRole, queryByText } = render(
            <ListMaterial
                titles={['Address', 'Stake', 'Non-staked balance']}
                titleClassName="list-titles"
                isLoading
                loadingRows={4}
            >
                <span>Loaded row</span>
            </ListMaterial>
        );

        expect(getAllByRole('columnheader')).toHaveLength(3);
        expect(container.querySelectorAll('.list-skeleton-row')).toHaveLength(4);
        expect(container.querySelectorAll('.list-skeleton-cell')).toHaveLength(12);
        expect(queryByText('Loaded row')).toBeNull();
    });
});
