import { BigNumberish, ethers } from 'ethers';
import {
  ERC20,
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
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
  GmxRegistryV1,
  GmxRegistryV1__factory,
  GmxRegistryV2,
  GmxRegistryV2__factory,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeUnwrapperTraderV2__factory,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeVaultFactory__factory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2IsolationModeWrapperTraderV2__factory,
  GmxV2MarketTokenPriceOracle,
  GmxV2MarketTokenPriceOracle__factory,
  IERC20,
  IGLPIsolationModeVaultFactory,
  IGLPIsolationModeVaultFactoryOld,
  IGmxMarketToken,
  IGmxRegistryV1,
  IGmxRegistryV2,
  IGmxV2IsolationModeVaultFactory,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  RegistryProxy,
  RegistryProxy__factory,
} from '../../../src/types';
import {
  getGLPIsolationModeVaultFactoryConstructorParams,
  getGLPPriceOracleV1ConstructorParams,
  getGLPUnwrapperTraderV1ConstructorParams,
  getGLPUnwrapperTraderV2ConstructorParams,
  getGLPWrapperTraderV1ConstructorParams,
  getGLPWrapperTraderV2ConstructorParams,
  getGmxRegistryConstructorParams,
  getGmxRegistryV2ConstructorParams,
  getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams,
  getGmxV2IsolationModeVaultFactoryConstructorParams,
  getGmxV2IsolationModeWrapperTraderV2ConstructorParams,
  getGmxV2MarketTokenPriceOracleConstructorParams,
  GmxUserVaultImplementation,
} from '../../../src/utils/constructors/gmx';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';
import { BYTES_EMPTY } from 'src/utils/no-deps-constants';

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
  return createContractWithAbi<GLPIsolationModeTokenVaultV1>(
    GLPIsolationModeTokenVaultV1__factory.abi,
    GLPIsolationModeTokenVaultV1__factory.bytecode,
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

export async function createGmxRegistryV2(core: CoreProtocol): Promise<GmxRegistryV2> {
  const implementation = await createContractWithAbi<GmxRegistryV2>(
    GmxRegistryV2__factory.abi,
    GmxRegistryV2__factory.bytecode,
    [],
  );
  const proxy = await createContractWithAbi<RegistryProxy>(
    RegistryProxy__factory.abi,
    RegistryProxy__factory.bytecode,
    await getGmxRegistryV2ConstructorParams(core, implementation),
  );
  return GmxRegistryV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGmxV2IsolationModeTokenVaultV1(
  core: CoreProtocol,
): Promise<GmxV2IsolationModeTokenVaultV1> {
  return createContractWithAbi(
    GmxV2IsolationModeTokenVaultV1__factory.abi,
    GmxV2IsolationModeTokenVaultV1__factory.bytecode,
    [
      core.tokens.weth.address
    ],
  );
}

export async function createGmxV2IsolationModeVaultFactory(
  core: CoreProtocol,
  gmxRegistry: IGmxRegistryV2,
  debtMarketIds: BigNumberish[],
  collateralMarketIds: BigNumberish[],
  gmToken: IGmxMarketToken,
  userVaultImplementation: GmxV2IsolationModeTokenVaultV1,
): Promise<GmxV2IsolationModeVaultFactory> {
  return createContractWithAbi<GmxV2IsolationModeVaultFactory>(
    GmxV2IsolationModeVaultFactory__factory.abi,
    GmxV2IsolationModeVaultFactory__factory.bytecode,
    getGmxV2IsolationModeVaultFactoryConstructorParams(
      core,
      gmxRegistry,
      debtMarketIds,
      collateralMarketIds,
      gmToken,
      userVaultImplementation
    ),
  );
}

export async function createGmxV2IsolationModeUnwrapperTraderV2(
  core: CoreProtocol,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxRegistryV2 | GmxRegistryV2,
): Promise<GmxV2IsolationModeUnwrapperTraderV2> {
  return createContractWithAbi(
    GmxV2IsolationModeUnwrapperTraderV2__factory.abi,
    GmxV2IsolationModeUnwrapperTraderV2__factory.bytecode,
    getGmxV2IsolationModeUnwrapperTraderV2ConstructorParams(core, dGM, gmxRegistryV2),
  );
}

export async function createGmxV2IsolationModeWrapperTraderV2(
  core: CoreProtocol,
  dGM: IGmxV2IsolationModeVaultFactory | GmxV2IsolationModeVaultFactory,
  gmxRegistryV2: IGmxRegistryV2 | GmxRegistryV2,
): Promise<GmxV2IsolationModeWrapperTraderV2> {
  const implementation = await createContractWithAbi<GmxV2IsolationModeWrapperTraderV2>(
    GmxV2IsolationModeWrapperTraderV2__factory.abi,
    GmxV2IsolationModeWrapperTraderV2__factory.bytecode,
    []
  );
  const proxy = await createContractWithAbi<IsolationModeTraderProxy>(
    IsolationModeTraderProxy__factory.abi,
    IsolationModeTraderProxy__factory.bytecode,
    await getGmxV2IsolationModeWrapperTraderV2ConstructorParams(core, implementation, dGM, gmxRegistryV2),
  );
  return GmxV2IsolationModeWrapperTraderV2__factory.connect(proxy.address, core.hhUser1);
}

export async function createGmxV2MarketTokenPriceOracle(
  core: CoreProtocol,
  gmxRegistryV2: IGmxRegistryV2 | GmxRegistryV2,
): Promise<GmxV2MarketTokenPriceOracle> {
  return createContractWithAbi(
    GmxV2MarketTokenPriceOracle__factory.abi,
    GmxV2MarketTokenPriceOracle__factory.bytecode,
    getGmxV2MarketTokenPriceOracleConstructorParams(core, gmxRegistryV2),
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
    amountIn,
    minAmountOut,
    marketPath: [marketId1, marketId2],
    traderParams: [{
      trader: wrapper.address,
      traderType: 3,
      tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [accountNumber, executionFee]),
      makerAccountIndex: 0
    }],
    makerAccounts: [],
    userConfig: { deadline: '123123123123123', balanceCheckFlag: 3 },
  };
}
