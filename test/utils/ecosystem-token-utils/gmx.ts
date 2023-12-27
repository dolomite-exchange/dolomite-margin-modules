import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseContract, BigNumber, BigNumberish, ethers } from 'ethers';
import {
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeUnwrapperTraderV1,
  GLPIsolationModeUnwrapperTraderV1__factory,
  GLPIsolationModeUnwrapperTraderV2,
  GLPIsolationModeUnwrapperTraderV2__factory,
  GLPIsolationModeVaultFactory,
  GLPIsolationModeVaultFactory__factory,
  GLPIsolationModeWrapperTraderV1,
  GLPIsolationModeWrapperTraderV1__factory,
  GLPIsolationModeWrapperTraderV2,
  GLPIsolationModeWrapperTraderV2__factory,
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  GMXIsolationModeTokenVaultV1,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  GMXIsolationModeVaultFactory,
  GMXIsolationModeVaultFactory__factory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeUnwrapperTraderV2__factory,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2IsolationModeWrapperTraderV2__factory,
  GmxV2Library,
  GmxV2Library__factory,
  GmxV2MarketTokenPriceOracle,
  GmxV2MarketTokenPriceOracle__factory,
  GmxV2Registry,
  GmxV2Registry__factory,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  IGmxMarketToken,
  IGmxRegistryV1,
  IGmxV2IsolationModeVaultFactory,
  IGmxV2Registry,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
  TestGLPIsolationModeTokenVaultV1,
  TestGLPIsolationModeTokenVaultV2,
  TestGMXIsolationModeTokenVaultV1,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeUnwrapperTraderV2,
  TestGmxV2IsolationModeUnwrapperTraderV2__factory,
  TestGmxV2IsolationModeVaultFactory,
} from '../../../src/types';
import {
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderV1ConstructorParams,
  getGLPUnwrapperTraderV2ConstructorParams,
  getGLPWrapperTraderV1ConstructorParams,
  getGLPWrapperTraderV2ConstructorParams,
  getGMXIsolationModeVaultFactoryConstructorParams,
  getGmxRegistryConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  getGmxV2RegistryConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
  GMX_V2_CALLBACK_GAS_LIMIT,
  GmxUserVaultImplementation,
} from '../../../src/utils/constructors/gmx';
import { createContractWithAbi, createContractWithLibrary } from '../../../src/utils/dolomite-utils';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '../dolomite';
import { CoreProtocol } from '../setup';
import { createSafeDelegateLibrary } from './general';

export async function createGLPPriceOracleV1(
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPPriceOracleV1> {
  return createContractWithAbi<GLPPriceOracleV1>(
    GLPPriceOracleV1__factory.abi,
    GLPPriceOracleV1__factory.bytecode,
    getGLPPriceOracleV1ConstructorParams(dfsGlp, gmxRegistry),
  );
}

export async function createGLPUnwrapperTraderV1(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeUnwrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeUnwrapperTraderV1>(
    GLPIsolationModeUnwrapperTraderV1__factory.abi,
    GLPIsolationModeUnwrapperTraderV1__factory.bytecode,
    getGLPUnwrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPUnwrapperTraderV2(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<GLPIsolationModeUnwrapperTraderV2>(
    GLPIsolationModeUnwrapperTraderV2__factory.abi,
    GLPIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGLPUnwrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPIsolationModeTokenVaultV1(): Promise<GLPIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GLPIsolationModeTokenVaultV1>(
    'GLPIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGLPIsolationModeTokenVaultV2(): Promise<GLPIsolationModeTokenVaultV2> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GLPIsolationModeTokenVaultV2>(
    'GLPIsolationModeTokenVaultV2',
    libraries,
    [],
  );
}

export async function createTestGLPIsolationModeTokenVaultV1(): Promise<TestGLPIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestGLPIsolationModeTokenVaultV1>(
    'TestGLPIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createTestGLPIsolationModeTokenVaultV2(): Promise<TestGLPIsolationModeTokenVaultV2> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestGLPIsolationModeTokenVaultV2>(
    'TestGLPIsolationModeTokenVaultV2',
    libraries,
    [],
  );
}

export async function createGLPIsolationModeVaultFactory(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GmxUserVaultImplementation,
): Promise<GLPIsolationModeVaultFactory> {
  return createContractWithAbi<GLPIsolationModeVaultFactory>(
    GLPIsolationModeVaultFactory__factory.abi,
    GLPIsolationModeVaultFactory__factory.bytecode,
    getGLPIsolationModeVaultFactoryConstructorParams(core, gmxRegistry, userVaultImplementation),
  );
}

export async function createGLPWrapperTraderV1(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeWrapperTraderV1> {
  return createContractWithAbi<GLPIsolationModeWrapperTraderV1>(
    GLPIsolationModeWrapperTraderV1__factory.abi,
    GLPIsolationModeWrapperTraderV1__factory.bytecode,
    getGLPWrapperTraderV1ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGLPWrapperTraderV2(
  core: CoreProtocol,
  dfsGlp: IGLPIsolationModeVaultFactory | GLPIsolationModeVaultFactory | IGLPIsolationModeVaultFactoryOld,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
): Promise<GLPIsolationModeWrapperTraderV2> {
  return createContractWithAbi<GLPIsolationModeWrapperTraderV2>(
    GLPIsolationModeWrapperTraderV2__factory.abi,
    GLPIsolationModeWrapperTraderV2__factory.bytecode,
    getGLPWrapperTraderV2ConstructorParams(core, dfsGlp, gmxRegistry),
  );
}

export async function createGmxRegistry(core: CoreProtocol): Promise<GmxRegistryV1> {
  const implementation = await createContractWithAbi<GmxRegistryV1>(
    GmxRegistryV1__factory.abi,
    GmxRegistryV1__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGmxRegistryConstructorParams(implementation, core),
  );
  return GmxRegistryV1__factory.connect(proxy.address, core.hhUser1);
}

export async function createGMXIsolationModeTokenVaultV1(): Promise<GMXIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GMXIsolationModeTokenVaultV1>(
    'GMXIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createTestGMXIsolationModeTokenVaultV1(): Promise<TestGMXIsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<TestGMXIsolationModeTokenVaultV1>(
    'TestGMXIsolationModeTokenVaultV1',
    libraries,
    [],
  );
}

export async function createGMXIsolationModeVaultFactory(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV1 | GmxRegistryV1,
  userVaultImplementation: GMXIsolationModeTokenVaultV1,
): Promise<GMXIsolationModeVaultFactory> {
  return createContractWithAbi<GMXIsolationModeVaultFactory>(
    GMXIsolationModeVaultFactory__factory.abi,
    GMXIsolationModeVaultFactory__factory.bytecode,
    getGMXIsolationModeVaultFactoryConstructorParams(gmxRegistry, userVaultImplementation, core),
  );
}

export async function createGMXUnwrapperTraderV2(
  core: CoreProtocol,
  factory: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
): Promise<SimpleIsolationModeUnwrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
    SimpleIsolationModeUnwrapperTraderV2__factory.abi,
    SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
    getGMXUnwrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createGMXWrapperTraderV2(
  core: CoreProtocol,
  factory: IGMXIsolationModeVaultFactory | GMXIsolationModeVaultFactory,
): Promise<SimpleIsolationModeWrapperTraderV2> {
  return createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
    SimpleIsolationModeWrapperTraderV2__factory.abi,
    SimpleIsolationModeWrapperTraderV2__factory.bytecode,
    getGMXWrapperTraderV2ConstructorParams(factory, core),
  );
}

export async function createGmxV2Registry(core: CoreProtocol, callbackGasLimit: BigNumberish): Promise<GmxV2Registry> {
  const implementation = await createContractWithAbi<GmxV2Registry>(
    GmxV2Registry__factory.abi,
    GmxV2Registry__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGmxV2RegistryConstructorParams(core, implementation, callbackGasLimit),
  );
  return GmxV2Registry__factory.connect(proxy.address, core.hhUser1);
}

export async function createGmxV2Library(): Promise<GmxV2Library> {
  return createContractWithAbi<GmxV2Library>(
    GmxV2Library__factory.abi,
    GmxV2Library__factory.bytecode,
    [],
  );
}

export async function createGmxV2IsolationModeTokenVaultV1(
  core: CoreProtocol,
  library: GmxV2Library,
): Promise<GmxV2IsolationModeTokenVaultV1> {
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibrary<GmxV2IsolationModeTokenVaultV1>(
    'GmxV2IsolationModeTokenVaultV1',
    { GmxV2Library: library.address, ...libraries },
    [core.tokens.weth.address],
  );
}

export async function createTestGmxV2IsolationModeTokenVaultV1(
  core: CoreProtocol,
): Promise<TestGmxV2IsolationModeTokenVaultV1> {
  const actionsLib = await createIsolationModeTokenVaultV1ActionsImpl();
  const safeDelegateCallLibrary = await createSafeDelegateLibrary();
  const gmxV2Library = await createGmxV2Library();
  return await createContractWithLibrary<TestGmxV2IsolationModeTokenVaultV1>(
    'TestGmxV2IsolationModeTokenVaultV1',
    {
      GmxV2Library: gmxV2Library.address,
      SafeDelegateCallLib: safeDelegateCallLibrary.address,
      IsolationModeTokenVaultV1ActionsImpl: Object.values(actionsLib)[0],
    },
    [core.tokens.weth.address],
  );
}

export async function createGmxV2IsolationModeVaultFactory(
  core: CoreProtocol,
  library: GmxV2Library,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: IGmxMarketToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
): Promise<GmxV2IsolationModeVaultFactory> {
  return createContractWithLibrary<GmxV2IsolationModeVaultFactory>(
    'GmxV2IsolationModeVaultFactory',
    { GmxV2Library: library.address },
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      gmxRegistry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      userVaultImplementation,
    ),
  );
}

export async function createTestGmxV2IsolationModeVaultFactory(
  core: CoreProtocol,
  library: GmxV2Library,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: IGmxMarketToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
): Promise<TestGmxV2IsolationModeVaultFactory> {
  return createContractWithLibrary<TestGmxV2IsolationModeVaultFactory>(
    'TestGmxV2IsolationModeVaultFactory',
    { GmxV2Library: library.address },
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      gmxRegistry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      userVaultImplementation,
    ),
  );
}

export async function createGmxV2IsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxV2Library: GmxV2Library,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<GmxV2IsolationModeUnwrapperTraderV2> {
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibrary<GmxV2IsolationModeUnwrapperTraderV2>(
    'GmxV2IsolationModeUnwrapperTraderV2',
    { GmxV2Library: gmxV2Library.address, ...libraries },
    [core.tokens.weth.address],
  );

  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      implementation,
      dGM,
      gmxV2Registry,
    ),
  );

  return GmxV2IsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createTestGmxV2IsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxV2Library: GmxV2Library,
  safeDelegateCallLibrary: BaseContract,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<TestGmxV2IsolationModeUnwrapperTraderV2> {
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibrary<TestGmxV2IsolationModeUnwrapperTraderV2>(
    'TestGmxV2IsolationModeUnwrapperTraderV2',
    { GmxV2Library: gmxV2Library.address, SafeDelegateCallLib: safeDelegateCallLibrary.address, ...libraries },
    [core.tokens.weth.address],
  );

  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      implementation,
      dGM,
      gmxV2Registry,
    ),
  );

  return TestGmxV2IsolationModeUnwrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGmxV2IsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  library: GmxV2Library,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<GmxV2IsolationModeWrapperTraderV2> {
  const libraries = await createAsyncIsolationModeWrapperTraderImpl();
  const implementation = await createContractWithLibrary<GmxV2IsolationModeWrapperTraderV2>(
    'GmxV2IsolationModeWrapperTraderV2',
    { GmxV2Library: library.address, ...libraries },
    [core.tokens.weth.address],
  );
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(
      core,
      implementation,
      dGM,
      gmxV2Registry,
    ),
  );
  return GmxV2IsolationModeWrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGmxV2MarketTokenPriceOracle(
  core: CoreProtocol,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<GmxV2MarketTokenPriceOracle> {
  return createContractWithAbi(
    GmxV2MarketTokenPriceOracle__factory.abi,
    GmxV2MarketTokenPriceOracle__factory.bytecode,
    getGmxV2MarketTokenPriceOracleConstructorParams(core, gmxV2Registry),
  );
}

export function getInitiateWrappingParams(
  accountNumber: BigNumberish,
  marketId1: BigNumberish,
  amountIn: BigNumberish,
  marketId2: BigNumberish,
  minAmountOut: BigNumberish,
  wrapper: GmxV2IsolationModeWrapperTraderV2,
  executionFee: BigNumberish,
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
        tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [accountNumber, executionFee]),
        makerAccountIndex: 0,
      },
    ],
    makerAccounts: [],
    userConfig: { deadline: '123123123123123', balanceCheckFlag: BalanceCheckFlag.None },
  };
}

export function getInitiateUnwrappingParams(
  accountNumber: BigNumberish,
  marketId1: BigNumberish,
  amountIn: BigNumberish,
  marketId2: BigNumberish,
  minAmountOut: BigNumberish,
  unwrapper: GmxV2IsolationModeUnwrapperTraderV2,
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
    userConfig: { deadline: '123123123123123', balanceCheckFlag: BalanceCheckFlag.None },
  };
}

export function getOracleParams(token1: string, token2: string) {
  return {
    signerInfo: '1',
    tokens: [],
    compactedMinOracleBlockNumbers: [],
    compactedMaxOracleBlockNumbers: [],
    compactedOracleTimestamps: [],
    compactedDecimals: [],
    compactedMinPrices: [],
    compactedMinPricesIndexes: [],
    compactedMaxPrices: [],
    compactedMaxPricesIndexes: [],
    signatures: [],
    priceFeedTokens: [
      token1,
      token2,
    ],
    realtimeFeedTokens: [],
    realtimeFeedData: [],
  };
}

export function getWithdrawalObject(
  unwrapper: string,
  marketToken: string,
  minLongTokenAmount: BigNumber,
  minShortTokenAmount: BigNumber,
  marketTokenAmount: BigNumber,
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
      uiFeeReceiver: ZERO_ADDRESS,
      market: marketToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    numbers: {
      marketTokenAmount,
      minLongTokenAmount,
      minShortTokenAmount,
      executionFee,
      callbackGasLimit,
      updatedAtBlock: 123123123,
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

export function getDepositObject(
  wrapper: string,
  marketToken: string,
  longToken: string,
  shortToken: string,
  longAmount: BigNumber,
  shortAmount: BigNumber,
  minMarketTokens: BigNumber,
  executionFee: BigNumber,
  receivedMarketToken: BigNumber = BigNumber.from('0'),
  callbackGasLimit: BigNumber = GMX_V2_CALLBACK_GAS_LIMIT,
) {
  const deposit = {
    addresses: {
      account: wrapper,
      receiver: wrapper,
      callbackContract: wrapper,
      uiFeeReceiver: ZERO_ADDRESS,
      market: marketToken,
      initialLongToken: longToken,
      initialShortToken: shortToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    numbers: {
      minMarketTokens,
      executionFee,
      callbackGasLimit,
      initialLongTokenAmount: longAmount,
      initialShortTokenAmount: shortAmount,
      updatedAtBlock: 123123123,
    },
    flags: {
      shouldUnwrapNativeToken: false,
    },
  };

  let eventData;
  if (receivedMarketToken.eq(0)) {
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
            key: 'receivedMarketTokens',
            value: receivedMarketToken,
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
