import {
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  createContractWithAbi,
  createContractWithLibraryAndArtifact,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  createAsyncIsolationModeUnwrapperTraderImpl,
  createAsyncIsolationModeWrapperTraderImpl,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { createSafeDelegateLibrary } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/general';
import { GmToken } from '@dolomite-exchange/modules-base/test/utils/ecosystem-utils/gmx';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericEventEmissionType, GenericTraderType } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseContract, BigNumber, BigNumberish, ethers } from 'ethers';
import fs, { readFileSync } from 'fs';
import { artifacts } from 'hardhat';
import { Artifact } from 'hardhat/types';
import path, { join } from 'path';
import {
  getGmxV2IsolationModeTokenVaultConstructorParams,
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  getGmxV2RegistryConstructorParams,
  GMX_V2_CALLBACK_GAS_LIMIT,
} from '../src/gmx-v2-constructors';
import {
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
  IGmxV2IsolationModeVaultFactory,
  IGmxV2Registry,
  TestGmxV2IsolationModeTokenVaultV1,
  TestGmxV2IsolationModeUnwrapperTraderV2,
  TestGmxV2IsolationModeUnwrapperTraderV2__factory,
  TestGmxV2IsolationModeVaultFactory,
} from '../src/types';

async function createArtifactFromWorkspaceIfNotExists(artifactName: string): Promise<Artifact> {
  if (await artifacts.artifactExists(artifactName)) {
    // GUARD STATEMENT!
    return artifacts.readArtifact(artifactName);
  }

  const packagesPath = '../../../packages';
  const children = fs.readdirSync(join(__dirname, packagesPath), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(packagesPath, d.name));

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

export async function createGmxV2Registry(
  core: CoreProtocolArbitrumOne,
  callbackGasLimit: BigNumberish,
): Promise<GmxV2Registry> {
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
  core: CoreProtocolArbitrumOne,
  library: GmxV2Library,
): Promise<GmxV2IsolationModeTokenVaultV1> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GmxV2IsolationModeTokenVaultV1');
  const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
  return createContractWithLibraryAndArtifact<GmxV2IsolationModeTokenVaultV1>(
    artifact,
    { GmxV2Library: library.address, ...libraries },
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
  );
}

export async function createTestGmxV2IsolationModeTokenVaultV1(
  core: CoreProtocolArbitrumOne,
): Promise<TestGmxV2IsolationModeTokenVaultV1> {
  const actionsLib = await createIsolationModeTokenVaultV1ActionsImpl();
  const safeDelegateCallLibrary = await createSafeDelegateLibrary();
  const gmxV2Library = await createGmxV2Library();
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGmxV2IsolationModeTokenVaultV1');
  return await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeTokenVaultV1>(
    artifact,
    {
      GmxV2Library: gmxV2Library.address,
      SafeDelegateCallLib: safeDelegateCallLibrary.address,
      IsolationModeTokenVaultV1ActionsImpl: Object.values(actionsLib)[0],
    },
    getGmxV2IsolationModeTokenVaultConstructorParams(core),
  );
}

export async function createGmxV2IsolationModeVaultFactory(
  core: CoreProtocolArbitrumOne,
  library: GmxV2Library,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: GmToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
  executionFee: BigNumberish,
): Promise<GmxV2IsolationModeVaultFactory> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GmxV2IsolationModeVaultFactory');
  return createContractWithLibraryAndArtifact<GmxV2IsolationModeVaultFactory>(
    artifact,
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
  core: CoreProtocolArbitrumOne,
  library: GmxV2Library,
  gmxRegistry: IGmxV2Registry,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: GmToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
  executionFee: BigNumberish,
): Promise<TestGmxV2IsolationModeVaultFactory> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGmxV2IsolationModeVaultFactory');
  return createContractWithLibraryAndArtifact<TestGmxV2IsolationModeVaultFactory>(
    artifact,
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
  core: CoreProtocolArbitrumOne,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxV2Library: GmxV2Library,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<GmxV2IsolationModeUnwrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GmxV2IsolationModeUnwrapperTraderV2');
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibraryAndArtifact<GmxV2IsolationModeUnwrapperTraderV2>(
    artifact,
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
  core: CoreProtocolArbitrumOne,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxV2Library: GmxV2Library,
  safeDelegateCallLibrary: BaseContract,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<TestGmxV2IsolationModeUnwrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('TestGmxV2IsolationModeUnwrapperTraderV2');
  const libraries = await createAsyncIsolationModeUnwrapperTraderImpl();
  const implementation = await createContractWithLibraryAndArtifact<TestGmxV2IsolationModeUnwrapperTraderV2>(
    artifact,
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
  core: CoreProtocolArbitrumOne,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  library: GmxV2Library,
  gmxV2Registry: IGmxV2Registry | GmxV2Registry,
): Promise<GmxV2IsolationModeWrapperTraderV2> {
  const artifact = await createArtifactFromWorkspaceIfNotExists('GmxV2IsolationModeWrapperTraderV2');
  const libraries = await createAsyncIsolationModeWrapperTraderImpl();
  const implementation = await createContractWithLibraryAndArtifact<GmxV2IsolationModeWrapperTraderV2>(
    artifact,
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
  core: CoreProtocolArbitrumOne,
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
