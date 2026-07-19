import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { Reward } from 'components/reward/reward';
import { NoData } from 'components/no-data/no-data';
import TrophyImg from 'assets/images/trophy.svg';
import CommitteeImg from 'assets/images/voting-booth.svg';
import FeesImg from 'assets/images/coins.svg';
import OrbsToken from 'assets/images/token.png';
import BoostrapToken from 'assets/images/bootstrap-token.png';
import { ListMaterial } from 'components/list/list-material';
import { useIsMobileViewport } from 'hooks/useViewport';

export const GuardianRewardsTopDesktop = () => {
  const isMobile = useIsMobileViewport();
  const { selectedGuardian, guardianIsLoading } = useSelector(
    (state: AppState) => state.guardians
  );
  const { t } = useTranslation();
  const titles = [
    t('main.currentBalance'),
    t('main.alreadyClaimed'),
    `${t('main.totalClaimed')} (${t('main.untilNow')})`,
  ];
  if (!isMobile) {
    titles.unshift('');
  }
  const noData = !guardianIsLoading && !selectedGuardian;
  return noData ? (
    <NoData />
  ) : (
    <div className="guardian-rewards-top">
      <ListMaterial
        titles={titles}
        titleClassName="reward-title"
        listClassName="rewards-list"
      >
        <Reward
          current={selectedGuardian?.reward_status.guardian_rewards_balance}
          claimed={selectedGuardian?.reward_status.guardian_rewards_claimed}
          total={selectedGuardian?.reward_status.total_guardian_rewards}
          img={TrophyImg}
          token={OrbsToken}
          title={t('guardians.guardianRewards')}
          isLoading={guardianIsLoading}
        />
        <Reward
          current={selectedGuardian?.reward_status.delegator_rewards_balance}
          claimed={selectedGuardian?.reward_status.delegator_rewards_claimed}
          total={selectedGuardian?.reward_status.total_delegator_rewards}
          img={TrophyImg}
          token={OrbsToken}
          title={t('guardians.selfStakeReward')}
          isLoading={guardianIsLoading}
        />
        <Reward
          current={selectedGuardian?.reward_status.bootstrap_balance}
          claimed={selectedGuardian?.reward_status.bootstrap_claimed}
          total={selectedGuardian?.reward_status.total_bootstrap}
          img={CommitteeImg}
          token={BoostrapToken}
          title={t('guardians.certifiedCommittee')}
          isLoading={guardianIsLoading}
        />
        <Reward
          current={selectedGuardian?.reward_status.fees_balance}
          claimed={selectedGuardian?.reward_status.fees_claimed}
          total={selectedGuardian?.reward_status.total_fees}
          img={FeesImg}
          token={OrbsToken}
          title={t('guardians.applicationFees')}
          isLoading={guardianIsLoading}
        />
      </ListMaterial>
    </div>
  );
};
