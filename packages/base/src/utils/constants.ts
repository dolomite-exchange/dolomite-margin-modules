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

export const ARB_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    marketId: 7,
  },
  [Network.ArbitrumGoerli]: {
    address: '0xF861378B543525ae0C47d33C90C954Dc774Ac1F9',
    marketId: 7,
  },
};

export const CHAINLINK_PRICE_ORACLE_OLD_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xeA3Fe12d8CC2E87f99e985EE271971C808006531',
  [Network.ArbitrumGoerli]: '0x1BEC3A1331d36e57Ef3b1A8ccf1946c8cfe3Fef0',
};

export const CHAINLINK_PRICE_ORACLE_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA07e80C08D8bae7fFA3e46534eaBdBb6Ca98da1D',
  [Network.ArbitrumGoerli]: undefined,
};

export const CHAINLINK_REGISTRY_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x37D9dC70bfcd8BC77Ec2858836B923c560E891D1',
  [Network.ArbitrumGoerli]: '0xaB9718E1DC7BD61Bd3440Fb771CC23DA0C0181a1',
};

export const DAI_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    marketId: 1,
  },
  [Network.ArbitrumGoerli]: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    marketId: 1,
  },
};

export const D_ARB_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x1d9E10B161aE54FEAbe1E3F71f658cac3468e3C3',
    marketId: 28,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DFS_GLP_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x34DF4E8062A8C8Ae97E3382B452bd7BF60542698',
    marketId: 6,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const D_GMX_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x790FF506ac24b03A21F3d0019227447AE2B55Ca5',
    marketId: 30,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DJ_USDC: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x2aDba3f917bb0Af2530F8F295aD2a6fF1111Fc05',
    marketId: 10,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPLV_GLP_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x5c80aC681B6b0E7EF6E0751211012601e6cFB043',
    marketId: 9,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPT_GLP_2024_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x7b07E78561a3C2C1Eade652A2a92Da150743F4D7',
    marketId: 11,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPT_R_ETH_JUN_2025_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xC9375EF7635fe556F613AB528C9a2ed946BD075d',
    marketId: 22,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPT_WST_ETH_JUN_2024_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x1bE165864C918527F2e3e131c2ADc4da9B8c619B',
    marketId: 23,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPT_WST_ETH_JUN_2025_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xfeF14a3A1Ec46D4eB18c784BC1E61297FC68bbc8',
    marketId: 24,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DPX_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55',
    marketId: 20,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const DYT_GLP_2024_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x851729Df6C39BDB6E92721f2ADf750023D967eE8',
    marketId: 16,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const GRAIL_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8',
    marketId: 18,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x10393c20975cF177a3513071bC110f7962CD67da',
    marketId: 999,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const LINK_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    marketId: 3,
  },
  [Network.ArbitrumGoerli]: {
    address: '0x2d3B3F17d6694d5AA643Cb89A82Ac9214a41536d',
    marketId: 3,
  },
};

export const MAGIC_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
    marketId: 19,
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

export const MIM_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A',
    marketId: 13,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const NATIVE_USDC_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    marketId: 17,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
    marketId: 21,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const PREMIA_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x51fC0f6660482Ea73330E414eFd7808811a57Fa2',
    marketId: 25,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const RDNT_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    marketId: 26,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const RETH_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8',
    marketId: 15,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const SIZE_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x939727d85d99d0ac339bf1b76dfe30ca27c19067',
    marketId: -1,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const SIZE_WETH_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x123d123c6f062f7f5a6e82c396b34f1929125bf3',
  [Network.ArbitrumGoerli]: undefined,
};

export const ST_ETH_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    marketId: -1, // does not exist; purely here for the Chainlink oracle pairing
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

export const USDT_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    marketId: 5,
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const WBTC_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    marketId: 4,
  },
  [Network.ArbitrumGoerli]: {
    address: '0x6fA07522F1dd8D8cb5b400c957418b4bD2C96F80',
    marketId: 4,
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

export const WST_ETH_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x5979D7b546E38E414F7E9822514be443A4800529',
    marketId: 14,
  },
  [Network.ArbitrumGoerli]: undefined,
};

// ************************* External Addresses *************************

export const ATLAS_SI_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: undefined,
  [Network.ArbitrumGoerli]: '0x10EB11cFf6Eb909528Dba768040a63Eb904261c2',
};

export const BN_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x35247165119B69A40edD5304969560D0ef486921',
  [Network.ArbitrumGoerli]: undefined,
};

export const DPX_WETH_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x59a327d948db1810324a04d69cbe9fe9884f8f28',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x60519b48ec4183a61ca2B8e37869E675FD203b34',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x23208B91A98c7C1CD9FE63085BFf68311494F193',
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

export const GMX_DEPOSIT_HANDLER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x9Dc4f12Eb2d8405b499FB5B8AF79a5f64aB8a457',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_DEPOSIT_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_DATASTORE_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_EXCHANGE_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_EXECUTOR_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xC539cB358a58aC67185BaAD4d5E3f7fCfc903700',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_ETH_USD_MARKET_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_GOV_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xe7E740Fa40CA16b15B621B49de8E9F0D69CF4858',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_REWARD_ROUTER_V2_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_REWARD_ROUTER_V3_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x159854e14A862Df9E39E1D128b8e5F70B4A3cE9B',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_READER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x38d91ED96283d62182Fc6d990C24097A918a4d9b',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    marketId: 999, // TODO: fix me
  },
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_WITHDRAWAL_HANDLER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x9E32088F3c1a5EB38D32d1Ec6ba0bCBF499DC9ac',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_WITHDRAWAL_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x0628d46b5d145f183adb6ef1f2c97ed1c4701c55',
  [Network.ArbitrumGoerli]: undefined,
};

export const GRAIL_USDC_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x8cc8093218bCaC8B1896A1EED4D925F6F6aB289F',
  [Network.ArbitrumGoerli]: undefined,
};

export const GRAIL_WETH_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x60451B6aC55E3C5F0f3aeE31519670EcC62DC28f',
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

export const JONES_JUSDC_FARM_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x0aEfaD19aA454bCc1B1Dd86e18A7d58D0a6FAC38',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_JUSDC_RECEIPT_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xa485a0bc44988B95245D5F20497CCaFF58a73E99',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_WETH_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x0e878029D18cD7F630823439cf389d1601d9dbD9',
  [Network.ArbitrumGoerli]: undefined,
};

export const JONES_WHITELIST_CONTROLLER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x2ACc798DA9487fdD7F4F653e04D8E8411cd73e88',
  [Network.ArbitrumGoerli]: undefined,
};

export const ODOS_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13',
  [Network.ArbitrumGoerli]: undefined,
};

export const PARASWAP_AUGUSTUS_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
  [Network.ArbitrumGoerli]: undefined,
};

export const PARASWAP_FEE_CLAIMER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA7465CCD97899edcf11C56D2d26B49125674e45F',
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

export const PENDLE_PT_RETH_MARKET_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x14FbC760eFaF36781cB0eb3Cb255aD976117B9Bd',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_RETH_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x685155D3BD593508Fe32Be39729810A591ED9c87',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_WST_ETH_2024_MARKET_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xFd8AeE8FCC10aac1897F8D5271d112810C79e022',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_WST_ETH_2024_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x9741CAc1a22Ff3615FA074fD0B439975a5E137e9',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_WST_ETH_2025_MARKET_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x08a152834de126d2ef83D612ff36e4523FD0017F',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_WST_ETH_2025_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x1255638EFeca62e12E344E0b6B22ea853eC6e2c7',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_PT_ORACLE_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x7e16e4253CE4a1C96422a9567B23b4b5Ebc207F1',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x0000000001E4ef00d069e71d6bA041b0A16F7eA0',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_SY_GLP_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x2066a650AF4b6895f72E618587Aad5e8120B7790',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_SY_RETH_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xc0Cf4b266bE5B3229C49590B59E67A09c15b22f4',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_SY_WST_ETH_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x80c12D5b6Cc494632Bf11b03F09436c8B61Cc5Df',
  [Network.ArbitrumGoerli]: undefined,
};

export const PENDLE_YT_GLP_2024_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x56051f8e46b67b4d286454995dBC6F5f3C433E34',
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

export const PREMIA_WETH_V3_POOL_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xc3e254E39c45c7886A12455cb8207c808486FAC3',
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

export const UMAMI_CONFIGURATOR_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x4e5645bee4eD80C6FEe04DCC15D14A3AC956748A',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_LINK_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xe0A21a475f8DA0ee7FA5af8C1809D8AC5257607d',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_STORAGE_VIEWER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x86e7D5D04888540CdB6429542eC3DeC1978e6ea4',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_UNI_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x37c0705A65948EA5e0Ae1aDd13552BCaD7711A23',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_USDC_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x727eD4eF04bB2a96Ec77e44C1a91dbB01B605e42',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_WBTC_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x6a89FaF99587a12E6bB0351F2fA9006c6Cd12257',
  [Network.ArbitrumGoerli]: undefined,
};

export const UMAMI_WETH_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xbb84D79159D6bBE1DE148Dc82640CaA677e06126',
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

// ************************* Chainlink *************************

export const STETH_USD_CHAINLINK_FEED_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x07c5b924399cc23c24a95c8743de4006a32b7f2a',
  [Network.ArbitrumGoerli]: undefined,
};

export const STETH_ETH_CHAINLINK_FEED_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xded2c52b75b24732e9107377b7ba93ec1ffa4baf',
  [Network.ArbitrumGoerli]: undefined,
};

export const WSTETH_STETH_CHAINLINK_FEED_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xb1552c5e96b312d0bf8b554186f846c40614a540',
  [Network.ArbitrumGoerli]: undefined,
};