import { expect } from 'chai';
import { BytesLike } from 'ethers';
import {
  ADDRESS_ZERO,
  BYTES_ZERO,
  Network,
  ONE_DAY_SECONDS,
  ONE_WEEK_SECONDS,
} from 'packages/base/src/utils/no-deps-constants';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';

import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { DolomiteOwnerV3, DolomiteOwnerV3__factory } from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_SELECTOR = '0x12345678';
const OTHER_ROLE = '0x1234567800000000000000001234567812345678123456781234567812345678';

const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;
const SECONDS_VALID = ONE_DAY_SECONDS * 3;

describe('DolomiteOwnerV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwnerV3;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let verifierRole: BytesLike;
  let computedRole: any;
  let setMaxWeiRole: any;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    dolomiteOwner = await createContractWithAbi<DolomiteOwnerV3>(
      DolomiteOwnerV3__factory.abi,
      DolomiteOwnerV3__factory.bytecode,
      [core.gnosisSafe.address, SECONDS_TIME_LOCKED, SECONDS_VALID]
    );
    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    verifierRole = await dolomiteOwner.VERIFIER_ROLE();

    computedRole = [{ destination: OTHER_ADDRESS, selector: OTHER_SELECTOR }];
    setMaxWeiRole = [{ destination: core.dolomiteMargin.address, selector: core.dolomiteMargin.interface.getSighash('ownerSetMaxWei') }];

    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

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

    it('should fail if 0', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsTimeLocked(0),
        'DolomiteOwnerV3: Invalid timelock',
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsTimeLocked(123),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetSecondsValid', () => {
    it('should work normally', async () => {
      const newSecondsValid = ONE_DAY_SECONDS;
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

    it('should fail if less than 5 minutes or greater than 1 week', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsValid(299),
        'DolomiteOwnerV3: Invalid validation window',
      );
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsValid(ONE_WEEK_SECONDS + 1),
        'DolomiteOwnerV3: Invalid validation window',
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsValid(ONE_DAY_SECONDS),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRegisterCaller', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerRegisterCaller(
        core.hhUser1.address,
        computedRole
      );

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const allAddreses = await dolomiteOwner.getAllAddressesWithRoles();
      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(OTHER_ROLE);
      const computedRoles = await dolomiteOwner.getComputedAddressRoles(core.hhUser1.address);

      expect(await dolomiteOwner.isUserApprovedToSubmitTransaction(
        core.hhUser1.address,
        OTHER_ADDRESS,
        OTHER_SELECTOR
      )).to.be.true;
      expect(allAddreses.length).to.eq(2);
      expect(allAddreses).to.contain(core.hhUser1.address);
      expect(allAddreses).to.contain(core.gnosisSafe.address);
      expect(userRoles.length).to.eq(1);
      expect(userRoles).to.contain(OTHER_ROLE);
      expect(roleAddresses.length).to.eq(1);
      expect(roleAddresses).to.contain(core.hhUser1.address);
      expect(computedRoles.length).to.eq(1);
      expect(computedRoles[0].selector).to.eq(OTHER_SELECTOR);
      expect(computedRoles[0].destination).to.eq(OTHER_ADDRESS);
    });

    it('should fail if no roles', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
          OTHER_ADDRESS,
          []
        ),
        'DolomiteOwnerV3: Invalid roles'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerRegisterCaller(
          OTHER_ADDRESS,
          computedRole
        ),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerUnregisterCaller', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        computedRole
      );

      const transaction = await dolomiteOwner.populateTransaction.ownerUnregisterCaller(core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const allAddreses = await dolomiteOwner.getAllAddressesWithRoles();
      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(OTHER_ROLE);
      const computedRoles = await dolomiteOwner.getComputedAddressRoles(core.hhUser1.address);

      expect(await dolomiteOwner.isUserApprovedToSubmitTransaction(
        core.hhUser1.address,
        OTHER_ADDRESS,
        OTHER_SELECTOR
      )).to.be.false;
      expect(allAddreses.length).to.eq(1);
      expect(allAddreses).to.contain(core.gnosisSafe.address);
      expect(userRoles.length).to.eq(0);
      expect(roleAddresses.length).to.eq(0);
      expect(computedRoles.length).to.eq(0);
    });

    it('should fail if caller has default admin role', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerUnregisterCaller(core.gnosisSafe.address),
        'DolomiteOwnerV3: Cannot renounce ownership'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerUnregisterCaller(
          core.hhUser1.address,
        ),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#grantRole', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.grantRole(
        bypassTimelockRole,
        core.hhUser1.address
      );

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const allAddresses = await dolomiteOwner.getAllAddressesWithRoles();
      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(bypassTimelockRole);

      expect(await dolomiteOwner.hasRole(bypassTimelockRole, core.hhUser1.address)).to.be.true;
      expect(allAddresses.length).to.eq(2);
      expect(allAddresses).to.contain(core.hhUser1.address);
      expect(allAddresses).to.contain(core.gnosisSafe.address);
      expect(userRoles.length).to.eq(1);
      expect(userRoles).to.contain(bypassTimelockRole);
      expect(roleAddresses.length).to.eq(1);
      expect(roleAddresses).to.contain(core.hhUser1.address);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).grantRole(bypassTimelockRole, core.hhUser1.address),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokeRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(bypassTimelockRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(
        bypassTimelockRole,
        core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const allAddresses = await dolomiteOwner.getAllAddressesWithRoles();
      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(bypassTimelockRole);

      expect(await dolomiteOwner.hasRole(bypassTimelockRole, core.hhUser1.address)).to.be.false;
      expect(allAddresses.length).to.eq(1);
      expect(allAddresses).to.contain(core.gnosisSafe.address);
      expect(userRoles.length).to.eq(0);
      expect(roleAddresses.length).to.eq(0);
    });

    it('should work normally to revoke default admin role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(BYTES_ZERO, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(BYTES_ZERO, core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(BYTES_ZERO);

      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.hhUser1.address)).to.be.false;
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.gnosisSafe.address)).to.be.true;
      expect(userRoles.length).to.eq(0);
      expect(roleAddresses.length).to.eq(1);
      expect(roleAddresses).to.contain(core.gnosisSafe.address);
    });

    it('should fail if no other default admins', async () => {
      const transaction = await dolomiteOwner.populateTransaction.revokeRole(BYTES_ZERO, core.gnosisSafe.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Cannot renounce ownership',
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).revokeRole(bypassTimelockRole, core.hhUser1.address),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#renounceRole', () => {
    it('should revert', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).renounceRole(bypassTimelockRole, core.hhUser1.address),
        'Not implemented',
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
        computedRole
      );
      const result = await dolomiteOwner.connect(core.hhUser1).submitTransaction(
        OTHER_ADDRESS,
        OTHER_SELECTOR,
      );
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
    });

    it('should fail if address zero', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).submitTransaction(ADDRESS_ZERO, '0x12345678'),
        'DolomiteOwnerV3: Address is null',
      );
    });

    it('should fail if calldata length is less than 4 bytes', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteMargin.address, '0x123456'),
        'DolomiteOwnerV3: Invalid calldata length',
      );
    });

    it('should fail if caller is not approved', async () => {
      const transaction = await core.dolomiteMargin.populateTransaction.ownerSetIsClosing(0, true);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteMargin.address, transaction.data!),
        'DolomiteOwnerV3: Transaction not approved',
      );
    });

    it('should fail if registered caller submits to self', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        computedRole
      );
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(dolomiteOwner.address, transaction.data!),
        'DolomiteOwnerV3: Invalid destination',
      );
    });
  });

  describe('#submitTransactions', () => {
    it('should work normally', async () => {
      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      const result = await dolomiteOwner.connect(core.gnosisSafe).submitTransactions([
        { destination: dolomiteOwner.address, data: transaction1.data! },
        { destination: dolomiteOwner.address, data: transaction2.data! },
      ]);
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 1 });
      expect(await dolomiteOwner.transactionCount()).to.equal(2);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.destination).to.equal(dolomiteOwner.address);
      expect(txn1.executed).to.be.false;
      expect(txn1.verified).to.be.false;
      expect(txn1.cancelled).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.destination).to.equal(dolomiteOwner.address);
      expect(txn2.executed).to.be.false;
      expect(txn2.verified).to.be.false;
      expect(txn2.cancelled).to.be.false;
    });
  });

  describe('#verifyTransaction', () => {
    it('should work normally for default admin', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionVerified', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.verified).to.be.true;
      expect(txn.executed).to.be.false;
      expect(txn.cancelled).to.be.false;
    });

    it('should work normally for verifier', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(verifierRole, core.hhUser1.address);

      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.hhUser1).verifyTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionVerified', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.verified).to.be.true;
    });

    it('should work normally before timelock', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      expect(await dolomiteOwner.isTimelockComplete(0)).to.be.false;
      const result = await dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionVerified', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.verified).to.be.true;
    });

    it('should work normally past timelock', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);

      expect(await dolomiteOwner.isTimelockComplete(0)).to.be.true;
      const result = await dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionVerified', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.verified).to.be.true;
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0),
        'DolomiteOwnerV3: Transaction does not exist',
      );
    });

    it('should fail if transaction is expired', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED + SECONDS_VALID);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0),
        'DolomiteOwnerV3: Transaction expired',
      );
    });

    it('should fail if transaction is already verified', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0),
        'DolomiteOwnerV3: Transaction not verifiable',
      );
    });

    it('should fail if transaction is executed', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0),
        'DolomiteOwnerV3: Transaction not verifiable',
      );
    });

    it('should fail if transaction is cancelled', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0),
        'DolomiteOwnerV3: Transaction not verifiable',
      );
    });

    it('should fail if not called by default admin or verifier role', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).verifyTransaction(0),
        'DolomiteOwnerV3: Missing role',
      );
    });
  });

  describe('#verifyTransactions', () => {
    it('should work normally', async () => {
      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction1.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction2.data!);

      await dolomiteOwner.connect(core.gnosisSafe).verifyTransactions([0, 1]);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.verified).to.be.true;
      expect(txn1.executed).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.verified).to.be.true;
      expect(txn2.executed).to.be.false;
    });

    it('should fail if not default admin or verifier role', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).verifyTransactions([0, 1]),
        'DolomiteOwnerV3: Missing role',
      );
    });
  });

  describe('#executeTransaction', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).verifyTransaction(0);
      await increase(SECONDS_TIME_LOCKED);

      const result = await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionExecuted', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.executed).to.be.true;
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(123);
    });

    it('should work normally if executor can bypass timelock', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(verifierRole, core.hhUser2.address);

      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      const result = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionExecuted', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.executed).to.be.true;
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(123);
    });

    it('should work normally if there are no verifiers', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);

      const result = await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionExecuted', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.executed).to.be.true;
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(123);
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Transaction does not exist',
      );
    });

    it('should fail if not past timelock', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Timelock incomplete',
      );
    });

    it('should fail if expired', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED + SECONDS_VALID);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Transaction expired',
      );
    });

    it('should fail if transaction is cancelled', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0);
      await increase(SECONDS_TIME_LOCKED);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Transaction not executable <0>',
      );
    });

    it('should fail if transaction is already executed', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Transaction not executable <0>',
      );
    });

    it('should fail if there is a verifier and the transaction is not verified', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(verifierRole, core.hhUser1.address);

      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Transaction not verified <0>',
      );
    });

    it('should fail if not called by default admin or executor', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).executeTransaction(0),
        'DolomiteOwnerV3: Missing role',
      );
    });
  });

  describe('#executeTransactions', () => {
    it('should work normally', async () => {
      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction1.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction2.data!);
      await increase(SECONDS_TIME_LOCKED);

      await dolomiteOwner.connect(core.gnosisSafe).executeTransactions([0, 1]);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.executed).to.be.true;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.executed).to.be.true;

      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(123);
      expect(await dolomiteOwner.secondsValid()).to.equal(ONE_DAY_SECONDS * 5);
    });

    it('should fail if not called by default admin or executor', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).executeTransactions([0, 1]),
        'DolomiteOwnerV3: Missing role',
      );
    });
  });

  describe('#submitTransactionAndExecute', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(core.hhUser1.address, setMaxWeiRole);

      const transaction = await core.dolomiteMargin.populateTransaction.ownerSetMaxWei(0, 1000);
      const result = await dolomiteOwner.connect(core.hhUser1).submitTransactionAndExecute(
        core.dolomiteMargin.address,
        transaction.data!,
      );
      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
      await expectEvent(dolomiteOwner, result, 'TransactionExecuted', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.executed).to.be.true;
      expect((await core.dolomiteMargin.getMarketMaxWei(0)).value).to.eq(1000);
    });
  });

  describe('#ownerCancelTransaction', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionCancelled', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.cancelled).to.be.true;
      expect(txn.executed).to.be.false;
    });

    it('should fail if the transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0),
        'DolomiteOwnerV3: Transaction does not exist',
      );
    });

    it('should fail if transaction is already cancelled', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0),
        'DolomiteOwnerV3: Transaction not cancellable',
      );
    });

    it('should fail if transaction is already executed', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransaction(0),
        'DolomiteOwnerV3: Transaction not cancellable',
      );
    });

    it('should fail if not called by default admin', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerCancelTransaction(0),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerCancelTransactions', () => {
    it('should work normally', async () => {
      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction1.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction2.data!);

      await dolomiteOwner.connect(core.gnosisSafe).ownerCancelTransactions([0, 1]);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.cancelled).to.be.true;
      expect(txn1.executed).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.cancelled).to.be.true;
      expect(txn2.executed).to.be.false;
    });

    it('should fail if not called by default admin', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerCancelTransactions([0, 1]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#getTransactionCount', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.connect(core.gnosisSafe).verifyTransactions([0, 1]);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
    });

    it('should work normally for pending + verified + executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(true, true, true)).to.eq(4);
    });

    it('should work normally for pending + verified transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(true, true, false)).to.eq(3);
    });

    it('should work normally for pending transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(true, false, false)).to.eq(3);
    });

    it('should work normally for executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(false, false, true)).to.eq(1);
    });

    it('should work normally for neither pending nor executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(false, false, false)).to.eq(0);
    });
  });

  describe('#getTransactionIds', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.connect(core.gnosisSafe).verifyTransactions([0, 1]);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
    });

    it('should work normally for pending + executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 4, true, true, true);
      expect(ids.length).to.eq(4);
      expect(ids[0]).to.eq(0);
      expect(ids[1]).to.eq(1);
      expect(ids[2]).to.eq(2);
      expect(ids[3]).to.eq(3);
    });

    it('should work normally for pending transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 4, true, false, false);
      expect(ids.length).to.eq(3);
      expect(ids[0]).to.eq(1);
      expect(ids[1]).to.eq(2);
      expect(ids[2]).to.eq(3);
    });

    it('should work normally for verified transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 4, false, true, false);
      expect(ids.length).to.eq(1);
      expect(ids[0]).to.eq(1);
    });

    it('should work normally for executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 3, false, false, true);
      expect(ids.length).to.eq(1);
      expect(ids[0]).to.eq(0);
    });

    it('should work normally for neither pending nor executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 4, false, false, false);
      expect(ids.length).to.eq(0);
    });

    it('should work if to is greater than transaction count', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 5, true, true, true);
      expect(ids.length).to.eq(4);
      expect(ids[0]).to.eq(0);
      expect(ids[1]).to.eq(1);
      expect(ids[2]).to.eq(2);
      expect(ids[3]).to.eq(3);
    });
  });
});
