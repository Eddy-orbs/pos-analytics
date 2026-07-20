import { GuardianInfo } from 'pos-analytics-graph';
import { BalanceSection } from 'components/balance-section/balance-section';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertToString } from 'utils/number';
import BoostrapToken from 'assets/images/bootstrap-token.png';
import { GuardianMobileRewards } from 'global/types';
import trophy from 'assets/images/trophy.svg';
import commitee from 'assets/images/voting-booth.svg';
import fees from 'assets/images/coins.svg';





export const Total = ({ selectedGuardian, guardianIsLoading }: GuardianMobileRewards) => {
    const { t } = useTranslation();
    return (
        <>
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.total_guardian_rewards)}
                isLoading={guardianIsLoading}
                text={t('guardians.guardianRewards')}
                titleImg = {trophy}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.total_delegator_rewards)}
                isLoading={guardianIsLoading}
                text={t('guardians.selfStakeReward')}
                titleImg = {trophy}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.total_bootstrap)}
                isLoading={guardianIsLoading}
                text={t('guardians.certifiedCommittee')}
                customImg = {BoostrapToken}
                titleImg = {commitee}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.total_fees)}
                isLoading={guardianIsLoading}
                text={t('guardians.applicationFees')}
                titleImg = {fees}
            />
        </>
    );
};