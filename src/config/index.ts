import { getWeb3, getWeb3Polygon } from '@orbs-network/pos-analytics-lib';
import { CHAINS, IChain } from 'types';
import ethLogo from 'assets/images/chain/ethereum-menu-logo.svg'
import polygonLogo from 'assets/images/chain/polygon-menu-logo.svg'
import { ETHERSCAN_BLOCK_ADDRESS, POLYGONSCAN_BLOCK_ADDRESS } from 'keys/keys';

export const DEFAULT_SUBGRAPH_BASE_URL = 'https://hub.orbs.network';

const configuredSubgraphBaseUrl = (process.env.REACT_APP_SUBGRAPH_BASE_URL || '').trim();

/**
 * Shared Subgraph host for Guardian and Delegator history queries. Keeping the
 * production default here means changing one environment variable is enough
 * to move both paths to the local indexer later.
 */
export const subgraphBaseUrl = (
    configuredSubgraphBaseUrl || DEFAULT_SUBGRAPH_BASE_URL
).replace(/\/+$/, '');

/** The legacy Orbs endpoint does not expose the Delegator stake-event index. */
export const indexedDelegatorHistoryEnabled =
    subgraphBaseUrl.toLowerCase() !== DEFAULT_SUBGRAPH_BASE_URL.toLowerCase();


const chains: { [key in CHAINS]: IChain} = {
    [CHAINS.ETHEREUM]: {
        rpc: process.env.REACT_APP_MAINNET_RPC!!,
        node: ['https://0xcore-management-direct.global.ssl.fastly.net/analytics'],
        chainId: 1,
        getWeb3: () => getWeb3(process.env.REACT_APP_MAINNET_RPC!!),
        name:'Ethereum',
        logo: ethLogo,
        explorerUrl: ETHERSCAN_BLOCK_ADDRESS
    },
    [CHAINS.POLYGON]: {
        rpc: process.env.REACT_APP_POLYGON_RPC!!,
        node: ['https://0xcore-matic-reader-direct.global.ssl.fastly.net/analytics'],
        chainId: 137,
        getWeb3: () => getWeb3Polygon(process.env.REACT_APP_POLYGON_RPC!!),
        name:'Polygon',
        logo: polygonLogo,
        explorerUrl: POLYGONSCAN_BLOCK_ADDRESS
    }
};

export { chains };
