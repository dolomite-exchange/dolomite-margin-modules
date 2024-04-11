import { getUpgradeableProxyConstructorParams } from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ethers } from 'ethers';
import { createContractWithAbi, createContractWithLibrary } from '../../base/src/utils/dolomite-utils';
import {
  getOARBConstructorParams,
  getRewardsDistributorConstructorParams,
  getVesterExploderConstructorParams,
  getVesterImplementationConstructorParams,
} from '../src/liquidity-mining-constructors';
import {
  IERC20,
  MineralToken,
  MineralToken__factory,
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  TestVesterImplementationV1,
  TestVesterImplementationV1__factory,
  TestVesterImplementationV2,
  TestVesterImplementationV2__factory,
  UpgradeableProxy,
  UpgradeableProxy__factory,
  VesterExploder,
  VesterExploder__factory,
  VesterImplementationLibForV2,
  VesterImplementationLibForV2__factory,
} from '../src/types';

export async function createTestVesterV1Proxy(
  core: CoreProtocolArbitrumOne,
  oARB: OARB,
  baseUri: string,
): Promise<TestVesterImplementationV1> {
  const implementation = await createContractWithAbi<TestVesterImplementationV1>(
    TestVesterImplementationV1__factory.abi,
    TestVesterImplementationV1__factory.bytecode,
    getVesterImplementationConstructorParams(core),
  );

  const bytes = ethers.utils.defaultAbiCoder.encode(
    ['address', 'string'],
    [oARB.address, baseUri],
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
  const implementation = await createContractWithLibrary<TestVesterImplementationV2>(
    'TestVesterImplementationV2',
    { VesterImplementationLibForV2: library.address },
    getVesterImplementationConstructorParams(core),
  );

  const bytes = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address'],
    [handler.address, core.liquidityMiningEcosystem.oArb.address],
  );
  const calldata = await implementation.populateTransaction.initialize(bytes);

  const vesterProxy = core.liquidityMiningEcosystem!.oArbVesterProxy;
  await vesterProxy.connect(core.governance).upgradeToAndCall(
    implementation.address,
    calldata.data!,
  );

  return TestVesterImplementationV2__factory.connect(vesterProxy.address, core.hhUser1);
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
  return createContractWithAbi<OARB>(
    OARB__factory.abi,
    OARB__factory.bytecode,
    getOARBConstructorParams(core),
  );
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
    getUpgradeableProxyConstructorParams(implementation.address, initializeCalldata.data!, core.dolomiteMargin),
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
