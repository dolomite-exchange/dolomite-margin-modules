import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericEventEmissionType, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseContract, BigNumber, BigNumberish, ethers } from 'ethers';
import hre from 'hardhat';
import {
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
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
  IGmxMarketToken,
  IGmxV2IsolationModeVaultFactory,
  IGmxV2Registry,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeUnwrapperTraderV2,
  TestGmxV2IsolationModeUnwrapperTraderV2__factory,
  TestGmxV2IsolationModeVaultFactory,
} from '../src/types';
import GmxV2IsolationModeTokenVaultV1Artifact from '../artifacts/contracts/GmxV2IsolationModeTokenVaultV1.sol/GmxV2IsolationModeTokenVaultV1.json';
import TestGmxV2IsolationModeTokenVaultV1Artifact from '../artifacts/contracts/test/TestGmxV2IsolationModeTokenVaultV1.sol/TestGmxV2IsolationModeTokenVaultV1.json';
import GmxV2IsolationModeVaultFactoryArtifact from '../artifacts/contracts/GmxV2IsolationModeVaultFactory.sol/GmxV2IsolationModeVaultFactory.json';
import TestGmxV2IsolationModeVaultFactoryArtifact from '../artifacts/contracts/test/TestGmxV2IsolationModeVaultFactory.sol/TestGmxV2IsolationModeVaultFactory.json';
import GmxV2IsolationModeUnwrapperTraderV2Artifact from '../artifacts/contracts/GmxV2IsolationModeUnwrapperTraderV2.sol/GmxV2IsolationModeUnwrapperTraderV2.json';
import GmxV2IsolationModeWrapperTraderV2Artifact from '../artifacts/contracts/GmxV2IsolationModeWrapperTraderV2.sol/GmxV2IsolationModeWrapperTraderV2.json';
import TestGmxV2IsolationModeUnwrapperTraderV2Artifact from '../artifacts/contracts/test/TestGmxV2IsolationModeUnwrapperTraderV2.sol/TestGmxV2IsolationModeUnwrapperTraderV2.json';
import {
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  getGmxV2RegistryConstructorParams,
  GMX_V2_CALLBACK_GAS_LIMIT,
} from '../src/gmx-v2-constructors';
import { createContractWithAbi, createContractWithLibrary, createContractWithLibraryAndArtifact } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { createSafeDelegateLibrary } from '@dolomite-exchange/modules-base/test/utils/ecosystem-token-utils/general';

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
  return createContractWithLibraryAndArtifact<GmxV2IsolationModeTokenVaultV1>(
    GmxV2IsolationModeTokenVaultV1Artifact,
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
  return await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeTokenVaultV1>(
    TestGmxV2IsolationModeTokenVaultV1Artifact,
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
  executionFee: BigNumberish,
): Promise<GmxV2IsolationModeVaultFactory> {
  return createContractWithLibraryAndArtifact<GmxV2IsolationModeVaultFactory>(
    GmxV2IsolationModeVaultFactoryArtifact,
    { GmxV2Library: library.address },
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      gmxRegistry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      userVaultImplementation,
      executionFee,
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
  executionFee: BigNumberish,
): Promise<TestGmxV2IsolationModeVaultFactory> {
  return createContractWithLibraryAndArtifact<TestGmxV2IsolationModeVaultFactory>(
    TestGmxV2IsolationModeVaultFactoryArtifact,
    { GmxV2Library: library.address },
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      gmxRegistry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      userVaultImplementation,
      executionFee,
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
  const implementation = await createContractWithLibraryAndArtifact<GmxV2IsolationModeUnwrapperTraderV2>(
    GmxV2IsolationModeUnwrapperTraderV2Artifact,
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
  const implementation = await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeUnwrapperTraderV2>(
    TestGmxV2IsolationModeUnwrapperTraderV2Artifact,
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
  const implementation = await createContractWithLibraryAndArtifact<GmxV2IsolationModeWrapperTraderV2>(
    GmxV2IsolationModeWrapperTraderV2Artifact,
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
    userConfig: {
      deadline: '123123123123123',
      balanceCheckFlag: BalanceCheckFlag.None,
      eventType: GenericEventEmissionType.None,
    },
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