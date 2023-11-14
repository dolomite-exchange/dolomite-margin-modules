import {
  OARB,
  OARB__factory,
  RewardsDistributor,
  RewardsDistributor__factory,
  TestVesterImplementation,
  TestVesterImplementation__factory,
  VesterProxy,
  VesterProxy__factory,
} from '../../../src/types';
import {
  getOARBConstructorParams,
  getRewardsDistributorConstructorParams,
  getVesterImplementationConstructorParams,
} from '../../../src/utils/constructors/liquidity-mining';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createTestVesterProxy(
  core: CoreProtocol,
  oARB: OARB,
  baseUri: string,
): Promise<TestVesterImplementation> {
  const implementation = await createContractWithAbi<TestVesterImplementation>(
    TestVesterImplementation__factory.abi,
    TestVesterImplementation__factory.bytecode,
    getVesterImplementationConstructorParams(core),
  );

  const calldata = await implementation.populateTransaction.initialize(
    oARB.address,
    baseUri,
  );

  const vesterProxy = await createContractWithAbi<VesterProxy>(
    VesterProxy__factory.abi,
    VesterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );

  return TestVesterImplementation__factory.connect(vesterProxy.address, core.hhUser1);
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
