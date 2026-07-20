import { Guardian, GuardianInfo } from 'pos-analytics-graph';
import { BalanceSection } from 'components/balance-section/balance-section';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertToString } from 'utils/number';
import BoostrapToken from 'assets/images/bootstrap-token.png';
import { GuardianMobileRewards } from 'global/types';
import trophy from 'assets/images/trophy.svg';
import commitee from 'assets/images/voting-booth.svg';
import fees from 'assets/images/coins.svg';



export const CurrectBalance = ({ selectedGuardian, guardianIsLoading }: GuardianMobileRewards) => {
    const { t } = useTranslation();
    return (
        <>
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.guardian_rewards_balance)}
                isLoading={guardianIsLoading}
                text={t('guardians.guardianRewards')}
                titleImg = {trophy}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.delegator_rewards_balance)}
                isLoading={guardianIsLoading}
                text={t('guardians.selfStakeReward')}
                titleImg = {trophy}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.bootstrap_balance)}
                isLoading={guardianIsLoading}
                text={t('guardians.certifiedCommittee')}
                customImg = {BoostrapToken}
                titleImg = {commitee}
            />
            <BalanceSection
                data={convertToString(selectedGuardian?.reward_status.fees_balance)}
                isLoading={guardianIsLoading}
                text={t('guardians.applicationFees')}
                titleImg = {fees}
            />
        </>
    );
};