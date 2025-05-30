import { expect } from 'chai';
import { BytesLike } from 'ethers';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  BYTES_ZERO,
  Network,
  ONE_DAY_SECONDS,
} from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { DolomiteOwnerV1 } from '../src/types';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { createDolomiteOwnerV1 } from './admin-ecosystem-utils';
import { revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const BAD_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BYTES4_OTHER_SELECTOR = '0x12345678';
const SECONDS_TIME_LOCKED = 0;

describe('DolomiteOwner', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwnerV1;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let securityCouncilRole: BytesLike;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    dolomiteOwner = (await createDolomiteOwnerV1(core, SECONDS_TIME_LOCKED)).connect(core.gnosisSafe);
    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    securityCouncilRole = await dolomiteOwner.SECURITY_COUNCIL_ROLE();
    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    expect(await dolomiteOwner.secondsTimeLocked()).to.eq(SECONDS_TIME_LOCKED);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetSecondsTimeLocked', () => {
    it('should work normally', async () => {
      const newSecondsTimeLocked = 123;
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(SECONDS_TIME_LOCKED);
      const result = await dolomiteOwner.ownerSetSecondsTimeLocked(newSecondsTimeLocked);
      await expectEvent(dolomiteOwner, result, 'SecondsTimeLockedChanged', {
        _secondsTimeLocked: newSecondsTimeLocked,
      });
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(newSecondsTimeLocked);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerSetSecondsTimeLocked(123),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerAddRole', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getRoles()).to.deep.equal([bypassTimelockRole, BYTES_ZERO, executorRole]);
      const res = await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await expectEvent(dolomiteOwner, res, 'RoleAdded', {
        _role: securityCouncilRole,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal([
        bypassTimelockRole,
        BYTES_ZERO,
        executorRole,
        securityCouncilRole,
      ]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRole(securityCouncilRole),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerRemoveRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoles()).to.deep.equal([
        bypassTimelockRole,
        BYTES_ZERO,
        executorRole,
        securityCouncilRole,
      ]);

      const res = await dolomiteOwner.ownerRemoveRole(securityCouncilRole);
      await expectEvent(dolomiteOwner, res, 'RoleRemoved', {
        _role: securityCouncilRole,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal([bypassTimelockRole, BYTES_ZERO, executorRole]);
    });

    it('should fail if attempting to remove DEFAULT_ADMIN', async () => {
      await expectThrow(dolomiteOwner.ownerRemoveRole(BYTES_ZERO), 'DolomiteOwnerV1: Cannot remove admin role');
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRole(securityCouncilRole),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerAddRoleAddresses', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await expectEvent(dolomiteOwner, res, 'AddressesAddedToRole', {
        _role: securityCouncilRole,
        _address: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([core.dolomiteRegistry.address]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleAddresses(BAD_ROLE, [OTHER_ADDRESS]),
        `DolomiteOwnerV1: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerRemoveRoleAddresses', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);

      const res = await dolomiteOwner.ownerRemoveRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await expectEvent(dolomiteOwner, res, 'AddressesRemovedFromRole', {
        _role: securityCouncilRole,
        _address: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerAddRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsAddedToRole', {
        _role: securityCouncilRole,
        _selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([BYTES32_OTHER_SELECTOR]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleFunctionSelectors(BAD_ROLE, [BYTES4_OTHER_SELECTOR]),
        `DolomiteOwnerV1: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerRemoveRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);

      const res = await dolomiteOwner.ownerRemoveRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsRemovedFromRole', {
        _role: securityCouncilRole,
        _selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner
          .connect(core.hhUser1)
          .ownerRemoveRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerAddRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(
        await dolomiteOwner.getRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address),
      ).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678'],
      );
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsAddedToAddress', {
        _role: securityCouncilRole,
        _address: core.dolomiteRegistry.address,
        _selectors: ['0x12345678'],
      });
      expect(
        await dolomiteOwner.getRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address),
      ).to.deep.equal([BYTES32_OTHER_SELECTOR]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(BAD_ROLE, OTHER_ADDRESS, ['0x12345678']),
        `DolomiteOwnerV1: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner
          .connect(core.hhUser1)
          .ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, OTHER_ADDRESS, ['0x12345678']),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerRemoveRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address, [
        '0x12345678',
      ]);

      const res = await dolomiteOwner.ownerRemoveRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678'],
      );
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsRemovedFromAddress', {
        _role: securityCouncilRole,
        _address: core.dolomiteRegistry.address,
        _selectors: ['0x12345678'],
      });
      expect(
        await dolomiteOwner.getRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address),
      ).to.deep.equal([]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner
          .connect(core.hhUser1)
          .ownerRemoveRoleToAddressFunctionSelectors(securityCouncilRole, OTHER_ADDRESS, ['0x12345678']),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#ownerCancelTransaction', () => {
    it('should work normally', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const res = await dolomiteOwner.ownerCancelTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionCancelled', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).cancelled).to.be.true;
    });

    it('should fail if transaction is already executed', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.executeTransaction(0);
      await expectThrow(dolomiteOwner.ownerCancelTransaction(0), 'DolomiteOwnerV1: Transaction not cancellable');
    });

    it('should fail if transaction is already cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(dolomiteOwner.ownerCancelTransaction(0), 'DolomiteOwnerV1: Transaction not cancellable');
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(dolomiteOwner.ownerCancelTransaction(0), 'DolomiteOwnerV1: Transaction does not exist');
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerCancelTransaction(0),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`,
      );
    });
  });

  describe('#submitTransaction', () => {
    it('default admin should be able to submit a transaction', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      expect(await dolomiteOwner.transactionCount()).to.eq(1);
      const transaction = await dolomiteOwner.transactions(0);
      expect(transaction.destination).to.eq(core.dolomiteRegistry.address);
      expect(transaction.data).to.eq(data.data);
      expect(transaction.executed).to.eq(false);
      expect(transaction.cancelled).to.eq(false);
    });

    it('role should be able to submit an approved destination with any function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should be able to submit an approved function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, ['0xd42d1cb9']);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should be able to submit an approved destination with specific function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address, [
        data.data!.slice(0, 10),
      ]);

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should NOT be able to submit an unapproved destination', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!),
        'DolomiteOwnerV1: Transaction not approved',
      );
    });

    it('role should NOT be able to submit an unapproved function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address, [
        BYTES4_OTHER_SELECTOR,
      ]);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!),
        'DolomiteOwnerV1: Transaction not approved',
      );
    });

    it('should fail for default admin when submitting a transaction with data that is too small', async () => {
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x'),
        'DolomiteOwnerV1: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x12'),
        'DolomiteOwnerV1: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x1234'),
        'DolomiteOwnerV1: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x123456'),
        'DolomiteOwnerV1: Invalid calldata length',
      );
    });

    it('should fail for default admin when submitting a transaction with no data', async () => {
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, BYTES_EMPTY),
        'DolomiteOwnerV1: Invalid calldata length',
      );
    });

    it('should fail for role when submitting a transaction with no data', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.hhUser5.address]);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES_EMPTY),
        'DolomiteOwnerV1: Invalid calldata length',
      );
    });

    it('should fail if users role is no longer active', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.hhUser5.address]);

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES4_OTHER_SELECTOR);

      await dolomiteOwner.ownerRemoveRole(securityCouncilRole);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES4_OTHER_SELECTOR),
        'DolomiteOwnerV1: Transaction not approved',
      );
    });

    it('should fail if called by executor role', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.ownerAddRole(executorRole);
      await dolomiteOwner.grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(executorRole, [core.dolomiteRegistry.address]);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, BYTES4_OTHER_SELECTOR),
        'DolomiteOwnerV1: Transaction not approved',
      );
    });

    it('should fail if destination is address zero', async () => {
      await expectThrow(dolomiteOwner.submitTransaction(ADDRESS_ZERO, BYTES_ZERO), 'DolomiteOwnerV1: Address is null');
    });
  });

  describe('#executeTransaction', () => {
    it('should work normally for default admin', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const res = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should work normally when there is a time lock', async () => {
      await dolomiteOwner.ownerSetSecondsTimeLocked(ONE_DAY_SECONDS);
      expect(await dolomiteOwner.secondsTimeLocked()).to.eq(ONE_DAY_SECONDS);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV1: Timelock incomplete');

      await increase(ONE_DAY_SECONDS);

      const res = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should work normally when there is a time lock but role can bypass it', async () => {
      await dolomiteOwner.ownerSetSecondsTimeLocked(ONE_DAY_SECONDS);
      expect(await dolomiteOwner.secondsTimeLocked()).to.eq(ONE_DAY_SECONDS);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV1: Timelock incomplete');

      const bypassTimeLockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
      await dolomiteOwner.grantRole(bypassTimeLockRole, core.gnosisSafe.address);
      expect(await dolomiteOwner.hasRole(bypassTimeLockRole, core.gnosisSafe.address)).to.be.true;

      const res = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should work normally for executor', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.ownerAddRole(executorRole);
      await dolomiteOwner.grantRole(executorRole, core.hhUser1.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const res = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should fail if user is not admin or executor', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await expectThrow(dolomiteOwner.connect(core.hhUser1).executeTransaction(0), 'DolomiteOwnerV1: Invalid executor');
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV1: Transaction does not exist');
    });

    it('should fail if transaction is already executed', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.executeTransaction(0);
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV1: Transaction not executable');
    });

    it('should fail if transaction is cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV1: Transaction not executable');
    });
  });

  describe('#executeTransactions', () => {
    it('should work normally for default admin', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await dolomiteOwner.executeTransactions([0, 1]);
      expect(await core.dolomiteRegistry.chainlinkPriceOracle()).to.eq(OTHER_ADDRESS);
      expect(await core.dolomiteRegistry.eventEmitter()).to.eq(OTHER_ADDRESS);
    });

    it('should work normally for executor role', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.ownerAddRole(executorRole);
      await dolomiteOwner.grantRole(executorRole, core.hhUser1.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await dolomiteOwner.connect(core.hhUser1).executeTransactions([0, 1]);
      expect(await core.dolomiteRegistry.chainlinkPriceOracle()).to.eq(OTHER_ADDRESS);
      expect(await core.dolomiteRegistry.eventEmitter()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if user is not admin or executor', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).executeTransactions([0, 1]),
        'DolomiteOwnerV1: Invalid executor',
      );
    });
  });

  describe('#submitTransactionAndExecute', () => {
    it('should work normally', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransactionAndExecute(core.dolomiteRegistry.address, data.data!);
    });
  });

  describe('#grantRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.true;
    });

    it('should fail if role is not active', async () => {
      await expectThrow(
        dolomiteOwner.grantRole(BAD_ROLE, core.hhUser1.address),
        `DolomiteOwnerV1: Invalid role <${BAD_ROLE}>`,
      );
    });
  });

  describe('#revokeRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      await dolomiteOwner.revokeRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);
    });

    it('should fail if role is not active', async () => {
      await expectThrow(
        dolomiteOwner.revokeRole(BAD_ROLE, core.hhUser1.address),
        `DolomiteOwnerV1: Invalid role <${BAD_ROLE}>`,
      );
    });
  });

  describe('#getTransactionCount', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.executeTransaction(0);
    });

    it('should work normally for pending + executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(true, true)).to.eq(3);
    });

    it('should work normally for pending transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(true, false)).to.eq(2);
    });

    it('should work normally for executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(false, true)).to.eq(1);
    });

    it('should work normally for neither pending nor executed transactions', async () => {
      expect(await dolomiteOwner.getTransactionCount(false, false)).to.eq(0);
    });
  });

  describe('#getTransactionIds', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.executeTransaction(0);
    });

    it('should work normally for pending + executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 3, true, true);
      expect(ids.length).to.eq(3);
      expect(ids[0]).to.eq(0);
      expect(ids[1]).to.eq(1);
      expect(ids[2]).to.eq(2);
    });

    it('should work normally for pending transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 3, true, false);
      expect(ids.length).to.eq(2);
      expect(ids[0]).to.eq(1);
      expect(ids[1]).to.eq(2);
    });

    it('should work normally for executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 3, false, true);
      expect(ids.length).to.eq(1);
      expect(ids[0]).to.eq(0);
    });

    it('should work normally for neither pending nor executed transactions', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 3, false, false);
      expect(ids.length).to.eq(0);
    });

    it('should work if to is greater than transaction count', async () => {
      const ids = await dolomiteOwner.getTransactionIds(0, 5, true, true);
      expect(ids.length).to.eq(3);
      expect(ids[0]).to.eq(0);
      expect(ids[1]).to.eq(1);
      expect(ids[2]).to.eq(2);
    });
  });

  describe('#isUserApprovedToSubmitTransaction', () => {
    it('should fail when role does not exist', async () => {
      await dolomiteOwner.ownerAddRole(BAD_ROLE);
      await dolomiteOwner.grantRole(BAD_ROLE, core.hhUser4.address);
      await dolomiteOwner.ownerRemoveRole(BAD_ROLE);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });

    it('should fail when only user role is EXECUTOR', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.grantRole(executorRole, core.hhUser4.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });

    it('should fail when only user role is BYPASS_TIMELOCK', async () => {
      const bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
      await dolomiteOwner.grantRole(bypassTimelockRole, core.hhUser4.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });
  });
});
