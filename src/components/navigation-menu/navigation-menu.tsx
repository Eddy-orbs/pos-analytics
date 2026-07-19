import React, {
  FunctionComponent as Component,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  generateNavigationLinks,
  navigationImagesSrcArr,
} from '../../utils/navigation';
import Logo from '../../assets/images/navbar-logo.svg';
import { NavigationLink, RouteParams } from '../../global/types';
import { Languages } from './components/languages/Languages';
import { HamburgerButton } from 'react-hamburger-button';
import ChainSelector from '../ChainSelector'
import { useIsMobileViewport } from '../../hooks/useViewport';
import './navigation-menu.scss';

export const NavigationMenu: Component<any> = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobileViewport();


  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [sideMenuOpen, setSideMenuOpen] = useState<boolean>(false);
  const params: RouteParams = useParams();

  const openSideMenu = (open: boolean) => {
    setSideMenuOpen(open);
  };

  useEffect(() => {

    const { section } = params;

    setSelectedSection(section);

    const script = document.createElement('script');

    script.src = "https://crypto.com/price/static/widget/index.js";
    script.async = true;

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    }

  }, [params.section]);

  useEffect(() => {
    navigationImagesSrcArr.forEach((src: string) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  return (
    <>
      {isMobile ? (
        <div className="navigation-mobile">
          <div className="nav-header-mobile">
            <span className={`${sideMenuOpen ? 'd-none' : 'd-block'}`}>
              <HamburgerButton
                open={sideMenuOpen}
                onClick={() => openSideMenu(!sideMenuOpen)}
                width={20}
                height={14}
                strokeWidth={1}
                color="white"
                animationDuration={0.5}
              />
            </span>
            <img
              src={Logo}
              alt=""
              className={`nav-header-navigation-logo`}
            />
            <div className="titles">
              <p className="title">ORBS UNIVERSE</p>
              <p className="subtitle">ANALYTICS</p>
            </div>

          </div>
        </div>
      ) : (
        <nav className="navigation flex-column">
          <img src={Logo} alt="" className="navigation-logo" />
          <h4 className="navigation-title">{t('navigation.orbsUniverse')}</h4>
          <h5 className="navigation-sub-title">{t('navigation.analytics')}</h5>


          <ChainSelector />

          <div
              id="crypto-widget-CoinBlocks"
              data-transparent="true"
              className="crypto-com-widget"
              data-theme="dark"
              data-design="modern"
              data-coins="orbs"></div>


          <ul className="navigation-list flex-column">
            {generateNavigationLinks(t).map((link: NavigationLink) => {
              const { name, image, route, selectedImage } = link;
              const isSelected = selectedSection === name;
              const className = isSelected
                ? 'navigation-list-item navigation-list-item-selected'
                : 'navigation-list-item';
              return (
                <li className={className} key={name}>
                  <Link
                    to={route}
                    className="navigation-list-item-link flex-column"
                  >
                    <img src={isSelected ? selectedImage : image} alt={name} />
                    <p className="capitalize">{name}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Languages />
        </nav>
      )}
      {isMobile && sideMenuOpen && (
        <section className="side-nav-mobile">
          <nav className="navigation flex-column">
            <ul className="navigation-list flex-column">
              {generateNavigationLinks(t).map((link: NavigationLink) => {
                const { name, route } = link;
                const isSelected = selectedSection === name;
                const className = isSelected
                  ? 'navigation-list-item navigation-list-item-selected'
                  : 'navigation-list-item';
                return (
                  <li className={className} key={name}>
                    <Link
                      onClick = {() => setSideMenuOpen(false)}
                      to={route}
                      className="navigation-list-item-link flex-column"
                    >
                      <p className="capitalize">{name}</p>
                    </Link>
                  </li>
                );
              })}
               <ChainSelector />
            </ul>
            <Languages />
          </nav>
        </section>
      )}
    </>
  );
};
