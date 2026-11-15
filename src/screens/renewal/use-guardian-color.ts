import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { committeePresentation } from 'screens/overview/renewal-data';
import { guardianColor } from './guardian-color';

export function useGuardianColor() {
    const slices = useSelector((s: AppState) => s.overview?.overviewData?.slices);
    return useMemo(() => {
        const ranks = new Map(
            committeePresentation(slices || []).guardians.map((g) => [g.address.toLowerCase(), g.rank])
        );
        return (address: string) => guardianColor(ranks.get(address.toLowerCase()));
    }, [slices]);
}
