import { BigNumberish } from 'ethers';
import { DolomiteNetwork } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import { DolomiteOwnerV1, DolomiteOwnerV1__factory, DolomiteOwnerV2, DolomiteOwnerV2__factory } from '../src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { getDolomiteOwnerConstructorParams } from '../src/admin';

export async function createDolomiteOwner(
  core: CoreProtocolType<DolomiteNetwork>,
  secondsTimeLocked: BigNumberish,
): Promise<DolomiteOwnerV1> {
  return createContractWithAbi(
    DolomiteOwnerV1__factory.abi,
    DolomiteOwnerV1__factory.bytecode,
    getDolomiteOwnerConstructorParams(core.gnosisSafe.address, secondsTimeLocked),
  );
}

export async function createDolomiteOwnerV2(
  core: CoreProtocolType<DolomiteNetwork>,
  secondsTimeLocked: BigNumberish,
): Promise<DolomiteOwnerV2> {
  return createContractWithAbi(
    DolomiteOwnerV2__factory.abi,
    DolomiteOwnerV2__factory.bytecode,
    getDolomiteOwnerConstructorParams(core.gnosisSafe.address, secondsTimeLocked),
  );
}
