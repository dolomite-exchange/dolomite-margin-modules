import CoreDeployments from '@dolomite-exchange/dolomite-margin/dist/migrations/deployed.json';
import { IChainlinkAggregator, IChainlinkAggregator__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { CoreProtocolType } from '../../test/utils/setup';
import { IERC20 } from '../types';
import { ADDRESS_ZERO, Network, NetworkType } from './no-deps-constants';

export interface AccountStruct {
  owner: string;
  number: BigNumberish;
}

interface TokenWithMarketId {
  address: string;
  marketId: number;
}

interface ChronicleScribe {
  scribeAddress: string;
  tokenPairAddress: string;
  invertPrice?: boolean;
}

type EverythingButBase = Network.ArbitrumOne | Network.Mantle | Network.PolygonZkEvm | Network.XLayer;
type ArbitrumAndBerachainAndMantle = Network.ArbitrumOne | Network.Berachain | Network.Mantle;

export const SUBGRAPH_URL_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-arbitrum/v0.1.3/gn',
  [Network.Base]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-base/v0.1.3/gn',
  [Network.Berachain]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-berachain/v0.1.3/gn',
  [Network.Mantle]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-mantle/v0.1.3/gn',
  [Network.PolygonZkEvm]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-polygon-zkevm/v0.1.3/gn',
  [Network.XLayer]: 'https://subgraphapi.dolomite.io/api/public/1301d2d1-7a9d-4be4-9e9a-061cb8611549/subgraphs/dolomite-x-layer/v0.1.3/gn',
};

// ************************* External Contract Addresses *************************

export const AAVE_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xba5DdD1f9d7F570dc94a51479a000E3BCE967196',
    marketId: -1,
  },
};

export const ARB_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
    marketId: 7,
  },
};

export const CHAINLINK_PRICE_ORACLE_V1_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: CoreDeployments.ChainlinkPriceOracleV1[Network.ArbitrumOne].address,
  [Network.Base]: CoreDeployments.ChainlinkPriceOracleV1[Network.Base].address,
  [Network.Berachain]: CoreDeployments.ChainlinkPriceOracleV1[Network.Berachain].address,
  [Network.Mantle]: CoreDeployments.ChainlinkPriceOracleV1[Network.Mantle].address,
  [Network.PolygonZkEvm]: CoreDeployments.ChainlinkPriceOracleV1[Network.PolygonZkEvm].address,
  [Network.XLayer]: CoreDeployments.ChainlinkPriceOracleV1[Network.XLayer].address,
};

export const CHAINLINK_AUTOMATION_REGISTRY_MAP: Record<Network.ArbitrumOne | Network.Base, string> = {
  [Network.ArbitrumOne]: '0x37D9dC70bfcd8BC77Ec2858836B923c560E891D1',
  [Network.Base]: '0xE226D5aCae908252CcA3F6CEFa577527650a9e1e',
};

export const DAI_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    marketId: 1,
  },
  [Network.Base]: {
    address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    marketId: 1,
  },
  [Network.Berachain]: undefined,
  [Network.Mantle]: undefined,
  [Network.PolygonZkEvm]: {
    address: '0xC5015b9d9161Dca7e18e32f6f25C4aD850731Fd4',
    marketId: 1,
  },
  [Network.XLayer]: undefined,
};

export const D_ARB_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x1d9E10B161aE54FEAbe1E3F71f658cac3468e3C3',
    marketId: 28,
  },
};

export const DFS_GLP_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x34DF4E8062A8C8Ae97E3382B452bd7BF60542698',
    marketId: 6,
  },
};

export const D_GMX_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x790FF506ac24b03A21F3d0019227447AE2B55Ca5',
    marketId: 30,
  },
};

export const D_GM_AAVE_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x24C9121C75c099b38D40020872B8A0d2C27c614D',
    marketId: 55,
  },
};

export const D_GM_ARB_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2c799166c9f0DbF9EFC5004cbCe4c5A37fA39329',
    marketId: 31,
  },
};

export const D_GM_BTC_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xB15bbBfCff6c411410c66642306d1FfA7eCEc4D8',
    marketId: 44,
  },
};

export const D_GM_BTC_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x1E8e8B7a2F827b3bc12B00eE402145061b7050eF',
    marketId: 32,
  },
};

export const D_GM_DOGE_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x1BEEd3b7D1237B7773b5C4c249933E3Ca5e027c1',
    marketId: 56,
  },
};

export const D_GM_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2D165A76dd3e552DF3860789331Ab73c5a3d7F92',
    marketId: 45,
  },
};

export const D_GM_ETH_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x505582242757f16D72F8C4462A616E388Ca1b074',
    marketId: 33,
  },
};

export const D_GM_GMX_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x5c99f6cf6069698D234D50Bf69EBd2f53e45ED1c',
    marketId: 57,
  },
};

export const D_GM_LINK_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x18cB14564FBb015BD3439220D177799355abC0E0',
    marketId: 34,
  },
};

export const D_GM_SOL_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x1EBB1c7023aDdbb2B6e30e6F4C8D4A4440Bfd412',
    marketId: 58,
  },
};

export const D_GM_UNI_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x20d51CB520C4622Dcc3d7E35003dBaB07d547E7E',
    marketId: 47,
  },
};

export const D_GM_WST_ETH_USD_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xc587646f67b38739006ED0200e2E0a26FDb01c9B',
    marketId: 59,
  },
};

export const DJ_USDC_V2: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x14c60cB8301E879dfb9eecbEbc013353b7e33012',
    marketId: 43,
  },
};

export const DJ_USDC_V1: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2aDba3f917bb0Af2530F8F295aD2a6fF1111Fc05',
    marketId: 10,
  },
};

export const DPLV_GLP_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x5c80aC681B6b0E7EF6E0751211012601e6cFB043',
    marketId: 9,
  },
};

export const DPT_EZ_ETH_JUN_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x12A3bb4FDBC5C932438e067338767eE4A9165f1b',
    marketId: 38,
  },
};

export const DPT_EZ_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x9Fb5a64Ce2F659a6039aa57d45975fC097b3F373',
    marketId: 51,
  },
};

export const DPT_GLP_MAR_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x7b07E78561a3C2C1Eade652A2a92Da150743F4D7',
    marketId: 11,
  },
};

export const DPT_R_ETH_JUN_2025_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xC9375EF7635fe556F613AB528C9a2ed946BD075d',
    marketId: 22,
  },
};

export const DPT_RS_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xCeC868060a724199c0fbf62e61449175690a55bD',
    marketId: 52,
  },
};

export const DPT_WE_ETH_APR_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xa2e14377fA6ce3556E2248559E85dc44260e362f',
    marketId: 36,
  },
};

export const DPT_WE_ETH_JUN_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x6Cc56e9cA71147D40b10a8cB8cBe911C1Faf4Cf8',
    marketId: 42,
  },
};

export const DPT_WE_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x4B82bd687042c4Ea68A2A45b8204dA74be0FB493',
    marketId: 50,
  },
};

export const DPT_WST_ETH_JUN_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x1bE165864C918527F2e3e131c2ADc4da9B8c619B',
    marketId: 23,
  },
};

export const DPT_WST_ETH_JUN_2025_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xfeF14a3A1Ec46D4eB18c784BC1E61297FC68bbc8',
    marketId: 24,
  },
};

export const DPX_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x6C2C06790b3E3E3c38e12Ee22F8183b37a13EE55',
    marketId: 20,
  },
};

export const DYT_GLP_2024_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x851729Df6C39BDB6E92721f2ADf750023D967eE8',
    marketId: 16,
  },
};

export const DOGE_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xC4da4c24fd591125c3F47b340b6f4f76111883d8',
    marketId: -1, // does not exist; purely here for the Chainlink oracle pairing
  },
};

export const E_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x35fA164735182de50811E8e2E824cFb9B6118ac2',
    marketId: -1, // does not exist; purely here for the Chainlink oracle pairing
  },
};

export const EZ_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2416092f143378750bb29b79eD961ab195CcEea5',
    marketId: 37,
  },
};

export const EZ_ETH_REVERSED_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: reverseAddress(EZ_ETH_MAP[Network.ArbitrumOne].address),
    marketId: -1,
  },
};

export const FBTC_MAP: Record<Network.Mantle, TokenWithMarketId> = {
  [Network.Mantle]: {
    address: '0xC96dE26018A54D51c097160568752c4E3BD6C364',
    marketId: 13,
  },
};

export const FRAX_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F',
    marketId: -1,
  },
};

export const GRAI_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487',
    marketId: 46,
  },
};

export const GRAIL_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x3d9907F9a368ad0a51Be60f7Da3b97cf940982D8',
    marketId: 18,
  },
};

export const HONEY_MAP: Record<Network.Berachain, TokenWithMarketId> = {
  [Network.Berachain]: {
    address: '0x0E4aaF1351de4c0264C5c7056Ef3777b41BD8e03',
    marketId: 3,
  },
};

export const JONES_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x10393c20975cF177a3513071bC110f7962CD67da',
    marketId: 999,
  },
};

export const LINK_MAP: Record<Network, TokenWithMarketId | undefined> = {
  [Network.ArbitrumOne]: {
    address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    marketId: 3,
  },
  [Network.Base]: {
    address: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
    marketId: 3,
  },
  [Network.Berachain]: undefined,
  [Network.Mantle]: undefined,
  [Network.PolygonZkEvm]: {
    address: '0x4B16e4752711A7ABEc32799C976F3CeFc0111f2B',
    marketId: 3,
  },
  [Network.XLayer]: undefined,
};

export const MAGIC_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342',
    marketId: 19,
  },
};

export const MAGIC_GLP_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x85667409a723684Fe1e57Dd1ABDe8D88C2f54214',
    marketId: 8,
  },
};

export const MANTLE_REWARD_STATION_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0xeD884f0460A634C69dbb7def54858465808AACEf',
};

export const MATIC_MAP: Record<Network.PolygonZkEvm, TokenWithMarketId> = {
  [Network.PolygonZkEvm]: {
    address: '0xa2036f0538221a77A3937F1379699f44945018d0',
    marketId: 6,
  },
};

export const MIM_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFEa7a6a0B346362BF88A9e4A88416B77a57D6c2A',
    marketId: 13,
  },
};

export const METH_MAP: Record<Network.Mantle, TokenWithMarketId> = {
  [Network.Mantle]: {
    address: '0xcDA86A272531e8640cD7F1a92c01839911B90bb0',
    marketId: 5,
  },
};

export const NATIVE_USDC_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    marketId: 17,
  },
};

export const PENDLE_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
    marketId: 21,
  },
};

export const POL_MAP: Record<Network.PolygonZkEvm, TokenWithMarketId> = {
  [Network.PolygonZkEvm]: {
    address: '0x22B21BedDef74FE62F031D2c5c8F7a9F8a4b304D',
    marketId: 8,
  },
};

export const PREMIA_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x51fC0f6660482Ea73330E414eFd7808811a57Fa2',
    marketId: 25,
  },
};

export const RDNT_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x3082CC23568eA640225c2467653dB90e9250AaA0',
    marketId: 26,
  },
};

export const R_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xEC70Dcb4A1EFa46b8F2D97C310C9c4790ba5ffA8',
    marketId: 15,
  },
};

export const RS_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x4186BFC76E2E237523CBC30FD220FE055156b41F',
    marketId: 49,
  },
};

export const RS_ETH_REVERSED_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: reverseAddress(RS_ETH_MAP[Network.ArbitrumOne].address),
    marketId: -1,
  },
};

export const RS_ETH_CAMELOT_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xb355cce5cbaf411bd56e3b092f5aa10a894083ae',
};

export const SBTC_MAP: Record<Network.Berachain, TokenWithMarketId> = {
  [Network.Berachain]: {
    address: '',
    marketId: -1,
  },
};

export const SIZE_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x939727d85d99d0ac339bf1b76dfe30ca27c19067',
    marketId: -1,
  },
};

export const SIZE_WETH_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x123d123c6f062f7f5a6e82c396b34f1929125bf3',
};

export const SOL_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07',
    marketId: -1,
  },
};

export const SOLV_BTC_MAP: Record<Network.Berachain, TokenWithMarketId> = {
  [Network.Berachain]: {
    address: '',
    marketId: -1,
  },
};

export const ST_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    marketId: -1, // does not exist; purely here for the Chainlink oracle pairing
  },
};

export const UNI_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
    marketId: 12,
  },
};

export const UNI_BTC_MAP: Record<Network.Berachain, TokenWithMarketId> = {
  [Network.Berachain]: {
    address: '0x16221CaD160b441db008eF6DA2d3d89a32A05859',
    marketId: 4,
  },
};

export const USDC_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    marketId: 2,
  },
  [Network.Base]: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    marketId: 2,
  },
  [Network.Berachain]: {
    address: '0xd6D83aF58a19Cd14eF3CF6fe848C9A4d21e5727c',
    marketId: 2,
  },
  [Network.Mantle]: {
    address: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
    marketId: 2,
  },
  [Network.PolygonZkEvm]: {
    address: '0x37eAA0eF3549a5Bb7D431be78a3D99BD360d19e5',
    marketId: 7,
  },
  [Network.XLayer]: {
    address: '0x74b7F16337b8972027F6196A17a631aC6dE26d22',
    marketId: 2,
  },
};

export const USDE_MAP: Record<Network.ArbitrumOne | Network.Mantle, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
    marketId: 54,
  },
  [Network.Mantle]: {
    address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
    marketId: 6,
  },
};

export const USDM_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
    marketId: -1,
  },
};

export const USDT_MAP: Record<EverythingButBase, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    marketId: 5,
  },
  [Network.Mantle]: {
    address: '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE',
    marketId: 4,
  },
  [Network.PolygonZkEvm]: {
    address: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
    marketId: 5,
  },
  [Network.XLayer]: {
    address: '0x1E4a5963aBFD975d8c9021ce480b42188849D41d',
    marketId: 4,
  },
};

export const USDY_MAP: Record<Network.Mantle, TokenWithMarketId> = {
  [Network.Mantle]: {
    address: '0x5bE26527e817998A7206475496fDE1E68957c5A6',
    marketId: 8,
  },
};

export const W_USDM_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x57F5E098CaD7A3D1Eed53991D4d66C45C9AF7812',
    marketId: 48,
  },
};

export const WBTC_MAP: Record<EverythingButBase, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    marketId: 4,
  },
  [Network.Mantle]: {
    address: '0xCAbAE6f6Ea1ecaB08Ad02fE02ce9A44F09aebfA2',
    marketId: 3,
  },
  [Network.PolygonZkEvm]: {
    address: '0xEA034fb02eB1808C2cc3adbC15f447B93CbE08e1',
    marketId: 4,
  },
  [Network.XLayer]: {
    address: '0xEA034fb02eB1808C2cc3adbC15f447B93CbE08e1',
    marketId: 3,
  },
};

export const WBERA_MAP: Record<Network.Berachain, TokenWithMarketId> = {
  [Network.Berachain]: {
    address: '0x7507c1dc16935B82698e4C63f2746A2fCf994dF8',
    marketId: 1,
  },
};

export const WETH_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    marketId: 0,
  },
  [Network.Base]: {
    address: '0x4200000000000000000000000000000000000006',
    marketId: 0,
  },
  [Network.Berachain]: {
    address: '0x6E1E9896e93F7A71ECB33d4386b49DeeD67a231A',
    marketId: 0,
  },
  [Network.Mantle]: {
    address: '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111',
    marketId: 0,
  },
  [Network.PolygonZkEvm]: {
    address: '0x4F9A0e7FD2Bf6067db6994CF12E4495Df938E6e9',
    marketId: 0,
  },
  [Network.XLayer]: {
    address: '0x5A77f1443D16ee5761d310e38b62f77f726bC71c',
    marketId: 0,
  },
};

export const WE_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
    marketId: 35,
  },
};

export const WO_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xD8724322f44E5c58D7A815F542036fb17DbbF839',
    marketId: 53,
  },
};

export const WMNT_MAP: Record<Network.Mantle, TokenWithMarketId> = {
  [Network.Mantle]: {
    address: '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8',
    marketId: 1,
  },
};

export const WOKB_MAP: Record<Network.XLayer, TokenWithMarketId> = {
  [Network.XLayer]: {
    address: '0xe538905cf8410324e03A5A23C1c177a474D59b2b',
    marketId: 1,
  },
};

export const WST_ETH_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x5979D7b546E38E414F7E9822514be443A4800529',
    marketId: 14,
  },
};

export const XAI_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x4Cb9a7AE498CEDcBb5EAe9f25736aE7d428C9D66',
    marketId: 39,
  },
};

// ************************* External Addresses *************************

export const BN_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x35247165119B69A40edD5304969560D0ef486921',
};

export const DPX_WETH_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x59a327d948db1810324a04d69cbe9fe9884f8f28',
};

export const ES_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA',
};

export const ES_GMX_DISTRIBUTOR_FOR_STAKED_GLP_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x60519b48ec4183a61ca2B8e37869E675FD203b34',
};

export const ES_GMX_DISTRIBUTOR_FOR_STAKED_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x23208B91A98c7C1CD9FE63085BFf68311494F193',
};

export const FS_GLP_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
};

/**
 * The underlying token the for IsolationModeVaultFactory
 */
export const GLP_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258',
};

export const GLP_MANAGER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x3963FfC9dff443c2A94f21b129D429891E32ec18',
};

export const GLP_REWARD_ROUTER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xB95DB5B167D75e6d04227CfFFA61069348d271F5',
};

export const GMX_BTC_PLACEHOLDER_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x47904963fc8b2340414262125aF798B9655E58Cd',
    marketId: -1,
  },
};

export const GMX_DEPOSIT_HANDLER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x321f3739983CC3E911fd67a83d1ee76238894Bd0',
};

export const GMX_DEPOSIT_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xF89e77e8Dc11691C9e8757e84aaFbCD8A67d7A55',
};

export const GMX_DATASTORE_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xFD70de6b91282D8017aA4E741e9Ae325CAb992d8',
};

export const GMX_EXCHANGE_ROUTER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x69C527fC77291722b52649E45c838e41be8Bf5d5',
};

export const GMX_EXECUTOR_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xC539cB358a58aC67185BaAD4d5E3f7fCfc903700',
};

export const GMX_AAVE_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x1CbBa6346F110c8A5ea739ef2d1eb182990e4EB2',
};

export const GMX_ARB_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xC25cEf6061Cf5dE5eb761b50E4743c1F5D7E5407',
};

export const GMX_BTC_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x47c031236e19d024b42f8AE6780E44A573170703',
};

export const GMX_BTC_SINGLE_SIDED_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x7C11F78Ce78768518D743E81Fdfa2F860C6b9A77',
};

export const GMX_DOGE_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x6853EA96FF216fAb11D2d930CE3C508556A4bdc4',
};

export const GMX_ETH_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x70d95587d40A2caf56bd97485aB3Eec10Bee6336',
};

export const GMX_ETH_SINGLE_SIDED_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x450bb6774Dd8a756274E0ab4107953259d2ac541',
};

export const GMX_GMX_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x55391D178Ce46e7AC8eaAEa50A72D1A5a8A622Da',
};

export const GMX_LINK_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x7f1fa204bb700853D36994DA19F830b6Ad18455C',
};

export const GMX_SOL_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x09400D9DB990D5ed3f35D7be61DfAEB900Af03C9',
};

export const GMX_UNI_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xc7Abb2C5f3BF3CEB389dF0Eecd6120D451170B50',
};

export const GMX_WST_ETH_USD_MARKET_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x0Cf1fb4d1FF67A3D8Ca92c9d6643F8F9be8e03E5',
};

export const GMX_GOV_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xe7E740Fa40CA16b15B621B49de8E9F0D69CF4858',
};

export const GMX_REWARD_ROUTER_V2_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1',
};

export const GMX_REWARD_ROUTER_V3_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x159854e14A862Df9E39E1D128b8e5F70B4A3cE9B',
};

export const GMX_REWARD_ROUTER_V4_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x5E4766F932ce00aA4a1A82d3Da85adf15C5694A1',
};

export const GMX_READER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x5Ca84c34a381434786738735265b9f3FD814b824',
};

export const GMX_ROUTER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x7452c558d45f8afC8c83dAe62C3f8A5BE19c71f6',
};

export const GMX_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
    marketId: 29,
  },
};

export const GMX_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
};

export const GMX_WITHDRAWAL_HANDLER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xA19fA3F0D8E7b7A8963420De504b624167e709B2',
};

export const GMX_WITHDRAWAL_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x0628D46b5D145f183AdB6Ef1f2c97eD1C4701C55',
};

export const GRAIL_USDC_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x8cc8093218bCaC8B1896A1EED4D925F6F6aB289F',
};

export const GRAIL_WETH_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x60451B6aC55E3C5F0f3aeE31519670EcC62DC28f',
};

export const KYBER_AGGREGATOR_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
  [Network.Base]: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
  [Network.Berachain]: undefined,
  [Network.Mantle]: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
  [Network.PolygonZkEvm]: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
  [Network.XLayer]: undefined,
};

export const JONES_ECOSYSTEM_GOVERNOR_V1_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xDD0556DDCFE7CdaB3540E7F09cB366f498d90774',
};

export const JONES_ECOSYSTEM_GOVERNOR_V2_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xc8ce0aC725f914dBf1D743D51B6e222b79F479f1',
};

export const JONES_USDC_ROUTER_ROUTER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x9c895CcDd1da452eb390803d48155e38f9fC2e4d',
};

export const JONES_JUSDC_V2_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xB0BDE111812EAC913b392D80D51966eC977bE3A2',
};

export const JONES_JUSDC_OLD_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xe66998533a1992ecE9eA99cDf47686F4fc8458E0',
};

export const JONES_JUSDC_FARM_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x0aEfaD19aA454bCc1B1Dd86e18A7d58D0a6FAC38',
};

export const JONES_JUSDC_RECEIPT_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xa485a0bc44988B95245D5F20497CCaFF58a73E99',
};

export const JONES_ROUTER_V2_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x9c895CcDd1da452eb390803d48155e38f9fC2e4d',
};

export const JONES_WETH_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x0e878029D18cD7F630823439cf389d1601d9dbD9',
};

export const JONES_WHITELIST_CONTROLLER_V1_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x2ACc798DA9487fdD7F4F653e04D8E8411cd73e88',
};

export const JONES_WHITELIST_CONTROLLER_V2_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xDe3476a7C0a408325385605203665A8836c2bcca',
};

export const ODOS_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e13',
  [Network.Base]: '0x19cEeAd7105607Cd444F5ad10dd51356436095a1',
  [Network.Berachain]: undefined,
  [Network.Mantle]: '0xD9F4e85489aDCD0bAF0Cd63b4231c6af58c26745',
  [Network.PolygonZkEvm]: undefined,
  [Network.XLayer]: undefined,
};

export const OKX_DEX_ROUTER_MAP: Record<Network.XLayer, string> = {
  [Network.XLayer]: '0x127a986cE31AA2ea8E1a6a0F0D5b7E5dbaD7b0bE',
};

export const OKX_DEX_TRANSFER_PROXY_MAP: Record<Network.XLayer, string> = {
  [Network.XLayer]: '0x8b773D83bc66Be128c60e07E17C8901f7a64F000',
};

export const OOGA_BOOGA_ROUTER_MAP: Record<Network.Berachain, string> = {
  [Network.Berachain]: '0x7bC98B68bCBb16cEC81EdDcEa1A3746Fdc5025A4',
};

export const OOGA_BOOGA_EXECUTOR_MAP: Record<Network.Berachain, string> = {
  [Network.Berachain]: '0xDa547d8ce09e23E9e8053dd187B58841B5fB8D5d',
};

export const PARASWAP_AUGUSTUS_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
  [Network.Base]: '0x59C7C832e96D2568bea6db468C1aAdcbbDa08A52',
  [Network.Berachain]: undefined,
  [Network.Mantle]: undefined,
  [Network.PolygonZkEvm]: '0xB83B554730d29cE4Cb55BB42206c3E2c03E4A40A',
  [Network.XLayer]: undefined,
};

export const PARASWAP_FEE_CLAIMER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA7465CCD97899edcf11C56D2d26B49125674e45F',
  [Network.Base]: '0x9aaB4B24541af30fD72784ED98D8756ac0eFb3C7',
  [Network.Berachain]: undefined,
  [Network.Mantle]: undefined,
  [Network.PolygonZkEvm]: '0x593F39A4Ba26A9c8ed2128ac95D109E8e403C485',
  [Network.XLayer]: undefined,
};

export const PARASWAP_TRANSFER_PROXY_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x216B4B4Ba9F3e719726886d34a177484278Bfcae',
  [Network.Base]: '0x93aAAe79a53759cD164340E4C8766E4Db5331cD7',
  [Network.Berachain]: undefined,
  [Network.Mantle]: undefined,
  [Network.PolygonZkEvm]: '0xC8a21FcD5A100c3ecc037c97e2f9C53a8D3A02A1',
  [Network.XLayer]: undefined,
};

export const PENDLE_MARKET_EZ_ETH_JUN_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x5E03C94Fc5Fb2E21882000A96Df0b63d2c4312e2',
};

export const PENDLE_MARKET_GLP_MAR_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x7D49E5Adc0EAAD9C027857767638613253eF125f',
};

export const PENDLE_MARKET_GLP_SEP_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x551c423c441db0b691b5630f04d2080caee25963',
};

export const PENDLE_MARKET_E_ETH_APR_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xE11f9786B06438456b044B3E21712228ADcAA0D1',
};

export const PENDLE_MARKET_E_ETH_JUN_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x952083cde7aaa11ab8449057f7de23a970aa8472',
};

export const PENDLE_MARKET_E_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xf9F9779d8fF604732EBA9AD345E6A27EF5c2a9d6',
};

export const PENDLE_MARKET_E_ETH_DEC_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x6b92feB89ED16AA971B096e247Fe234dB4Aaa262',
};

export const PENDLE_MARKET_EZ_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x35f3dB08a6e9cB4391348b0B404F493E7ae264c0',
};

export const PENDLE_MARKET_METH_DEC_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x99E83709846b6cB82d47a0D78b175E68497EA28B',
};

export const PENDLE_MARKET_MNT_OCT_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x4604FC1C52cBfc38C4E6DFd2CD2a9bF5b84f65Cb',
};

export const PENDLE_MARKET_RETH_JUN_2025_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x14FbC760eFaF36781cB0eb3Cb255aD976117B9Bd',
};

export const PENDLE_MARKET_RS_ETH_APR_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x6F02C88650837C8dfe89F66723c4743E9cF833cd',
};

export const PENDLE_MARKET_RS_ETH_SEP_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xED99fC8bdB8E9e7B8240f62f69609a125A0Fbf14',
};

export const PENDLE_MARKET_RS_ETH_DEC_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xcB471665BF23B2Ac6196D84D947490fd5571215f',
};

export const PENDLE_MARKET_USDE_DEC_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x2ddD4808fBB2e08b563af99B8F340433c32C8cc2',
};

export const PENDLE_MARKET_USDE_JUL_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x7dc07C575A0c512422dCab82CE9Ed74dB58Be30C',
};

export const PENDLE_MARKET_WST_ETH_2024_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xFd8AeE8FCC10aac1897F8D5271d112810C79e022',
};

export const PENDLE_MARKET_WST_ETH_2025_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x08a152834de126d2ef83D612ff36e4523FD0017F',
};

export const PENDLE_PT_E_ETH_APR_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x9bEcd6b4Fb076348A455518aea23d3799361FE95',
};

export const PENDLE_PT_E_ETH_JUN_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x1c27Ad8a19Ba026ADaBD615F6Bc77158130cfBE4',
};

export const PENDLE_YT_E_ETH_JUN_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xDcdC1004d5C271ADc048982d7EB900cC4F472333',
};

export const PENDLE_PT_E_ETH_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xb8b0a120F6A68Dd06209619F62429fB1a8e92feC',
};

export const PENDLE_PT_E_ETH_DEC_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xE2B2D203577c7cb3D043E89cCf90b5E24d19b66f',
};

export const PENDLE_PT_EZ_ETH_JUN_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x8EA5040d423410f1fdc363379Af88e1DB5eA1C34',
};

export const PENDLE_PT_EZ_ETH_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x2CCFce9bE49465CC6f947b5F6aC9383673733Da9',
};

export const PENDLE_PT_GLP_MAR_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x96015D0Fb97139567a9ba675951816a0Bb719E3c',
};

export const PENDLE_PT_GLP_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x89cD713a6607787F93d6743E67777Be9Ad73c54b',
};

export const PENDLE_PT_METH_DEC_2024_TOKEN_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x1333B49BBdD06544a25647f9127358D9A9486105',
};

export const PENDLE_PT_MNT_OCT_2024_TOKEN_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0xC57c7Be308cf2f52dcF095d8D4C67d5984270da0',
};

export const PENDLE_PT_RETH_JUN_2025_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x685155D3BD593508Fe32Be39729810A591ED9c87',
};

export const PENDLE_PT_RS_ETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x8D164E0C662C9E199baaC9E97b6A8664c75700EA',
};

export const PENDLE_PT_RS_ETH_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x30c98c0139B62290E26aC2a2158AC341Dcaf1333',
};

export const PENDLE_PT_RS_ETH_DEC_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x355ec27c9d4530dE01A103FA27F884a2F3dA65ef',
};

export const PENDLE_PT_USDE_DEC_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x8be66A48EA1f4AFF89cd2beb50B02D901Dfb9584',
};

export const PENDLE_PT_USDE_JUL_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0xba567Cf0d8230c0AD8D8bFc50E587E06d6F118E9',
};

export const PENDLE_PT_WST_ETH_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x9741CAc1a22Ff3615FA074fD0B439975a5E137e9',
};

export const PENDLE_PT_WST_ETH_2025_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x1255638EFeca62e12E344E0b6B22ea853eC6e2c7',
};

export const PENDLE_PT_ORACLE_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x9a9Fa8338dd5E5B2188006f1Cd2Ef26d921650C2',
  [Network.Base]: ADDRESS_ZERO,
  [Network.Berachain]: ADDRESS_ZERO,
  [Network.Mantle]: '0x9a9Fa8338dd5E5B2188006f1Cd2Ef26d921650C2',
  [Network.PolygonZkEvm]: ADDRESS_ZERO,
  [Network.XLayer]: ADDRESS_ZERO,
};

export const PENDLE_ROUTER_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x0000000001E4ef00d069e71d6bA041b0A16F7eA0',
  [Network.Base]: ADDRESS_ZERO,
  [Network.Berachain]: ADDRESS_ZERO,
  [Network.Mantle]: '0x888888888889758F76e7103c6CbF23ABbF58F946',
  [Network.PolygonZkEvm]: ADDRESS_ZERO,
  [Network.XLayer]: ADDRESS_ZERO,
};

export const PENDLE_ROUTER_V3_MAP: Record<Network, string> = {
  [Network.ArbitrumOne]: '0x00000000005BBB0EF59571E58418F9a4357b68A0',
  [Network.Base]: ADDRESS_ZERO,
  [Network.Berachain]: ADDRESS_ZERO,
  [Network.Mantle]: '0x888888888889758F76e7103c6CbF23ABbF58F946',
  [Network.PolygonZkEvm]: ADDRESS_ZERO,
  [Network.XLayer]: ADDRESS_ZERO,
};

export const PENDLE_SY_EZ_ETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x0dE802e3D6Cc9145A150bBDc8da9F988a98c5202',
};

export const PENDLE_SY_GLP_MAR_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x2066a650AF4b6895f72E618587Aad5e8120B7790',
};

export const PENDLE_SY_GLP_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xd1F7d5fec6EB532847e552269c905Ac489992Ef6',
};

export const PENDLE_SY_METH_DEC_2024_TOKEN_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x9Ab557331dDada945eB2eCE19b90Bd7a843F8665',
};

export const PENDLE_SY_MNT_OCT_2024_TOKEN_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0xdDceEc69d4A705970A5C60C8e6406ec81F2370bC',
};

export const PENDLE_SY_RETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xc0Cf4b266bE5B3229C49590B59E67A09c15b22f4',
};

export const PENDLE_SY_RS_ETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xf176fB51F4eB826136a54FDc71C50fCd2202E272',
};

export const PENDLE_SY_USDE_DEC_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x9660AC0cB085F8Fb39a6F383cF2067785364f924',
};

export const PENDLE_SY_USDE_JUL_2024_MAP: Record<Network.Mantle, string> = {
  [Network.Mantle]: '0x5B9e411c9E50164133DE07FE1cAC05A094000105',
};

export const PENDLE_SY_WE_ETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xa6C895EB332E91c5b3D00B7baeEAae478cc502DA',
};

export const PENDLE_SY_WST_ETH_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x80c12D5b6Cc494632Bf11b03F09436c8B61Cc5Df',
};

export const PENDLE_YT_GLP_MAR_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x56051f8e46b67b4d286454995dBC6F5f3C433E34',
};

export const PENDLE_YT_GLP_SEP_2024_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xf875f32648be14d04e0df4a977afd4290dd92713',
};

export const PLS_TOKEN_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x51318B7D00db7ACc4026C88c3952B66278B6A67F',
};

export const PLV_GLP_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x5326E71Ff593Ecc2CF7AcaE5Fe57582D6e74CFF1',
};

export const PLV_GLP_FARM_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x4E5Cf54FdE5E1237e80E87fcbA555d829e1307CE',
};

export const PLV_GLP_ROUTER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xEAE85745232983CF117692a1CE2ECf3d19aDA683',
};

export const PREMIA_WETH_V3_POOL_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xc3e254E39c45c7886A12455cb8207c808486FAC3',
};

export const S_GLP_MAP: Record<Network.ArbitrumOne, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf',
    marketId: 40,
  },
};

/**
 * Special token that enables transfers and wraps around fsGLP
 */
export const S_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x908C4D94D34924765f1eDc22A1DD098397c59dD4',
};

export const SBF_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xd2D1162512F927a7e282Ef43a362659E4F2a728F',
};

export const SLIPPAGE_TOLERANCE_FOR_PAUSE_SENTINEL = BigNumber.from('70000000000000000');

export const UMAMI_CONFIGURATOR_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x4e5645bee4eD80C6FEe04DCC15D14A3AC956748A',
};

export const UMAMI_LINK_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xe0A21a475f8DA0ee7FA5af8C1809D8AC5257607d',
};

export const UMAMI_STORAGE_VIEWER_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x86e7D5D04888540CdB6429542eC3DeC1978e6ea4',
};

export const UMAMI_UNI_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x37c0705A65948EA5e0Ae1aDd13552BCaD7711A23',
};

export const UMAMI_USDC_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x727eD4eF04bB2a96Ec77e44C1a91dbB01B605e42',
};

export const UMAMI_WBTC_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x6a89FaF99587a12E6bB0351F2fA9006c6Cd12257',
};

export const UMAMI_WETH_VAULT_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xbb84D79159D6bBE1DE148Dc82640CaA677e06126',
};

/**
 * Token that holds fsGLP for vesting esGMX into GMX
 */
export const V_GLP_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0xA75287d2f8b217273E7FCD7E86eF07D33972042E',
};

/**
 * Token that holds sGMX for vesting esGMX into GMX
 */
export const V_GMX_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x199070DDfd1CFb69173aa2F7e20906F26B363004',
};

// ************************* Oracles *************************

export const BTC_CHAINLINK_FEED_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x6ce185860a4963106506C203335A2910413708e9',
};

export const STETH_USD_CHAINLINK_FEED_MAP: Record<Network.ArbitrumOne, string> = {
  [Network.ArbitrumOne]: '0x07c5b924399cc23c24a95c8743de4006a32b7f2a',
};

export interface AggregatorInfo {
  aggregatorAddress: string;
  tokenPairAddress?: string;
  invert?: boolean;
}

export const INVALID_TOKEN_MAP: Record<Network, Record<string, { symbol: string; decimals: number }>> = {
  [Network.ArbitrumOne]: {
    [DOGE_MAP[Network.ArbitrumOne].address]: {
      symbol: 'DOGE',
      decimals: 8,
    },
    [E_ETH_MAP[Network.ArbitrumOne].address]: {
      symbol: 'eETH',
      decimals: 18,
    },
    [EZ_ETH_REVERSED_MAP[Network.ArbitrumOne].address]: {
      symbol: 'ezETH',
      decimals: 18,
    },
    [GMX_BTC_PLACEHOLDER_MAP[Network.ArbitrumOne].address]: {
      symbol: 'btc',
      decimals: 8,
    },
    [RS_ETH_REVERSED_MAP[Network.ArbitrumOne].address]: {
      symbol: 'rsETH',
      decimals: 18,
    },
    [ST_ETH_MAP[Network.ArbitrumOne].address]: {
      symbol: 'stETH',
      decimals: 18,
    },
  },
  [Network.Base]: {},
  [Network.Berachain]: {},
  [Network.Mantle]: {},
  [Network.PolygonZkEvm]: {},
  [Network.XLayer]: {},
};

export const CHAINLINK_PRICE_AGGREGATORS_MAP: Record<Network, Record<string, AggregatorInfo | undefined>> = {
  [Network.ArbitrumOne]: {
    [AAVE_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xaD1d5344AaDE45F43E596773Bcc4c423EAbdD034',
    },
    [ARB_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
    },
    [DOGE_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x9A7FB1b3950837a8D9b40517626E11D4127C098C',
    },
    [GMX_BTC_PLACEHOLDER_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: BTC_CHAINLINK_FEED_MAP[Network.ArbitrumOne],
    },
    [D_ARB_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6',
    },
    [D_GMX_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xdb98056fecfff59d032ab628337a4887110df3db',
    },
    [DAI_MAP[Network.ArbitrumOne]!.address]: {
      aggregatorAddress: '0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB',
    },
    [E_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12',
      tokenPairAddress: WE_ETH_MAP[Network.ArbitrumOne].address,
      invert: true,
    },
    [EZ_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x989a480b6054389075CBCdC385C18CfB6FC08186',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [EZ_ETH_REVERSED_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x989a480b6054389075CBCdC385C18CfB6FC08186',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
      invert: true,
    },
    [FRAX_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x0809E3d38d1B4214958faf06D8b1B1a2b73f2ab8',
    },
    [GMX_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xdb98056fecfff59d032ab628337a4887110df3db',
    },
    [GMX_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xdb98056fecfff59d032ab628337a4887110df3db',
    },
    [LINK_MAP[Network.ArbitrumOne]!.address]: {
      aggregatorAddress: '0x86E53CF1B870786351Da77A57575e79CB55812CB',
    },
    [MAGIC_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x47e55ccec6582838e173f252d08afd8116c2202d',
    },
    [MIM_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x87121F6c9A9F6E90E59591E4Cf4804873f54A95b',
    },
    [NATIVE_USDC_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
    },
    [PENDLE_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x66853e19d73c0f9301fe099c324a1e9726953433',
    },
    [RDNT_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x20d0fcab0ecfd078b036b6caf1fac69a6453b352',
    },
    [R_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xF3272CAfe65b190e76caAF483db13424a3e23dD2',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [RS_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xb0EA543f9F8d4B818550365d13F66Da747e1476A',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [RS_ETH_REVERSED_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xb0EA543f9F8d4B818550365d13F66Da747e1476A',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
      invert: true,
    },
    [SOL_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x24ceA4b8ce57cdA5058b924B9B9987992450590c',
    },
    [ST_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xded2c52b75b24732e9107377b7ba93ec1ffa4baf',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [UNI_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x9C917083fDb403ab5ADbEC26Ee294f6EcAda2720',
    },
    [USDC_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
    },
    [USDE_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x88AC7Bca36567525A866138F03a6F6844868E0Bc',
    },
    [USDT_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7',
    },
    [WBTC_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xd0C7101eACbB49F3deCcCc166d238410D6D46d57',
    },
    [WETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    },
    [WE_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x20bAe7e1De9c596f5F7615aeaa1342Ba99294e12',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
      invert: true,
    },
    [WO_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x03a1f4b19aaeA6e68f0f104dc4346dA3E942cC45',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [WST_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xb1552c5e96b312d0bf8b554186f846c40614a540',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
    [XAI_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0x806c532D543352e7C344ba6C7F3F00Bfbd309Af1',
    },
  },
  [Network.Base]: {
    [WETH_MAP[Network.Base].address]: {
      aggregatorAddress: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    },
    [DAI_MAP[Network.Base]!.address]: {
      aggregatorAddress: '0x591e79239a7d679378eC8c847e5038150364C78F',
    },
    [USDC_MAP[Network.Base].address]: {
      aggregatorAddress: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
    },
    [LINK_MAP[Network.Base]!.address]: {
      aggregatorAddress: '0xc5E65227fe3385B88468F9A01600017cDC9F3A12',
    },
  },
  [Network.Berachain]: {},
  [Network.Mantle]: {},
  [Network.PolygonZkEvm]: {
    [DAI_MAP[Network.PolygonZkEvm]!.address]: {
      aggregatorAddress: '0xa4Fd5C39d975067c877F287E78D600da07E8344c',
    },
    [LINK_MAP[Network.PolygonZkEvm]!.address]: {
      aggregatorAddress: '0x2eeCADd4D8d3a4939440f07419741C4898095317',
    },
    [MATIC_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0x7C85dD6eBc1d318E909F22d51e756Cf066643341',
    },
    [POL_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0x44285b60Cc13557935CA4945d20475BD1f1058f4',
    },
    [USDC_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0x0167D934CB7240e65c35e347F00Ca5b12567523a',
    },
    [USDT_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0x8499f6E7D6Ac56C83f66206035D33bD1908a8b5D',
    },
    [WBTC_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0xAE243804e1903BdbE26ae5f35bc6E4794Be21574',
    },
    [WETH_MAP[Network.PolygonZkEvm].address]: {
      aggregatorAddress: '0x97d9F9A00dEE0004BE8ca0A8fa374d486567eE2D',
    },
  },
  [Network.XLayer]: {
    [WETH_MAP[Network.XLayer].address]: {
      aggregatorAddress: '0x98ff91433c992153A8D6507cEA5b791Df69d7c99',
    },
    [WOKB_MAP[Network.XLayer].address]: {
      aggregatorAddress: '0x90AB4bc4991c71889A67F25eec044fD90E255e77',
    },
    [USDC_MAP[Network.XLayer].address]: {
      aggregatorAddress: '0xc975719d0ec39bb8880444acea9cc8d29a35e4d4',
    },
    [WBTC_MAP[Network.XLayer].address]: {
      aggregatorAddress: '0x3C7dCE5F83E99452CD399a1bCa5542BEd979E6CA',
    },
    [USDT_MAP[Network.XLayer].address]: {
      aggregatorAddress: '0xB249978EfdB8E01D5266F926409870c1Ec7336EA',
    },
  },
};

export const CHRONICLE_PRICE_SCRIBES_MAP: Record<
  Network.ArbitrumOne | Network.Berachain | Network.Mantle,
  Record<string, ChronicleScribe>
> = {
  [Network.ArbitrumOne]: {
    [W_USDM_MAP[Network.ArbitrumOne].address]: {
      scribeAddress: '0xdC6720c996Fad27256c7fd6E0a271e2A4687eF18',
      tokenPairAddress: ADDRESS_ZERO,
    },
  },
  [Network.Berachain]: {
    [SBTC_MAP[Network.Berachain].address]: {
      scribeAddress: '0x02a2f7F3109A4c6706A91C7c880225b440e3c8d7',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [SOLV_BTC_MAP[Network.Berachain].address]: {
      scribeAddress: '0x02a2f7F3109A4c6706A91C7c880225b440e3c8d7',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [UNI_BTC_MAP[Network.Berachain].address]: {
      scribeAddress: '0x02a2f7F3109A4c6706A91C7c880225b440e3c8d7',
      tokenPairAddress: ADDRESS_ZERO,
    },
  },
  [Network.Mantle]: {
    [FBTC_MAP[Network.Mantle].address]: {
      scribeAddress: '0x3bE46d64aAf6Bd88D5d445D83821805F7e393DDf',
      tokenPairAddress: WBTC_MAP[Network.Mantle].address,
    },
    [METH_MAP[Network.Mantle].address]: {
      scribeAddress: '0xBFE568Ea8f6bDFFe7c03F83dC8348517f8E7010A',
      tokenPairAddress: WETH_MAP[Network.Mantle].address,
    },
    [USDC_MAP[Network.Mantle].address]: {
      scribeAddress: '0xb9C3a09d9F73A1d5E90e6728D9c51F22CFF3bEB7',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [USDE_MAP[Network.Mantle].address]: {
      scribeAddress: '0x8744f55149A9923a6eD525A9FEdC270FBC2E1e12',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [USDT_MAP[Network.Mantle].address]: {
      scribeAddress: '0x5400f69e5A2E1712285889bB604Ed8ad44045501',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [USDY_MAP[Network.Mantle].address]: {
      scribeAddress: '0xB1141B90095B6E1aB8a5769868283cFc335047f1',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [WBTC_MAP[Network.Mantle].address]: {
      scribeAddress: '0x36b648060bc490DefC205950d3930bF971a6951B',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [WETH_MAP[Network.Mantle].address]: {
      scribeAddress: '0x5E16CA75000fb2B9d7B1184Fa24fF5D938a345Ef',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [WMNT_MAP[Network.Mantle].address]: {
      scribeAddress: '0xDda786905E8aFaFA0C0D50414F0f8A05a6a7901d',
      tokenPairAddress: ADDRESS_ZERO,
    },
  },
};

export const REDSTONE_PRICE_AGGREGATORS_MAP: Record<
  ArbitrumAndBerachainAndMantle, Record<string, AggregatorInfo | undefined>
> = {
  [Network.ArbitrumOne]: {
    [WE_ETH_MAP[Network.ArbitrumOne].address]: {
      aggregatorAddress: '0xA736eAe8805dDeFFba40cAB8c99bCB309dEaBd9B',
      tokenPairAddress: WETH_MAP[Network.ArbitrumOne].address,
    },
  },
  [Network.Berachain]: {
    [WETH_MAP[Network.Berachain].address]: {
      aggregatorAddress: '0x11B714817cBC92D402383cFd3f1037B122dcf69A',
      tokenPairAddress: ADDRESS_ZERO,
    },
  },
  [Network.Mantle]: {
    [USDE_MAP[Network.Mantle].address]: {
      aggregatorAddress: '0x3DFA26B9A15D37190bB8e50aE093730DcA88973E',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [USDT_MAP[Network.Mantle].address]: {
      aggregatorAddress: '0x3A236F67Fce401D87D7215695235e201966576E4',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [WETH_MAP[Network.Mantle].address]: {
      aggregatorAddress: '0xFc34806fbD673c21c1AEC26d69AA247F1e69a2C6',
      tokenPairAddress: ADDRESS_ZERO,
    },
    [WMNT_MAP[Network.Mantle].address]: {
      aggregatorAddress: '0xed1f0df0b88889e5eA19c768613cDf3DbBF3d2a7',
      tokenPairAddress: ADDRESS_ZERO,
    },
  },
};

function reverseAddress(address: string): string {
  return ethers.utils.getAddress(`0x${address.toLowerCase().substring(2).split('').reverse().join('')}`);
}

export function getChainlinkPriceAggregatorInfoByToken<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
): AggregatorInfo | undefined {
  return CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address];
}

export function getChainlinkPriceAggregatorByToken<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
): IChainlinkAggregator {
  return IChainlinkAggregator__factory.connect(
    CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.aggregatorAddress,
    core.hhUser1,
  );
}

export function getChainlinkPairTokenAddressByToken<T extends NetworkType>(
  core: CoreProtocolType<T>,
  token: IERC20,
): string | undefined {
  return CHAINLINK_PRICE_AGGREGATORS_MAP[core.network][token.address]!.tokenPairAddress;
}
