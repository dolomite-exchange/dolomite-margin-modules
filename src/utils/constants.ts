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

export const ARB_MAP: Record<Network, TokenWithMarketId> = {
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
  [Network.ArbitrumOne]: '0x75c0530885F385721fddA23C539AF3701d6183D4',
  [Network.ArbitrumGoerli]: '0x291093864bafc9aA517eF90ce954dD7D95D68C80',
};

export const DAI_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    marketId: 1,
  },
  [Network.ArbitrumGoerli]: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    marketId: 1,
  },
};

export const DFS_GLP_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x34DF4E8062A8C8Ae97E3382B452bd7BF60542698',
    marketId: 6,
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

export const DYT_GLP_2024_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0x851729Df6C39BDB6E92721f2ADf750023D967eE8',
    marketId: 16,
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

export const NATIVE_USDC_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    marketId: 17,
  },
  [Network.ArbitrumGoerli]: undefined,
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

export const JONES_JUSDC_RECEIPT_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xa485a0bc44988B95245D5F20497CCaFF58a73E99',
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
