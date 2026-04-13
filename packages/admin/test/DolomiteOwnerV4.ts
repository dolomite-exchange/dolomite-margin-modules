import { expect } from 'chai';
import { BytesLike } from 'ethers';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  Network,
  ONE_DAY_SECONDS,
} from 'packages/base/src/utils/no-deps-constants';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';

import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { DolomiteOwnerV2, DolomiteOwnerV4, DolomiteOwnerV4__factory } from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteOwnerV2 } from './admin-ecosystem-utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BAD_ROLE = '0x8888888888888888888888888888888888888888888888888888888888888888';
const BYTES4_OTHER_SELECTOR = '0x12345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;
const SECONDS_VALID = ONE_DAY_SECONDS * 3;

describe('DolomiteOwnerV4', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwnerV4;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let verifierRole: BytesLike;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    dolomiteOwner = await createContractWithAbi<DolomiteOwnerV4>(
      DolomiteOwnerV4__factory.abi,
      DolomiteOwnerV4__factory.bytecode,
      [core.gnosisSafe.address, SECONDS_TIME_LOCKED, SECONDS_VALID]
    );

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    verifierRole = await dolomiteOwner.VERIFIER_ROLE();

    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(SECONDS_TIME_LOCKED);
      expect(await dolomiteOwner.secondsValid()).to.equal(SECONDS_VALID);
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.gnosisSafe.address)).to.be.true;
    });
  });
});
