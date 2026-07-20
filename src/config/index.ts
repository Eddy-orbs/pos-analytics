import { getWeb3, getWeb3Polygon } from '@orbs-network/pos-analytics-lib';
import { CHAINS, IChain } from 'types';
import ethLogo from 'assets/images/chain/ethereum-menu-logo.svg'
import polygonLogo from 'assets/images/chain/polygon-menu-logo.svg'
import { ETHERSCAN_BLOCK_ADDRESS, POLYGONSCAN_BLOCK_ADDRESS } from 'keys/keys';

export const DEFAULT_SUBGRAPH_BASE_URL = 'https://hub.orbs.network';

const configuredSubgraphBaseUrl = (process.env.REACT_APP_SUBGRAPH_BASE_URL || '').trim();

async function currentContractAddresses(nodeEndpoints: string[]): Promise<any> {
    let lastError: any;
    for (const endpoint of nodeEndpoints) {
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Analytics node returned HTTP ${response.status}`);
            const body = await response.json();
            const addresses = body && body.Payload && body.Payload.CurrentContractAddress;
            if (!addresses || typeof addresses !== 'object') throw new Error('Analytics node omitted current contract addresses');
            return addresses;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError || new Error('No analytics node endpoint is configured');
}

async function initializeWeb3(endpoint: string, nodeEndpoints: string[], polygon: boolean): Promise<any> {
    try {
        const addresses = await currentContractAddresses(nodeEndpoints);
        return await (polygon
            ? getWeb3Polygon(endpoint, true, addresses)
            : getWeb3(endpoint, true, addresses));
    } catch (_nodeError) {
        return polygon ? getWeb3Polygon(endpoint) : getWeb3(endpoint);
    }
}

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


const ethereumNodes = ['https://0xcore-management-direct.global.ssl.fastly.net/analytics'];
const polygonNodes = ['https://0xcore-matic-reader-direct.global.ssl.fastly.net/analytics'];

const chains: { [key in CHAINS]: IChain} = {
    [CHAINS.ETHEREUM]: {
        rpc: process.env.REACT_APP_MAINNET_RPC!!,
        node: ethereumNodes,
        chainId: 1,
        getWeb3: () => initializeWeb3(process.env.REACT_APP_MAINNET_RPC!!, ethereumNodes, false),
        name:'Ethereum',
        logo: ethLogo,
        explorerUrl: ETHERSCAN_BLOCK_ADDRESS
    },
    [CHAINS.POLYGON]: {
        rpc: process.env.REACT_APP_POLYGON_RPC!!,
        node: polygonNodes,
        chainId: 137,
        getWeb3: () => initializeWeb3(process.env.REACT_APP_POLYGON_RPC!!, polygonNodes, true),
        name:'Polygon',
        logo: polygonLogo,
        explorerUrl: POLYGONSCAN_BLOCK_ADDRESS
    }
};

export { chains };
