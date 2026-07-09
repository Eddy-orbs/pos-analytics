import { getWeb3Polygon } from '@orbs-network/pos-analytics-lib';
import { delegationAbi } from '@orbs-network/pos-analytics-lib/dist/abis/delegation';
import { erc20PolygonAbi } from '@orbs-network/pos-analytics-lib/dist/abis/erc20-polygon';
import { feeBootstrapRewardAbi } from '@orbs-network/pos-analytics-lib/dist/abis/feebootstrap';
import { guardianAbi } from '@orbs-network/pos-analytics-lib/dist/abis/guardian';
import { registryAbi } from '@orbs-network/pos-analytics-lib/dist/abis/registry';
import { rewardsAbi } from '@orbs-network/pos-analytics-lib/dist/abis/rewards';
import { stakeAbi } from '@orbs-network/pos-analytics-lib/dist/abis/stake';

const POLYGON_ERC20_ADDRESS = '0x614389EaAE0A6821DC49062D56BDA3d9d45Fa2ff';
const POLYGON_ERC20_START_BLOCK = 14283390;
const POLYGON_STAKE_ADDRESS = '0xeeae6791f684117b7028b48cb5dd21186df80b9c';
const POLYGON_STAKE_START_BLOCK = 25487295;
const POLYGON_REGISTRY_ADDRESS = '0x35eA0D75b2a3aB06393749B4651DfAD1Ffd49A77';
const POLYGON_REGISTRY_START_BLOCK = 25502848;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const CONTRACTS = {
    Erc20: 'Erc20',
    Stake: 'Stake',
    Delegate: 'delegations',
    Reward: 'stakingRewards',
    FeeBootstrapReward: 'feesAndBootstrapRewards',
    Guardian: 'guardiansRegistration',
    Registry: 'ContractRegistry'
};

const REGISTRY_CONTRACTS = [
    CONTRACTS.Delegate,
    CONTRACTS.Reward,
    CONTRACTS.FeeBootstrapReward,
    CONTRACTS.Guardian
];

interface ContractData {
    address: string;
    startBlock: number;
    endBlock: number | string;
    abi: any[];
}

interface ContractsData {
    [contractName: string]: ContractData[];
}

const getContractAbi = (contractName: string) => {
    switch (contractName) {
        case CONTRACTS.Delegate:
            return delegationAbi;
        case CONTRACTS.Reward:
            return rewardsAbi;
        case CONTRACTS.FeeBootstrapReward:
            return feeBootstrapRewardAbi;
        case CONTRACTS.Guardian:
            return guardianAbi;
        default:
            throw new Error(`Unsupported Polygon PoS contract ${contractName}`);
    }
};

const createPolygonContractsData = (): ContractsData => ({
    [CONTRACTS.Delegate]: [],
    [CONTRACTS.Reward]: [],
    [CONTRACTS.FeeBootstrapReward]: [],
    [CONTRACTS.Guardian]: [],
    [CONTRACTS.Erc20]: [
        {
            address: POLYGON_ERC20_ADDRESS,
            startBlock: POLYGON_ERC20_START_BLOCK,
            endBlock: 'latest',
            abi: erc20PolygonAbi
        }
    ],
    [CONTRACTS.Stake]: [
        {
            address: POLYGON_STAKE_ADDRESS,
            startBlock: POLYGON_STAKE_START_BLOCK,
            endBlock: 'latest',
            abi: stakeAbi
        }
    ],
    [CONTRACTS.Registry]: [
        {
            address: POLYGON_REGISTRY_ADDRESS,
            startBlock: POLYGON_REGISTRY_START_BLOCK,
            endBlock: 'latest',
            abi: registryAbi
        }
    ]
});

const normalizeAddress = (address: string) => String(address).toLowerCase();

const populateCurrentPolygonContracts = async (web3: any, contractsData: ContractsData) => {
    const registryContract = new web3.eth.Contract(registryAbi, POLYGON_REGISTRY_ADDRESS);

    await Promise.all(
        REGISTRY_CONTRACTS.map(async (contractName) => {
            const address = normalizeAddress(await registryContract.methods.getContract(contractName).call());

            if (address === ZERO_ADDRESS) {
                throw new Error(`Polygon registry returned an empty address for ${contractName}`);
            }

            contractsData[contractName].push({
                address,
                startBlock: POLYGON_REGISTRY_START_BLOCK,
                endBlock: 'latest',
                abi: getContractAbi(contractName)
            });
        })
    );
};

export const getWeb3PolygonFromRegistry = async (ethereumEndpoint: string) => {
    const web3 = await getWeb3Polygon(ethereumEndpoint, false);
    const contractsData = createPolygonContractsData();

    await populateCurrentPolygonContracts(web3, contractsData);
    Object.assign(web3, { contractsData });

    return web3;
};
