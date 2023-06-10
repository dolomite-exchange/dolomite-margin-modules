import { BigNumberish } from 'ethers';
import { Network } from './no-deps-constants';

export interface AccountStruct {
  owner: string;
  number: BigNumberish;
}

// ************************* External Contract Addresses *************************

interface TokenWithMarketId {
  address: string;
  marketId: number;
}

export const DFS_GLP_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x34DF4E8062A8C8Ae97E3382B452bd7BF60542698',
    marketId: 6,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const MAGIC_GLP_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x85667409a723684Fe1e57Dd1ABDe8D88C2f54214',
    marketId: 8,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const USDC_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    marketId: 2,
  },
  [Network.ArbitrumGoerli]: {
    address: '0x7317eb743583250739862644cef74B982708eBB4',
    marketId: 2,
  },
};

export const WETH_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    marketId: 0,
  },
  [Network.ArbitrumGoerli]: {
    address: '0xC033378c6eEa969C001CE9438973ca4d6460999a',
    marketId: 0,
  },
};

// ************************* External Addresses *************************

export const ALWAYS_ZERO_INTEREST_SETTER_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x37b6fF70654EDfBdAA3c9a723fdAdF5844De2168',
  [Network.ArbitrumGoerli]: '0x2536ef4105a6173683C7fFCE9547091960F6d939',
};

export const ATLAS_SI_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: undefined,
  [Network.ArbitrumGoerli]: '0x10EB11cFf6Eb909528Dba768040a63Eb904261c2',
};

export const ES_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX_DISTRIBUTOR_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x60519b48ec4183a61ca2B8e37869E675FD203b34',
  [Network.ArbitrumGoerli]: undefined,
};

export const FS_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * The underlying token the for IsolationModeVaultFactory
 */
export const GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258',
  [Network.ArbitrumGoerli]: undefined,
};

export const GLP_MANAGER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x3963FfC9dff443c2A94f21b129D429891E32ec18',
  [Network.ArbitrumGoerli]: undefined,
};

export const GLP_REWARD_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xB95DB5B167D75e6d04227CfFFA61069348d271F5',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_REWARD_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_ECOSYSTEM_GOVERNOR_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xDD0556DDCFE7CdaB3540E7F09cB366f498d90774',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_GLP_ADAPTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x42EfE3E686808ccA051A49BCDE34C5CbA2EBEfc1',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_GLP_VAULT_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x2F43c6475f1ecBD051cE486A9f3Ccc4b03F3d713',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_JUSDC_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xe66998533a1992ecE9eA99cDf47686F4fc8458E0',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_WHITELIST_CONTROLLER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '',
  [Network.ArbitrumGoerli]: undefined,
};

export const PARASWAP_AUGUSTUS_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
  [Network.ArbitrumGoerli]: undefined,
};

export const PARASWAP_TRANSFER_PROXY_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x216B4B4Ba9F3e719726886d34a177484278Bfcae',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_GLP_2024_MARKET_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x7D49E5Adc0EAAD9C027857767638613253eF125f',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_GLP_2024_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x96015D0Fb97139567a9ba675951816a0Bb719E3c',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_ORACLE_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x428f2f93afAc3F96B0DE59854038c585e06165C8',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x0000000001E4ef00d069e71d6bA041b0A16F7eA0',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_SY_GLP_2024_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x2066a650AF4b6895f72E618587Aad5e8120B7790',
  [Network.ArbitrumGoerli]: undefined,
};

export const PLS_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x51318B7D00db7ACc4026C88c3952B66278B6A67F',
  [Network.ArbitrumGoerli]: undefined,
};

export const PLV_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x5326E71Ff593Ecc2CF7AcaE5Fe57582D6e74CFF1',
  [Network.ArbitrumGoerli]: undefined,
};

export const PLV_GLP_FARM_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x4E5Cf54FdE5E1237e80E87fcbA555d829e1307CE',
  [Network.ArbitrumGoerli]: undefined,
};

export const PLV_GLP_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xEAE85745232983CF117692a1CE2ECf3d19aDA683',
  [Network.ArbitrumGoerli]: undefined,
};

export const S_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Special token that enables transfers and wraps around fsGLP
 */
export const S_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x908C4D94D34924765f1eDc22A1DD098397c59dD4',
  [Network.ArbitrumGoerli]: undefined,
};

export const SBF_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xd2D1162512F927a7e282Ef43a362659E4F2a728F',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Token that holds fsGLP for vesting esGMX into GMX
 */
export const V_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA75287d2f8b217273E7FCD7E86eF07D33972042E',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Token that holds sGMX for vesting esGMX into GMX
 */
export const V_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x199070DDfd1CFb69173aa2F7e20906F26B363004',
  [Network.ArbitrumGoerli]: undefined,
};
