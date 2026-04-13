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

  describe('#ownerSetSecondsTimeLocked', () => {
    it('should work normally', async () => {
      const newSecondsTimeLocked = 123;
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(
        newSecondsTimeLocked
      );
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(SECONDS_TIME_LOCKED);

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const result = await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'SecondsTimeLockedChanged', {
        _secondsTimeLocked: newSecondsTimeLocked,
      });
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(newSecondsTimeLocked);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsTimeLocked(123),
        `DolomiteOwnerV4: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetSecondsValid', () => {
    it('should work normally', async () => {
      const newSecondsValid = ONE_DAY_SECONDS * 5;
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(
        newSecondsValid
      );
      expect(await dolomiteOwner.secondsValid()).to.equal(SECONDS_VALID);

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const result = await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'SecondsValidChanged', {
        _secondsValid: newSecondsValid,
      });
      expect(await dolomiteOwner.secondsValid()).to.equal(newSecondsValid);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsValid(ONE_DAY_SECONDS * 5),
        `DolomiteOwnerV4: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRegisterCaller', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerRegisterCaller(
        OTHER_ADDRESS,
        [core.dolomiteMargin.address],
        ['0x12345678']
      );

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(OTHER_ADDRESS, core.dolomiteMargin.address, '0x12345678')
      ).to.be.true;
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerRegisterCaller(
          OTHER_ADDRESS,
          [core.dolomiteMargin.address],
          ['0x12345678']
        ),
        `DolomiteOwnerV4: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerUnregisterCaller', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        OTHER_ADDRESS,
        [core.dolomiteMargin.address],
        [BYTES4_OTHER_SELECTOR],
      );
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(OTHER_ADDRESS, core.dolomiteMargin.address, BYTES4_OTHER_SELECTOR)
      ).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.ownerUnregisterCaller(
        OTHER_ADDRESS,
        [core.dolomiteMargin.address],
        [BYTES4_OTHER_SELECTOR],
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      await expectThrow(
        dolomiteOwner.isUserApprovedToSubmitTransaction(OTHER_ADDRESS, core.dolomiteMargin.address, BYTES4_OTHER_SELECTOR),
        'DolomiteOwnerV4: Invalid caller'
      )
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerUnregisterCaller(
          OTHER_ADDRESS,
          [core.dolomiteMargin.address],
          [BYTES4_OTHER_SELECTOR],
        ),
        `DolomiteOwnerV4: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#submitTransaction', () => {
    it('should work normally for DEFAULT_ADMIN', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const result = await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(
        dolomiteOwner.address,
        transaction.data!,
      );
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
      expect(await dolomiteOwner.transactionCount()).to.equal(1);
      const txn = await dolomiteOwner.transactions(0);
      expect(txn.destination).to.equal(dolomiteOwner.address);
      expect(txn.executed).to.be.false;
      expect(txn.verified).to.be.false;
      expect(txn.cancelled).to.be.false;
    });

    it('should work normally for a registered caller', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        [core.dolomiteMargin.address],
        [BYTES4_OTHER_SELECTOR],
      );
      const result = await dolomiteOwner.connect(core.hhUser1).submitTransaction(
        core.dolomiteMargin.address,
        BYTES4_OTHER_SELECTOR,
      );
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
    });

    it('should fail if calldata length is less than 4 bytes', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteMargin.address, '0x123456'),
        'DolomiteOwnerV4: Invalid calldata length',
      );
    });

    it('should fail if caller is not approved', async () => {
      const transaction = await core.dolomiteMargin.populateTransaction.ownerSetIsClosing(0, true);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteMargin.address, transaction.data!),
        'DolomiteOwnerV4: Invalid caller',
      );
    });

    it('should fail if registered caller submits to self', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        [core.dolomiteMargin.address],
        [BYTES4_OTHER_SELECTOR],
      );
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(dolomiteOwner.address, transaction.data!),
        'DolomiteOwnerV4: Invalid destination',
      );
    });
  });
});
