import React from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { convertToString } from 'utils/number';
import TotalStakeImg from 'assets/images/cpu.svg';
import GuardiansImg from 'assets/images/encrypted.svg';
import { useTranslation } from 'react-i18next';
import { LoadingComponent } from 'components/loading-component/loading-component';
import { LoaderType } from 'global/enums';
import { OVERVIEW_STATUS_LINK } from 'global/variables';
import StellarImg from 'assets/images/stellar.svg';
import './overview-top.scss';
import { useIsMobileViewport } from 'hooks/useViewport';

interface StateProps {
  data?: number;
  textTop: string;
  textBottom: string;
  imgSrc: string;
  btnText: string;
  link?: string;
  noData?: boolean;
}

const OverviewTopSection = ({
  data,
  textTop,
  textBottom,
  imgSrc,
  btnText,
  link,
  noData,
}: StateProps) => {
  const isMobile = useIsMobileViewport();
  return (
    <section className="overview-top-section flex-column">
      <div className="overview-top-section-summary">
        <span className="flex-start-center img-text">
          <img src={imgSrc} alt="" />
          <span className="flex-column">
            {isMobile ? (
              <span className="text">
                {textTop} {textBottom}
              </span>
            ) : (
              <>
                <p>{textTop}</p>
                <p>{textBottom}</p>
              </>
            )}
          </span>
        </span>
        {!noData && (
          <LoadingComponent loaderType={LoaderType.TEXT} isLoading={data === undefined}>
            <h4 className="value">{convertToString(data)}</h4>
          </LoadingComponent>
        )}
      </div>
      <button type="button" className="flex-center btn-action">
        {link ? (
          <a className="flex-center" href={link} target="_blank" rel="noopener noreferrer">
            {btnText}
          </a>
        ) : (
          btnText
        )}
      </button>
    </section>
  );
};

const OverviewTopComponent = () => {
  const { overviewData, overviewDataLoding } = useSelector(
    (state: AppState) => state.overview
  );

  const { t } = useTranslation();
  return (
    <div className="overview-top flex-start-center">
      <OverviewTopSection
        textTop={t('overview.total')}
        textBottom={t('overview.stake')}
        data={overviewData?.total_stake}
        imgSrc={TotalStakeImg}
        btnText={t('overview.stakeYourTokens')}
        link="https://staking.orbs.network"
        noData={!overviewDataLoding && !overviewData}
      />
      <OverviewTopSection
        textTop={t('overview.guardians')}
        textBottom={t('overview.candidates')}
        data={overviewData?.n_guardians}
        imgSrc={GuardiansImg}
        btnText={t('overview.guardianList')}
        link="https://staking.orbs.network"
        noData={!overviewDataLoding && !overviewData}
      />
      <OverviewTopSection
        textTop={t('overview.network')}
        textBottom={t('overview.status')}
        imgSrc={StellarImg}
        btnText={t('overview.status')}
        link={OVERVIEW_STATUS_LINK}
        noData={true}
      />
    </div>
  );
};
export const OverviewTop = React.memo(OverviewTopComponent);
