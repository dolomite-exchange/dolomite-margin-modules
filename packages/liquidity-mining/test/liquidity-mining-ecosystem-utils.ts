import { getUpgradeableProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { ethers } from 'ethers';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
} from '../../base/src/utils/dolomite-utils';
import { DolomiteNetwork } from '../../base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolType } from '../../base/test/utils/setup';
import {
  getExternalOARBConstructorParams,
  getExternalVesterImplementationConstructorParams,
  getExternalVesterInitializationCalldata,
  getOARBConstructorParams,
  getRewardsDistributorConstructorParams,
  getVesterExploderConstructorParams,
  getVesterImplementationConstructorParams,
} from '../src/liquidity-mining-constructors';
import {
  ExternalOARB,
  ExternalOARB__factory,
  ExternalVesterImplementationV1,
  ExternalVesterImplementationV1__factory,
  IERC20,
  IVesterDiscountCalculator,
  MineralToken,
  MineralToken__factory,
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  TestExternalVesterImplementationV1,
  TestExternalVesterImplementationV1__factory,
  TestVesterDiscountCalculator,
  TestVesterDiscountCalculator__factory,
  TestVesterImplementationV1,
  TestVesterImplementationV1__factory,
  TestVesterImplementationV2,
  TestVesterImplementationV2__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  VesterDiscountCalculatorV1,
  VesterDiscountCalculatorV1__factory,
  VesterExploder,
  VesterExploder__factory,
  VesterImplementationLibForV2,
  VesterImplementationLibForV2__factory,
} from '../src/types';
import { createSafeDelegateLibrary } from 'packages/base/test/utils/ecosystem-utils/general';

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

  const bytes = ethers.utils.defaultAbiCoder.encode(
    ['address', 'string', 'string', 'string'],
    [oARB.address, baseUri, 'oARB', 'OARB'],
  );
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
  const safeDelegateCallLib = await createSafeDelegateLibrary();
  const implementation = await createContractWithLibrary<TestVesterImplementationV2>(
    'TestVesterImplementationV2',
    { VesterImplementationLibForV2: library.address, SafeDelegateCallLib: safeDelegateCallLib.address },
    getVesterImplementationConstructorParams(core, core.tokens.arb),
  );

  const bytes = ethers.utils.defaultAbiCoder.encode(
    ['address'],
    [handler.address],
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

export async function createVesterDiscountCalculatorV1(): Promise<VesterDiscountCalculatorV1> {
  return createContractWithAbi<VesterDiscountCalculatorV1>(
    VesterDiscountCalculatorV1__factory.abi,
    VesterDiscountCalculatorV1__factory.bytecode,
    [],
  );
}

export async function createExternalVesterV1Proxy<T extends DolomiteNetwork>(
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

export async function createTestExternalVesterV1Proxy<T extends DolomiteNetwork>(
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
