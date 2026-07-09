import { getWeb3 } from '@orbs-network/pos-analytics-lib';
import { CHAINS, IChain } from 'types';
import ethLogo from 'assets/images/chain/ethereum-menu-logo.svg'
import polygonLogo from 'assets/images/chain/polygon-menu-logo.svg'
import { ETHERSCAN_BLOCK_ADDRESS, POLYGONSCAN_BLOCK_ADDRESS } from 'keys/keys';
import { getWeb3PolygonFromRegistry } from 'utils/polygon-web3';


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
        getWeb3: () => getWeb3PolygonFromRegistry(process.env.REACT_APP_POLYGON_RPC!!),
        name:'Polygon',
        logo: polygonLogo,
        explorerUrl: POLYGONSCAN_BLOCK_ADDRESS
    }
};

export { chains };
