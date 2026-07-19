import { chains } from 'config';
import useOnClickOutside from 'hooks/useClickPutside';
import React, { useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from 'redux/types/types';
import { CHAINS, IChain } from 'types';
import { getRouterBasePath } from 'utils/router';
import './style.scss';

interface ExtendedChain extends IChain {
    key: CHAINS;
}

const chainsArray = (chain: CHAINS) => {
    const result: any = [];
    Object.keys(chains).forEach(function (key) {
        if (chain !== key) {
            result.push({ ...chains[key as CHAINS], key });
        }
    });
    return result;
};

function ChainSelector() {
    const { chain } = useSelector((state: AppState) => state.main);
    const ref = useRef<any>(null);
    const [showList, setShowList] = useState(false);
    useOnClickOutside(ref, () => setShowList(false));
    const chainsList = useMemo(() => chainsArray(chain), [chain]);

    const currentChain = chains[chain as CHAINS];

    return (
        <div className={`chain-selector ${showList && 'chain-selector-open'}`} ref={ref}>
            <div className="chain-selector-current" onClick={() => setShowList(!showList)}>
                <img src={currentChain.logo} />
                {currentChain.name}
                <figure className="arrow-down"></figure>
            </div>
            {showList && (
                <ul className="chain-selector-list">
                    {chainsList.map((c: ExtendedChain) => {
                        return (
                            <li key = {c.key}>
                                <a href={getRouterBasePath(process.env.PUBLIC_URL, c.key)}>
                                    <img src={c.logo} />
                                    {c.name}
                                </a>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default ChainSelector;
