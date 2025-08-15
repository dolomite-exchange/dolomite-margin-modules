import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { BaseContract, BigNumber, BigNumberish, ethers } from 'ethers';
import fs, { readFileSync } from 'fs';
import { artifacts } from 'hardhat';
import { Artifact } from 'hardhat/types';
import {
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from 'packages/base/src/types';
import { createContractWithAbi, createContractWithLibraryAndArtifact } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
} from 'packages/base/test/utils/dolomite';
import { createSafeDelegateLibrary } from 'packages/base/test/utils/ecosystem-utils/general';
import { GlvToken } from 'packages/base/test/utils/ecosystem-utils/glv';
import { GMX_V2_CALLBACK_GAS_LIMIT } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { TestOracleProvider } from 'packages/gmx-v2/src/types';
import { createGmxV2Library, getOracleProviderForTokenKey } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { getChaosLabsPriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import {
  ChaosLabsPriceOracleV3,
  ChaosLabsPriceOracleV3__factory,
  IChainlinkAggregator__factory,
  IChaosLabsPriceOracleV3,
} from 'packages/oracles/src/types';
import path, { join } from 'path';
import { CHAOS_LABS_PRICE_AGGREGATORS_MAP } from '../../base/src/utils/constants';
import {
  getGlvIsolationModeTokenVaultConstructorParams,
  getGlvIsolationModeUnwrapperTraderV2ConstructorParams,
  getGlvIsolationModeVaultFactoryConstructorParams,
  getGlvIsolationModeWrapperTraderV2ConstructorParams,
  getGlvRegistryConstructorParams,
} from '../src/glv-constructors';
import {
  GlvIsolationModeTokenVaultV1,
  GlvIsolationModeUnwrapperTraderV2,
  GlvIsolationModeUnwrapperTraderV2__factory,
  GlvIsolationModeVaultFactory,
  GlvIsolationModeWrapperTraderV2,
  GlvIsolationModeWrapperTraderV2__factory,
  GlvLibrary,
  GlvLibrary__factory,
  GlvRegistry,
  GlvRegistry__factory,
  GmxV2Library,
  GmxV2TraderLibrary,
  IERC20__factory,
  IGlvIsolationModeVaultFactory,
  IGlvRegistry,
  TestGlvIsolationModeTokenVaultV1,
  TestGlvIsolationModeUnwrapperTraderV2,
  TestGlvIsolationModeUnwrapperTraderV2__factory,
  TestGlvIsolationModeVaultFactory,
} from '../src/types';

async function createArtifactFromWorkspaceIfNotExists(artifactName: string): Promise<Artifact> {
  if (await artifacts.artifactExists(artifactName)) {
    // GUARD STATEMENT!
    return artifacts.readArtifact(artifactName);
  }

  const packagesPath = '../../../packages';
  const children = fs
    .readdirSync(join(__dirname, packagesPath), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(packagesPath, d.name));

  const contractsFolders = ['contracts_coverage', 'contracts'];
  for (const contractFolder of contractsFolders) {
    for (const child of children) {
      const artifactPath = join(
        __dirname,
        child,
        `artifacts/${contractFolder}/${artifactName}.sol/${artifactName}.json`,
      );
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
        await artifacts.saveArtifactAndDebugFile(artifact);
        return artifact;
      }
    }
  }

  return Promise.reject(new Error(`Could not find ${artifactName}`));
}

export async function createGlvIsolationModeTokenVaultV1(
  core: CoreProtocolArbitrumOne,
  library: GlvLibrary,
  gmxV2Library: GmxV2Library,
): Promise<GlvIsolationModeTokenVaultV1> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GlvIsolationModeTokenVaultV1');
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return await createContractWithLibraryAndArtifact<GlvIsolationModeTokenVaultV1>(
    artifact,
    { GlvLibrary: library.address, GmxV2Library: gmxV2Library.address, ...libraries },
    getGlvIsolationModeTokenVaultConstructorParams(core),
  );
}

export async function createGlvLibrary(): Promise<GlvLibrary> {
  return createContractWithAbi<GlvLibrary>(GlvLibrary__factory.abi, GlvLibrary__factory.bytecode, []);
}

export async function createTestGlvIsolationModeTokenVaultV1(
  core: CoreProtocolArbitrumOne,
): Promise<TestGlvIsolationModeTokenVaultV1> {
  const actionsLib = await createIsolationModeTokenVaultV1ActionsImpl();
  const safeDelegateCallLibrary = await createSafeDelegateLibrary();
  const glvLibrary = await createGlvLibrary();
  const gmxV2Library = await createGmxV2Library();
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGlvIsolationModeTokenVaultV1');
  return await createContractWithLibraryAndArtifact<TestGlvIsolationModeTokenVaultV1>(
    artifact,
    {
      GlvLibrary: glvLibrary.address,
      GmxV2Library: gmxV2Library.address,
      SafeDelegateCallLib: safeDelegateCallLibrary.address,
      IsolationModeTokenVaultV1ActionsImpl: Object.values(actionsLib)[0],
    },
    getGlvIsolationModeTokenVaultConstructorParams(core),
  );
}

export async function createGlvIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  gmxV2Library: GmxV2Library,
  glvRegistry: IGlvRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  glvToken: GlvToken,
  userVaultImplementation: GlvIsolationModeTokenVaultV1,
  executionFee: BigNumberish,
  skipLongToken: boolean = false,
): Promise<GlvIsolationModeVaultFactory> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GlvIsolationModeVaultFactory');
  return createContractWithLibraryAndArtifact<GlvIsolationModeVaultFactory>(
    artifact,
    { GmxV2Library: gmxV2Library.address },
    getGlvIsolationModeVaultFactoryConstructorParams(
      core,
      glvRegistry,
      debtMarketIds,
      collateralMarketIds,
      glvToken,
      userVaultImplementation,
      executionFee,
      skipLongToken,
    ),
  );
}

export async function createTestGlvIsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  gmxV2library: GmxV2Library,
  glvRegistry: IGlvRegistry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  glvToken: GlvToken,
  userVaultImplementation: GlvIsolationModeTokenVaultV1,
  executionFee: BigNumberish,
  skipLongToken: boolean = false,
): Promise<TestGlvIsolationModeVaultFactory> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGlvIsolationModeVaultFactory');
  return createContractWithLibraryAndArtifact<TestGlvIsolationModeVaultFactory>(
    artifact,
    { GmxV2Library: gmxV2library.address },
    getGlvIsolationModeVaultFactoryConstructorParams(
      core,
      glvRegistry,
      debtMarketIds,
      collateralMarketIds,
      glvToken,
      userVaultImplementation,
      executionFee,
      skipLongToken,
    ),
  );
}

export async function createGlvRegistry(
  core: CoreProtocolArbitrumOne,
  callbackGasLimit: BigNumberish,
): Promise<GlvRegistry> {
  const implementation = await createContractWithAbi<GlvRegistry>(
    GlvRegistry__factory.abi,
    GlvRegistry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGlvRegistryConstructorParams(core, implementation, callbackGasLimit),
  );
  return GlvRegistry__factory.connect(proxy.address, core.hhUser1);
}

export async function createGlvIsolationModeUnwrapperTraderV2Implementation(
  core: CoreProtocolArbitrumOne,
  glvLibrary: GlvLibrary,
  gmxV2TraderLibrary: GmxV2TraderLibrary,
): Promise<GlvIsolationModeUnwrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GlvIsolationModeUnwrapperTraderV2');
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  return await createContractWithLibraryAndArtifact<GlvIsolationModeUnwrapperTraderV2>(
    artifact,
    { GlvLibrary: glvLibrary.address, GmxV2TraderLibrary: gmxV2TraderLibrary.address, ...libraries },
    [core.tokens.weth.address],
  );
}

export async function createGlvIsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dGlv: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  glvLibrary: GlvLibrary,
  gmxV2Library: GmxV2Library,
  glvRegistry: IGlvRegistry | GlvRegistry,
  skipLongToken: boolean = false,
): Promise<GlvIsolationModeUnwrapperTraderV2> {
  const implementation = await createGlvIsolationModeUnwrapperTraderV2Implementation(core, glvLibrary, gmxV2Library);
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGlvIsolationModeUnwrapperTraderV2ConstructorParams(core, implementation, dGlv, glvRegistry, skipLongToken),
  );

  return GlvIsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestGlvIsolationModeUnwrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dGlv: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  glvLibrary: GlvLibrary,
  gmxV2Library: GmxV2Library,
  safeDelegateCallLibrary: BaseContract,
  glvRegistry: IGlvRegistry | GlvRegistry,
  skipLongToken: boolean = false,
): Promise<TestGlvIsolationModeUnwrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGlvIsolationModeUnwrapperTraderV2');
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibraryAndArtifact<TestGlvIsolationModeUnwrapperTraderV2>(
    artifact,
    {
      GlvLibrary: glvLibrary.address,
      GmxV2Library: gmxV2Library.address,
      SafeDelegateCallLib: safeDelegateCallLibrary.address,
      ...libraries,
    },
    [core.tokens.weth.address],
  );
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGlvIsolationModeUnwrapperTraderV2ConstructorParams(core, implementation, dGlv, glvRegistry, skipLongToken),
  );

  return TestGlvIsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGlvIsolationModeWrapperTraderV2Implementation(
  core: CoreProtocolArbitrumOne,
  library: GlvLibrary,
  gmxV2TraderLibrary: GmxV2TraderLibrary,
): Promise<GlvIsolationModeWrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GlvIsolationModeWrapperTraderV2');
  const libraries = await createAsyncIsolationModeWrapperTraderImpl();
  return await createContractWithLibraryAndArtifact<GlvIsolationModeWrapperTraderV2>(
    artifact,
    { GlvLibrary: library.address, GmxV2TraderLibrary: gmxV2TraderLibrary.address, ...libraries },
    [core.tokens.weth.address],
  );
}

export async function createGlvIsolationModeWrapperTraderV2(
  core: CoreProtocolArbitrumOne,
  dGM: IGlvIsolationModeVaultFactory | GlvIsolationModeVaultFactory,
  library: GlvLibrary,
  gmxV2Library: GmxV2Library,
  glvRegistry: IGlvRegistry | GlvRegistry,
  skipLongToken: boolean = false,
): Promise<GlvIsolationModeWrapperTraderV2> {
  const implementation = await createGlvIsolationModeWrapperTraderV2Implementation(core, library, gmxV2Library);
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGlvIsolationModeWrapperTraderV2ConstructorParams(core, implementation, dGM, glvRegistry, skipLongToken),
  );
  return GlvIsolationModeWrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGlvTokenPriceOracle(
  core: CoreProtocolArbitrumOne,
  dGlvTokens: IGlvIsolationModeVaultFactory[],
): Promise<IChaosLabsPriceOracleV3> {
  const underlyingTokens = await Promise.all(dGlvTokens.map((t) => t.UNDERLYING_TOKEN()));
  return createContractWithAbi<ChaosLabsPriceOracleV3>(
    ChaosLabsPriceOracleV3__factory.abi,
    ChaosLabsPriceOracleV3__factory.bytecode,
    getChaosLabsPriceOracleV3ConstructorParams(
      dGlvTokens.map((t) => IERC20__factory.connect(t.address, t.provider)),
      underlyingTokens.map((t) =>
        IChainlinkAggregator__factory.connect(
          CHAOS_LABS_PRICE_AGGREGATORS_MAP[core.network][t]!.aggregatorAddress,
          core.hhUser1,
        ),
      ),
      dGlvTokens.map(() => false),
      core.dolomiteRegistry,
      core.dolomiteMargin,
    ),
  );
}

export function getInitiateWrappingParams(
  accountNumber: BigNumberish,
  marketId1: BigNumberish,
  amountIn: BigNumberish,
  marketId2: BigNumberish,
  minAmountOut: BigNumberish,
  wrapper: GlvIsolationModeWrapperTraderV2,
): any {
  return {
    accountNumber,
    amountIn,
    minAmountOut,
    marketPath: [marketId1, marketId2],
    traderParams: [
      {
        trader: wrapper.address,
        traderType: GenericTraderType.IsolationModeWrapper,
        tradeData: BYTES_EMPTY,
        makerAccountIndex: 0,
      },
    ],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}

export function getInitiateUnwrappingParams(
  accountNumber: BigNumberish,
  marketId1: BigNumberish,
  amountIn: BigNumberish,
  marketId2: BigNumberish,
  minAmountOut: BigNumberish,
  unwrapper: GlvIsolationModeUnwrapperTraderV2,
  executionFee: BigNumberish,
): any {
  return {
    amountIn,
    minAmountOut,
    marketPath: [marketId1, marketId2],
    traderParams: [
      {
        trader: unwrapper.address,
        traderType: GenericTraderType.IsolationModeUnwrapper,
        tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [accountNumber, executionFee]),
        makerAccountIndex: 0,
      },
    ],
    makerAccounts: [],
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
  };
}

export async function getGlvOracleParams(
  core: CoreProtocolArbitrumOne,
  controller: SignerWithAddressWithSafety,
  glvToken: GlvToken,
  provider: TestOracleProvider,
  oracle: string
) {
  const tokens = [];
  const providers = [];
  const data = [];

  const dataStore = core.gmxV2Ecosystem.gmxDataStore;
  const glvTokenInfo = await core.glvEcosystem.glvReader.getGlvInfo(dataStore.address, glvToken.glvToken.address);
  let tokenKey;

  tokenKey = getOracleProviderForTokenKey({ address: glvTokenInfo.glv.shortToken });
  await dataStore.connect(controller).setAddress(tokenKey, provider.address);
  tokens.push(glvTokenInfo.glv.shortToken);
  providers.push(provider.address);
  data.push(BYTES_EMPTY);

  tokenKey = getOracleProviderForTokenKey({ address: glvTokenInfo.glv.longToken });
  await dataStore.connect(controller).setAddress(tokenKey, provider.address);
  tokens.push(glvTokenInfo.glv.longToken);
  providers.push(provider.address);
  data.push(BYTES_EMPTY);

  for (const market of glvTokenInfo.markets) {
    const index = (await core.gmxV2Ecosystem.gmxReader.getMarket(dataStore.address, market)).indexToken;
    if (!tokens.includes(index)) {
      tokenKey = getOracleProviderForTokenKey({ address: index });
      await dataStore.connect(controller).setAddress(tokenKey, provider.address);
      tokens.push(index);
      providers.push(provider.address);
      data.push(BYTES_EMPTY);
    }
  }

  return {
    tokens,
    providers,
    data,
  };
}

export function getGlvDepositObject(
  wrapper: string,
  glv: string,
  marketToken: string,
  longToken: string,
  shortToken: string,
  longAmount: BigNumber,
  shortAmount: BigNumber,
  minGlvTokens: BigNumber,
  executionFee: BigNumber,
  receivedGlvToken: BigNumber = BigNumber.from('0'),
  callbackGasLimit: BigNumber = GMX_V2_CALLBACK_GAS_LIMIT,
) {
  const deposit = {
    addresses: {
      account: wrapper,
      receiver: wrapper,
      callbackContract: wrapper,
      uiFeeReceiver: ADDRESS_ZERO,
      glv: glv,
      market: marketToken,
      initialLongToken: longToken,
      initialShortToken: shortToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    numbers: {
      minGlvTokens,
      executionFee,
      callbackGasLimit,
      marketTokenAmount: ZERO_BI,
      initialLongTokenAmount: longAmount,
      initialShortTokenAmount: shortAmount,
      updatedAtTime: 321321321,
    },
    flags: {
      shouldUnwrapNativeToken: false,
      isMarketTokenDeposit: false,
    },
  };

  let eventData;
  if (receivedGlvToken.eq(0)) {
    eventData = {
      addressItems: {
        items: [],
        arrayItems: [],
      },
      uintItems: {
        items: [],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  } else {
    eventData = {
      addressItems: {
        items: [],
        arrayItems: [],
      },
      uintItems: {
        items: [
          {
            key: 'receivedGlvTokens',
            value: receivedGlvToken,
          },
        ],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  }
  return { deposit, eventData };
}

export function getGlvWithdrawalObject(
  unwrapper: string,
  glv: string,
  marketToken: string,
  minLongTokenAmount: BigNumber,
  minShortTokenAmount: BigNumber,
  glvTokenAmount: BigNumber,
  executionFee: BigNumber,
  outputToken: string,
  secondaryOutputToken: string,
  outputAmount: BigNumber = BigNumber.from('0'),
  secondaryOutputAmount: BigNumber = BigNumber.from('0'),
  callbackGasLimit: BigNumber = GMX_V2_CALLBACK_GAS_LIMIT,
) {
  const withdrawal = {
    addresses: {
      account: unwrapper,
      receiver: unwrapper,
      callbackContract: unwrapper,
      uiFeeReceiver: ADDRESS_ZERO,
      market: marketToken,
      glv: glv,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    numbers: {
      glvTokenAmount,
      minLongTokenAmount,
      minShortTokenAmount,
      executionFee,
      callbackGasLimit,
      updatedAtTime: 321321321,
    },
    flags: {
      shouldUnwrapNativeToken: false,
    },
  };

  let eventData;
  if (outputAmount.eq(0) && secondaryOutputAmount.eq(0)) {
    eventData = {
      addressItems: {
        items: [],
        arrayItems: [],
      },
      uintItems: {
        items: [],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  } else {
    eventData = {
      addressItems: {
        items: [
          {
            key: 'outputToken',
            value: outputToken,
          },
          {
            key: 'secondaryOutputToken',
            value: secondaryOutputToken,
          },
        ],
        arrayItems: [],
      },
      uintItems: {
        items: [
          {
            key: 'outputAmount',
            value: outputAmount,
          },
          {
            key: 'secondaryOutputAmount',
            value: secondaryOutputAmount,
          },
        ],
        arrayItems: [],
      },
      intItems: {
        items: [],
        arrayItems: [],
      },
      boolItems: {
        items: [],
        arrayItems: [],
      },
      bytes32Items: {
        items: [],
        arrayItems: [],
      },
      bytesItems: {
        items: [],
        arrayItems: [],
      },
      stringItems: {
        items: [],
        arrayItems: [],
      },
    };
  }
  return { withdrawal, eventData };
}

export function getKey(key: string, types: string[], values: any[]): string {
  const stringBytes = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [key]));
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['bytes32', ...types], [stringBytes, ...values]));
}

export async function setupNewOracleAggregatorTokens(core: CoreProtocolArbitrumOne) {
  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA', // ATOM - good
    '0xCDA67618e51762235eacA373894F0C79256768fa',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0x7D7F1765aCbaF847b9A1f7137FE8Ed4931FbfEbA',
    decimals: 6,
  });

  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0xC4da4c24fd591125c3F47b340b6f4f76111883d8', // DOGE - good
    '0x9A7FB1b3950837a8D9b40517626E11D4127C098C',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0xC4da4c24fd591125c3F47b340b6f4f76111883d8',
    decimals: 8,
  });

  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C', // NEAR - good
    '0xBF5C3fB2633e924598A46B9D07a174a9DBcF57C0',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0x1FF7F3EFBb9481Cbd7db4F932cBCD4467144237C',
    decimals: 24,
  });

  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0xc14e065b0067dE91534e032868f5Ac6ecf2c6868', // XRP
    '0xB4AD57B52aB9141de9926a3e0C8dc6264c2ef205',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0xc14e065b0067dE91534e032868f5Ac6ecf2c6868',
    decimals: 6,
  });

  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0xB46A094Bc4B0adBD801E14b9DB95e05E28962764', // LTC
    '0x5698690a7B7B84F6aa985ef7690A8A7288FBc9c8',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0xB46A094Bc4B0adBD801E14b9DB95e05E28962764',
    decimals: 8,
  });

  await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
    '0x3E57D02f9d196873e55727382974b02EdebE6bfd', // SHIB
    '0x0E278D14B4bf6429dDB0a1B353e2Ae8A4e128C93',
    false,
  );
  await core.oracleAggregatorV2.ownerInsertOrUpdateToken({
    oracleInfos: [
      {
        oracle: core.chainlinkPriceOracleV3.address,
        tokenPair: ADDRESS_ZERO,
        weight: 100,
      },
    ],
    token: '0x3E57D02f9d196873e55727382974b02EdebE6bfd',
    decimals: 18,
  });
}
