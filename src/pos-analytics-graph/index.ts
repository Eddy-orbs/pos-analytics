/**
 * pos-analytics-graph: same public interface as @orbs-network/pos-analytics-lib,
 * different data source - all event history is read from the orbs-pos-analytics
 * subgraphs instead of eth_getLogs chain scans; RPC (web3) is used only for light
 * current-state reads (balances, cooldowns, reward balances, guardian metadata).
 * Aggregation logic is copied verbatim from the lib and validated to produce
 * identical results.
 */

export { getDelegator } from './delegator';
export { getGuardian, getGuardians, getDelegators } from './guardian';
export { getAllDelegators, getOverview } from './overview';
export { getDelegatorStakingRewards, getGuardianStakingRewards } from './rewards';
export { getStartOfDelegationBlock, getStartOfPosBlock, getStartOfRewardsBlock, getWeb3, getWeb3Polygon, getRefBlocks } from './eth-helpers';
export { configurePosAnalyticsSubgraph, getSubgraphHeadBlock } from './subgraph-events';
export { configureStreamCache } from './stream-cache';

export * from './model';
