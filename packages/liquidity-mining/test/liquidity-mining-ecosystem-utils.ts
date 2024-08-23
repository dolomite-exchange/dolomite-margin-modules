import { getUpgradeableProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { BigNumberish, ethers } from 'ethers';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
} from '../../base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, NetworkType } from '../../base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolType } from '../../base/test/utils/setup';
import {
  getBuybackPoolConstructorParams,
  getExternalOARBConstructorParams,
  getExternalVesterDiscountCalculatorConstructorParams,
  getExternalVesterImplementationConstructorParams,
  getExternalVesterInitializationCalldata,
  getOARBConstructorParams,
  getRewardsDistributorConstructorParams,
  getVeExternalVesterImplementationConstructorParams,
  getVeExternalVesterInitializationCalldata,
  getVeFeeCalculatorConstructorParams,
  getVesterExploderConstructorParams,
  getVesterImplementationConstructorParams,
} from '../src/liquidity-mining-constructors';
import {
  BuybackPool,
  BuybackPool__factory,
  ExternalOARB,
  ExternalOARB__factory,
  ExternalVesterDiscountCalculatorV1,
  ExternalVesterDiscountCalculatorV1__factory,
  ExternalVesterImplementationV1,
  ExternalVesterImplementationV1__factory,
  IERC20,
  IVesterDiscountCalculator, IVeToken,
  MineralToken,
  MineralToken__factory,
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  TestExternalVesterImplementationV1,
  TestExternalVesterImplementationV1__factory,
  TestVeExternalVesterImplementationV1,
  TestVeExternalVesterImplementationV1__factory,
  TestVesterDiscountCalculator,
  TestVesterDiscountCalculator__factory,
  TestVesterImplementationV1,
  TestVesterImplementationV1__factory,
  TestVesterImplementationV2,
  TestVesterImplementationV2__factory, TestVeToken, TestVeToken__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  VeFeeCalculator,
  VeFeeCalculator__factory,
  VesterDiscountCalculatorV1,
  VesterDiscountCalculatorV1__factory,
  VesterExploder,
  VesterExploder__factory,
  VesterImplementationLibForV2,
  VesterImplementationLibForV2__factory,
  VotingEscrow,
  VotingEscrow__factory,
} from '../src/types';
import { CustomTestToken } from 'packages/base/src/types';

export async function createTestVesterV1Proxy(
  core: CoreProtocolArbitrumOne,
  oARB: OARB,
  baseUri: string,
): Promise<TestVesterImplementationV1> {
  const implementation = await createContractWithAbi<TestVesterImplementationV1>(
    TestVesterImplementationV1__factory.abi,
    TestVesterImplementationV1__factory.bytecode,
    getVesterImplementationConstructorParams(core, core.tokens.arb),
  );

  const bytes = ethers.utils.defaultAbiCoder.encode(['address', 'string'], [oARB.address, baseUri]);
  const calldata = await implementation.populateTransaction.initialize(bytes);

  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );

  return TestVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestVesterV2Proxy(
  core: CoreProtocolArbitrumOne,
  handler: SignerWithAddressWithSafety,
): Promise<TestVesterImplementationV2> {
  const library = await createContractWithAbi<VesterImplementationLibForV2>(
    VesterImplementationLibForV2__factory.abi,
    VesterImplementationLibForV2__factory.bytecode,
    [],
  );
  const implementation = await createContractWithLibrary<TestVesterImplementationV2>(
    'TestVesterImplementationV2',
    { VesterImplementationLibForV2: library.address },
    getVesterImplementationConstructorParams(core, core.tokens.arb),
  );

  const bytes = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address'],
    [handler.address, core.liquidityMiningEcosystem.oARB.oArb.address],
  );
  const calldata = await implementation.populateTransaction.initialize(bytes);

  const vesterProxy = core.liquidityMiningEcosystem.oARB.oArbVesterProxy;
  await vesterProxy.connect(core.governance).upgradeToAndCall(implementation.address, calldata.data!);

  return TestVesterImplementationV2__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createExternalOARB(
  owner: string | SignerWithAddressWithSafety,
  name: string,
  symbol: string,
): Promise<ExternalOARB> {
  return createContractWithAbi<ExternalOARB>(
    ExternalOARB__factory.abi,
    ExternalOARB__factory.bytecode,
    getExternalOARBConstructorParams(
      owner instanceof SignerWithAddressWithSafety ? owner.address : owner,
      name,
      symbol,
    ),
  );
}

export async function createTestVeToken(
  underlyingToken: IERC20,
): Promise<TestVeToken> {
  return createContractWithAbi<TestVeToken>(
    TestVeToken__factory.abi,
    TestVeToken__factory.bytecode,
    [underlyingToken.address],
  );
}

export async function createVesterDiscountCalculatorV1(): Promise<VesterDiscountCalculatorV1> {
  return createContractWithAbi<VesterDiscountCalculatorV1>(
    VesterDiscountCalculatorV1__factory.abi,
    VesterDiscountCalculatorV1__factory.bytecode,
    [],
  );
}

export async function createExternalVesterDiscountCalculatorV1(
  veToken: VotingEscrow | IVeToken,
): Promise<ExternalVesterDiscountCalculatorV1> {
  return createContractWithAbi<ExternalVesterDiscountCalculatorV1>(
    ExternalVesterDiscountCalculatorV1__factory.abi,
    ExternalVesterDiscountCalculatorV1__factory.bytecode,
    getExternalVesterDiscountCalculatorConstructorParams(veToken),
  );
}

export async function createExternalVesterV1Proxy<T extends NetworkType>(
  core: CoreProtocolType<T>,
  paymentToken: IERC20,
  pairToken: IERC20,
  rewardToken: IERC20,
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  owner: string | SignerWithAddressWithSafety,
  baseUri: string,
  name: string,
  symbol: string,
): Promise<ExternalVesterImplementationV1> {
  const implementation = await createContractWithAbi<ExternalVesterImplementationV1>(
    ExternalVesterImplementationV1__factory.abi,
    ExternalVesterImplementationV1__factory.bytecode,
    getExternalVesterImplementationConstructorParams(core, pairToken, paymentToken, rewardToken),
  );
  const calldata = await implementation.populateTransaction.initialize(
    getExternalVesterInitializationCalldata(discountCalculator, oToken, owner, baseUri, name, symbol),
  );
  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );
  return ExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestExternalVesterV1Proxy<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  paymentToken: IERC20,
  rewardToken: IERC20,
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  owner: string | SignerWithAddressWithSafety,
  baseUri: string,
  name: string,
  symbol: string,
): Promise<TestExternalVesterImplementationV1> {
  const safeDelegateCallLib = await createContractWithName('SafeDelegateCallLib', []);
  const implementation = await createContractWithLibrary<TestExternalVesterImplementationV1>(
    'TestExternalVesterImplementationV1',
    { SafeDelegateCallLib: safeDelegateCallLib.address },
    getExternalVesterImplementationConstructorParams(core, pairToken, paymentToken, rewardToken),
  );
  const calldata = await implementation.populateTransaction.initialize(
    getExternalVesterInitializationCalldata(discountCalculator, oToken, owner, baseUri, name, symbol),
  );
  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );
  return TestExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestVeExternalVesterV1Proxy<T extends NetworkType>(
  core: CoreProtocolType<T>,
  pairToken: IERC20,
  pairMarketId: BigNumberish,
  paymentToken: IERC20,
  paymentMarketId: BigNumberish,
  rewardToken: IERC20,
  rewardMarketId: BigNumberish,
  discountCalculator: IVesterDiscountCalculator,
  oToken: IERC20,
  baseUri: string,
  name: string,
  symbol: string,
): Promise<TestVeExternalVesterImplementationV1> {
  const safeDelegateCallLib = await createContractWithName('SafeDelegateCallLib', []);
  const implementation = await createContractWithLibrary<TestVeExternalVesterImplementationV1>(
    'TestVeExternalVesterImplementationV1',
    { SafeDelegateCallLib: safeDelegateCallLib.address },
    getVeExternalVesterImplementationConstructorParams(
      core,
      pairToken,
      pairMarketId,
      paymentToken,
      paymentMarketId,
      rewardToken,
      rewardMarketId,
    ),
  );
  const implementationCalldata = await implementation.populateTransaction.initialize(
    getVeExternalVesterInitializationCalldata(discountCalculator, oToken, baseUri, name, symbol),
  );
  const vesterProxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, implementationCalldata, core.dolomiteMargin),
  );
  return TestVeExternalVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestDiscountCalculator(): Promise<TestVesterDiscountCalculator> {
  return createContractWithAbi<TestVesterDiscountCalculator>(
    TestVesterDiscountCalculator__factory.abi,
    TestVesterDiscountCalculator__factory.bytecode,
    [],
  );
}

export async function createVesterExploder(
  core: CoreProtocolArbitrumOne,
  vester: TestVesterImplementationV2 | TestVesterImplementationV1 | UpgradeableProxy,
): Promise<VesterExploder> {
  return createContractWithAbi<VesterExploder>(
    VesterExploder__factory.abi,
    VesterExploder__factory.bytecode,
    getVesterExploderConstructorParams(core, vester),
  );
}

export async function createOARB(core: CoreProtocolArbitrumOne): Promise<OARB> {
  return createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, getOARBConstructorParams(core));
}

export async function createMineralToken(core: CoreProtocolArbitrumOne): Promise<MineralToken> {
  const implementation = await createContractWithAbi<MineralToken>(
    MineralToken__factory.abi,
    MineralToken__factory.bytecode,
    [core.dolomiteMargin.address],
  );
  const initializeCalldata = await implementation.populateTransaction.initialize();

  const proxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, initializeCalldata, core.dolomiteMargin),
  );

  return MineralToken__factory.connect(proxy.address, core.hhUser1);
}

export async function createRewardsDistributor(
  core: CoreProtocolArbitrumOne,
  oToken: IERC20,
  initialHandlers: string[],
): Promise<RewardsDistributor> {
  return createContractWithAbi<RewardsDistributor>(
    RewardsDistributor__factory.abi,
    RewardsDistributor__factory.bytecode,
    getRewardsDistributorConstructorParams(core, oToken, initialHandlers),
  );
}

export async function createVotingEscrow(
  core: CoreProtocolArbitrumOne,
  token: IERC20 | CustomTestToken,
  voter: string,
  feeCalculator: VeFeeCalculator,
  vester: string,
  buybackPool: string,
): Promise<VotingEscrow> {
  const implementation = await createContractWithAbi<VotingEscrow>(
    VotingEscrow__factory.abi,
    VotingEscrow__factory.bytecode,
    [],
  );
  const initializeCalldata = await implementation.populateTransaction.initialize(
    token.address,
    ADDRESS_ZERO,
    voter,
    feeCalculator.address,
    vester,
    buybackPool,
    core.governance.address
  );

  const proxy = await createContractWithAbi<UpgradeableProxy>(
    UpgradeableProxy__factory.abi,
    UpgradeableProxy__factory.bytecode,
    getUpgradeableProxyConstructorParams(implementation.address, initializeCalldata, core.dolomiteMargin),
  );
  return VotingEscrow__factory.connect(proxy.address, core.hhUser1);
}

export async function createVeFeeCalculator(
  core: CoreProtocolArbitrumOne
): Promise<VeFeeCalculator> {
  return createContractWithAbi<VeFeeCalculator>(
    VeFeeCalculator__factory.abi,
    VeFeeCalculator__factory.bytecode,
    getVeFeeCalculatorConstructorParams(core),
  );
}

export async function createBuybackPool(
  core: CoreProtocolArbitrumOne,
  rewardToken: CustomTestToken,
  paymentToken: IERC20,
): Promise<BuybackPool> {
  return createContractWithAbi<BuybackPool>(
    BuybackPool__factory.abi,
    BuybackPool__factory.bytecode,
    getBuybackPoolConstructorParams(core, rewardToken, paymentToken),
  );
}
