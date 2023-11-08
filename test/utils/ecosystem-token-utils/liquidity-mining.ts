import {
  OARB,
  TestVesterImplementation,
  TestVesterImplementation__factory,
  VesterProxy,
  VesterProxy__factory,
} from '../../../src/types';
import { getVesterImplementationConstructorParams } from '../../../src/utils/constructors/liquidity-mining';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createTestVesterProxy(core: CoreProtocol, oARB: OARB): Promise<TestVesterImplementation> {
  const implementation = await createContractWithAbi<TestVesterImplementation>(
    TestVesterImplementation__factory.abi,
    TestVesterImplementation__factory.bytecode,
    getVesterImplementationConstructorParams(core),
  );

  const calldata = await implementation.populateTransaction.initialize(
    oARB.address,
  );

  const vesterProxy = await createContractWithAbi<VesterProxy>(
    VesterProxy__factory.abi,
    VesterProxy__factory.bytecode,
    [implementation.address, core.dolomiteMargin.address, calldata.data!],
  );

  return TestVesterImplementation__factory.connect(vesterProxy.address, core.hhUser1);
}
