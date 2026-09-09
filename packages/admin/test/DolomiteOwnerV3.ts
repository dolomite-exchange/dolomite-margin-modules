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
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ethers } from 'hardhat';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_SELECTOR = '0x12345678';
const OTHER_ROLE = '0x1234567800000000000000001234567812345678123456781234567812345678';

const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;
const SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED = ONE_DAY_SECONDS * 30;
const SECONDS_VALID = ONE_DAY_SECONDS * 3;

describe('DolomiteOwnerV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwnerV3;

  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let vetoRole: BytesLike;
  let computedRole: any;
  let setMaxWeiRole: any;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 494_143_000,
    });

    dolomiteOwner = await createContractWithAbi<DolomiteOwnerV3>(
      DolomiteOwnerV3__factory.abi,
      DolomiteOwnerV3__factory.bytecode,
      [
        core.gnosisSafe.address,
        SECONDS_TIME_LOCKED,
        SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED,
        SECONDS_VALID,
      ]
    );
    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);

    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    vetoRole = await dolomiteOwner.VETO_ROLE();

    computedRole = [{ role: BYTES_ZERO, destination: OTHER_ADDRESS, selector: OTHER_SELECTOR }];
    setMaxWeiRole = [{
      role: BYTES_ZERO,
      destination: core.dolomiteMargin.address,
      selector: core.dolomiteMargin.interface.getSighash('ownerSetMaxWei')
    }];

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
      expect(await dolomiteOwner.secondsForceRevokeVetoTimeLocked()).to.equal(SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED);
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

    it('should fail if less than 60 or greater than 2 weeks', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsTimeLocked(59),
        'DolomiteOwnerV3: Invalid timelock',
      );
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsTimeLocked(ONE_WEEK_SECONDS * 2 + 1),
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

  describe('#ownerSetSecondsForceRevokeVetoTimeLocked', () => {
    it('should work normally', async () => {
      const newSecondsForceRevokeVetoTimeLocked = ONE_DAY_SECONDS * 15;
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsForceRevokeVetoTimeLocked(
        newSecondsForceRevokeVetoTimeLocked,
      );

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const result = await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'SecondsForceRevokeVetoTimeLockedChanged', {
        _secondsForceRevokeVetoTimeLocked: newSecondsForceRevokeVetoTimeLocked,
      });
      expect(await dolomiteOwner.secondsForceRevokeVetoTimeLocked()).to.equal(newSecondsForceRevokeVetoTimeLocked);
    });

    it('should fail if less than 14 days or greater than 90 days', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsForceRevokeVetoTimeLocked(
          14 * ONE_DAY_SECONDS - 1
        ),
        'DolomiteOwnerV3: Invalid force veto timelock',
      );
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsForceRevokeVetoTimeLocked(
          90 * ONE_DAY_SECONDS + 1
        ),
        'DolomiteOwnerV3: Invalid force veto timelock',
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsForceRevokeVetoTimeLocked(123),
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

    it('should fail if less than 1 day or greater than 2 weeks', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsValid(ONE_DAY_SECONDS - 1),
        'DolomiteOwnerV3: Invalid validation window',
      );
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerSetSecondsValid(2 * ONE_WEEK_SECONDS + 1),
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

  describe('#ownerTransferDefaultAdmin', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerTransferDefaultAdmin(
        core.hhUser1.address
      );

      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.hhUser1.address)).to.be.true;
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.gnosisSafe.address)).to.be.false;
    });

    it('should fail if new admin has another role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      const transaction = await dolomiteOwner.populateTransaction.ownerTransferDefaultAdmin(
        core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Admin can only have 1 role'
      );
    });

    it('should fail if new admin is not a contract', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerTransferDefaultAdmin(
        '0xFea25018168D8D0A1228c8FAf9EF622d3DeC51c1'
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Admin must be a contract'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerTransferDefaultAdmin(core.hhUser1.address),
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

    it('should fail if attempting default admin', async () => {
      const zeroRole = [{ role: BYTES_ZERO, destination: ZERO_ADDRESS, selector: '0x00000000' }];
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
          OTHER_ADDRESS,
          zeroRole
        ),
        'DolomiteOwnerV3: Invalid computed role'
      );
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
    it('should work normally with no service roles', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        computedRole
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        bypassTimelockRole,
        core.hhUser1.address
      );

      const transaction = await dolomiteOwner.populateTransaction.ownerUnregisterCaller(core.hhUser1.address, false);
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
      expect(allAddreses.length).to.eq(2);
      expect(allAddreses).to.contain(core.gnosisSafe.address);
      expect(allAddreses).to.contain(core.hhUser1.address);
      expect(userRoles.length).to.eq(1);
      expect(userRoles).to.contain(bypassTimelockRole);
      expect(roleAddresses.length).to.eq(0);
      expect(computedRoles.length).to.eq(1);
    });

    it('should work normally with service roles', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRegisterCaller(
        core.hhUser1.address,
        computedRole
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        executorRole,
        core.hhUser1.address
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        bypassTimelockRole,
        core.hhUser1.address
      );

      const transaction = await dolomiteOwner.populateTransaction.ownerUnregisterCaller(core.hhUser1.address, true);
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
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerUnregisterCaller(core.gnosisSafe.address, false),
        'DolomiteOwnerV3: Cannot remove protected roles'
      );
    });

    it('should fail if caller has veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        vetoRole,
        core.hhUser1.address
      );
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerUnregisterCaller(core.hhUser1.address, false),
        'DolomiteOwnerV3: Cannot remove protected roles'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerUnregisterCaller(
          core.hhUser1.address,
          false
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

    it('should fail if zero address', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, ADDRESS_ZERO),
        'DolomiteOwnerV3: Invalid address',
      );
    });

    it('should fail if address(this)', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, dolomiteOwner.address),
        'DolomiteOwnerV3: Invalid address',
      );
    });

    it('should fail if granting other role to default admin', async () => {
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.gnosisSafe.address)).to.be.true;

      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.gnosisSafe.address),
        'DolomiteOwnerV3: Admin can only have 1 role',
      );
    });

    it('should fail if granting default admin', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(BYTES_ZERO, core.gnosisSafe.address),
        'DolomiteOwnerV3: Invalid grantRole usage',
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).grantRole(bypassTimelockRole, core.hhUser1.address),
        `DolomiteOwnerV3: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokeRole', () => {
    it('should work normally if user has 1 role', async () => {
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

    it('should work normally if user has multiple roles', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(bypassTimelockRole, core.hhUser1.address)).to.be.true;
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(
        bypassTimelockRole,
        core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const allAddresses = await dolomiteOwner.getAllAddressesWithRoles();
      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const bypassAddresses = await dolomiteOwner.getRoleAddresses(bypassTimelockRole);
      const vetoAddresses = await dolomiteOwner.getRoleAddresses(vetoRole);

      expect(await dolomiteOwner.hasRole(bypassTimelockRole, core.hhUser1.address)).to.be.false;
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;
      expect(allAddresses.length).to.eq(2);
      expect(allAddresses).to.contain(core.gnosisSafe.address);
      expect(allAddresses).to.contain(core.hhUser1.address);
      expect(userRoles.length).to.eq(1);
      expect(userRoles).to.contain(vetoRole);
      expect(bypassAddresses.length).to.eq(0);
      expect(vetoAddresses.length).to.eq(1);
      expect(vetoAddresses).to.contain(core.hhUser1.address);
    });

    it('should work normally with veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(vetoRole, core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(vetoRole);

      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.false;
      expect(userRoles.length).to.eq(0);
      expect(roleAddresses.length).to.eq(0);
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

  describe('#forceRevokeVetoRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.forceRevokeVetoRole(core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      const userRoles = await dolomiteOwner.getAddressRoles(core.hhUser1.address);
      const roleAddresses = await dolomiteOwner.getRoleAddresses(vetoRole);

      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.false;
      expect(userRoles.length).to.eq(0);
      expect(roleAddresses.length).to.eq(0);
    });

    it('should fail if not past timelock', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.forceRevokeVetoRole(core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0),
        'DolomiteOwnerV3: Force revoke timelock incomplete'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).forceRevokeVetoRole(core.hhUser1.address),
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

    it('should work normally for revoke veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(vetoRole, core.hhUser1.address);
      const result = await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(
        dolomiteOwner.address,
        transaction.data!
      );
      const receipt = await result.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
      expect(await dolomiteOwner.transactionCount()).to.equal(1);
      const txn = await dolomiteOwner.transactions(0);
      expect(txn.destination).to.equal(dolomiteOwner.address);
      expect(txn.lockedUntil).to.eq(block.timestamp + SECONDS_TIME_LOCKED);
      expect(txn.validUntil).to.eq(txn.lockedUntil + SECONDS_VALID);
      expect(txn.executed).to.be.false;
      expect(txn.cancelled).to.be.false;
    });

    it('should work normally for force revoke veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.forceRevokeVetoRole(core.hhUser1.address);
      const result = await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(
        dolomiteOwner.address,
        transaction.data!
      );
      const receipt = await result.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expectEvent(dolomiteOwner, result, 'TransactionSubmitted', { transactionId: 0 });
      expect(await dolomiteOwner.transactionCount()).to.equal(1);
      const txn = await dolomiteOwner.transactions(0);
      expect(txn.destination).to.equal(dolomiteOwner.address);
      expect(txn.lockedUntil).to.eq(block.timestamp + SECONDS_FORCE_REVOKE_VETO_TIME_LOCKED);
      expect(txn.validUntil).to.eq(txn.lockedUntil + ONE_WEEK_SECONDS * 2);
      expect(txn.executed).to.be.false;
      expect(txn.cancelled).to.be.false;
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
      expect(txn1.cancelled).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.destination).to.equal(dolomiteOwner.address);
      expect(txn2.executed).to.be.false;
      expect(txn2.cancelled).to.be.false;
    });
  });

  describe('#executeTransaction', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
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

      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      const result = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
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
      await dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0);
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

  describe('#cancelTransaction', () => {
    it('should work normally when called by default admin', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionCancelled', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.cancelled).to.be.true;
      expect(txn.executed).to.be.false;
    });

    it('should work normally when called by veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser3.address);

      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.hhUser3).cancelTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionCancelled', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.cancelled).to.be.true;
      expect(txn.executed).to.be.false;
    });

    it('should work normally when default admin cancels force revoke veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.forceRevokeVetoRole(core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionCancelled', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.cancelled).to.be.true;
      expect(txn.executed).to.be.false;
    });

    it('should work normally when default admin cancels revoke veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(vetoRole, core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      const result = await dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0);
      await expectEvent(dolomiteOwner, result, 'TransactionCancelled', { transactionId: 0 });

      const txn = await dolomiteOwner.transactions(0);
      expect(txn.cancelled).to.be.true;
      expect(txn.executed).to.be.false;
    });

    it('should fail if vetoer tries to cancel own revoke veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.revokeRole(vetoRole, core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).cancelTransaction(0),
        'DolomiteOwnerV3: Cannot veto own revoke',
      );
    });

    it('should fail if force revoke veto and not default admin', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(vetoRole, core.hhUser1.address)).to.be.true;

      const transaction = await dolomiteOwner.populateTransaction.forceRevokeVetoRole(core.hhUser1.address);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).cancelTransaction(0),
        'DolomiteOwnerV3: Only admin can cancel frc revoke',
      );
    });

    it('should fail if the transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0),
        'DolomiteOwnerV3: Transaction does not exist',
      );
    });

    it('should fail if transaction is already cancelled', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0),
        'DolomiteOwnerV3: Transaction not cancellable',
      );
    });

    it('should fail if transaction is already executed', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);

      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).cancelTransaction(0),
        'DolomiteOwnerV3: Transaction not cancellable',
      );
    });

    it('should fail if not called by default admin or veto role', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).cancelTransaction(0),
        'DolomiteOwnerV3: Missing role'
      );
    });
  });

  describe('#cancelTransactions', () => {
    it('should work normally for default admin', async () => {
      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction1.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction2.data!);

      await dolomiteOwner.connect(core.gnosisSafe).cancelTransactions([0, 1]);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.cancelled).to.be.true;
      expect(txn1.executed).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.cancelled).to.be.true;
      expect(txn2.executed).to.be.false;
    });

    it('should work normally for veto role', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(vetoRole, core.hhUser3.address);

      const transaction1 = await dolomiteOwner.populateTransaction.ownerSetSecondsTimeLocked(123);
      const transaction2 = await dolomiteOwner.populateTransaction.ownerSetSecondsValid(ONE_DAY_SECONDS * 5);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction1.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction2.data!);

      await dolomiteOwner.connect(core.hhUser3).cancelTransactions([0, 1]);

      const txn1 = await dolomiteOwner.transactions(0);
      expect(txn1.cancelled).to.be.true;
      expect(txn1.executed).to.be.false;

      const txn2 = await dolomiteOwner.transactions(1);
      expect(txn2.cancelled).to.be.true;
      expect(txn2.executed).to.be.false;
    });

    it('should fail if not called by default admin or veto role', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).cancelTransactions([0, 1]),
        'DolomiteOwnerV3: Missing role'
      );
    });
  });

  describe('#getBypassTimelockAddresses', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getBypassTimelockAddresses()).to.deep.eq([]);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        bypassTimelockRole,
        core.hhUser1.address,
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        bypassTimelockRole,
        core.hhUser2.address,
      );

      const addresses = await dolomiteOwner.getBypassTimelockAddresses();
      expect(addresses.length).to.eq(2);
      expect(addresses).to.contain(core.hhUser1.address);
      expect(addresses).to.contain(core.hhUser2.address);
    });
  });

  describe('#getExecutorAddresses', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getExecutorAddresses()).to.deep.eq([]);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        executorRole,
        core.hhUser1.address,
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        executorRole,
        core.hhUser2.address,
      );

      const addresses = await dolomiteOwner.getExecutorAddresses();
      expect(addresses.length).to.eq(2);
      expect(addresses).to.contain(core.hhUser1.address);
      expect(addresses).to.contain(core.hhUser2.address);
    });
  });

  describe('#getVetoAddresses', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getVetoAddresses()).to.deep.eq([]);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        vetoRole,
        core.hhUser1.address,
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
        vetoRole,
        core.hhUser2.address,
      );

      const addresses = await dolomiteOwner.getVetoAddresses();
      expect(addresses.length).to.eq(2);
      expect(addresses).to.contain(core.hhUser1.address);
      expect(addresses).to.contain(core.hhUser2.address);
    });
  });

  describe('#getTransactions', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(core.dolomiteRegistry.address, data.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.gnosisSafe).executeTransaction(0);
    });

    it('should work normally', async () => {
      const transactions = await dolomiteOwner.getTransactions(0, 3);

      expect(transactions.length).to.eq(3);
      expect(transactions[0].executed).to.be.true;
      expect(transactions[1].executed).to.be.false;
      expect(transactions[2].executed).to.be.false;
    });

    it('should work normally if to is greater than transaction count', async () => {
      const transactions = await dolomiteOwner.getTransactions(0, 7);

      expect(transactions.length).to.eq(3);
      expect(transactions[0].executed).to.be.true;
      expect(transactions[1].executed).to.be.false;
      expect(transactions[2].executed).to.be.false;
    });
  });
});
