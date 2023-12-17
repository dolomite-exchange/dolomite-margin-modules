import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'ethers';
import {
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  TestVesterImplementationV1,
  TestVesterImplementationV1__factory,
  TestVesterImplementationV2,
  TestVesterImplementationV2__factory,
  VesterImplementationLibForV2,
  VesterImplementationLibForV2__factory,
  VesterProxy,
  VesterProxy__factory,
} from '../../../src/types';
import {
  getOARBConstructorParams,
  getRewardsDistributorConstructorParams,
  getVesterImplementationConstructorParams,
} from '../../../src/utils/constructors/liquidity-mining';
import { createContractWithAbi, createContractWithLibrary } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createTestVesterV1Proxy(
  core: CoreProtocol,
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

  const vesterProxy = await createContractWithAbi<VesterProxy>(
    VesterProxy__factory.abi,
    VesterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );

  return TestVesterImplementationV1__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createTestVesterV2Proxy(
  core: CoreProtocol,
  handler: SignerWithAddress,
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

  const bytes = ethers.utils.defaultAbiCoder.encode(['address'], [handler.address]);
  const calldata = await implementation.populateTransaction.initialize(bytes);

  const vesterProxy = core.liquidityMiningEcosystem!.oArbVesterProxy;
  await vesterProxy.connect(core.governance).upgradeToAndCall(
    implementation.address,
    calldata.data!,
  );

  return TestVesterImplementationV2__factory.connect(vesterProxy.address, core.hhUser1);
}

export async function createOARB(core: CoreProtocol): Promise<OARB> {
  return createContractWithAbi<OARB>(
    OARB__factory.abi,
    OARB__factory.bytecode,
    getOARBConstructorParams(core),
  );
}

export async function createRewardsDistributor(
  core: CoreProtocol,
  oARB: OARB,
  initialHandlers: string[],
): Promise<RewardsDistributor> {
  return createContractWithAbi<RewardsDistributor>(
    RewardsDistributor__factory.abi,
    RewardsDistributor__factory.bytecode,
    getRewardsDistributorConstructorParams(core, oARB, initialHandlers),
  );
}
