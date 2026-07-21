import { getWeb3, getWeb3Polygon } from 'pos-analytics-graph';
import { CHAINS, IChain } from 'types';
import ethLogo from 'assets/images/chain/ethereum-menu-logo.svg'
import polygonLogo from 'assets/images/chain/polygon-menu-logo.svg'
import { ETHERSCAN_BLOCK_ADDRESS, POLYGONSCAN_BLOCK_ADDRESS } from 'keys/keys';


// Public own-infra defaults so the app builds and runs with no .env at all;
// REACT_APP_* env vars remain as overrides (e.g. for local experiments).
const MAINNET_RPC = process.env.REACT_APP_MAINNET_RPC || 'https://rpcman.orbs.network/rpc?chainId=1&appId=pos-analytics';
const POLYGON_RPC = process.env.REACT_APP_POLYGON_RPC || 'https://rpcman.orbs.network/rpc?chainId=137&appId=pos-analytics';

const chains: { [key in CHAINS]: IChain} = {
    [CHAINS.ETHEREUM]: {
        rpc: MAINNET_RPC,
        node: ['https://0xcore-management-direct.global.ssl.fastly.net/analytics'],
        chainId: 1,
        getWeb3: () => getWeb3(MAINNET_RPC),
        name:'Ethereum',
        logo: ethLogo,
        explorerUrl: ETHERSCAN_BLOCK_ADDRESS
    },
    [CHAINS.POLYGON]: {
        rpc: POLYGON_RPC,
        node: ['https://0xcore-matic-reader-direct.global.ssl.fastly.net/analytics'],
        chainId: 137,
        getWeb3: () => getWeb3Polygon(POLYGON_RPC),
        name:'Polygon',
        logo: polygonLogo,
        explorerUrl: POLYGONSCAN_BLOCK_ADDRESS
    }
};

export { chains };
