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
import { DolomiteOwnerV2 } from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteOwnerV2 } from './admin-ecosystem-utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { revertToSnapshotAndCapture, snapshot, impersonate } from 'packages/base/test/utils';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const OTHER_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BAD_ROLE = '0x8888888888888888888888888888888888888888888888888888888888888888';
const BYTES4_OTHER_SELECTOR = '0x12345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const SECONDS_TIME_LOCKED = ONE_DAY_SECONDS;

describe('DolomiteOwnerV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwnerV2;
  let bypassTimelockRole: BytesLike;
  let executorRole: BytesLike;
  let securityCouncilRole: BytesLike;
  let listingCommitteeRole: BytesLike;

  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    dolomiteOwner = (await createDolomiteOwnerV2(core, SECONDS_TIME_LOCKED)).connect(core.gnosisSafe);
    bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
    executorRole = await dolomiteOwner.EXECUTOR_ROLE();
    securityCouncilRole = await dolomiteOwner.SECURITY_COUNCIL_ROLE();
    listingCommitteeRole = await dolomiteOwner.LISTING_COMMITTEE_ROLE();
    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    expect(await dolomiteOwner.secondsTimeLocked()).to.eq(SECONDS_TIME_LOCKED);

    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(SECONDS_TIME_LOCKED);
      expect(await dolomiteOwner.getRoles()).to.deep.equal(
        [BYTES_ZERO, bypassTimelockRole, executorRole, securityCouncilRole, listingCommitteeRole]
      );
      expect(await dolomiteOwner.hasRole(BYTES_ZERO, core.gnosisSafe.address)).to.be.true;
    });
  });

  describe('#grantRole', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.grantRole(
        securityCouncilRole, core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);

      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.true;
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).grantRole(securityCouncilRole, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokeRole', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.grantRole(
        securityCouncilRole, core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);
      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.true;

      const revokeTransaction = await dolomiteOwner.populateTransaction.revokeRole(
        securityCouncilRole, core.hhUser1.address
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, revokeTransaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(1);
      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.false;
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).revokeRole(securityCouncilRole, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
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
      const result = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, result, 'SecondsTimeLockedChanged', {
        _secondsTimeLocked: newSecondsTimeLocked,
      });
      expect(await dolomiteOwner.secondsTimeLocked()).to.equal(newSecondsTimeLocked);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerSetSecondsTimeLocked(123),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddRole', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRole(OTHER_ROLE);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'RoleAdded', {
        _role: OTHER_ROLE,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal(
        [BYTES_ZERO, bypassTimelockRole, executorRole, securityCouncilRole, listingCommitteeRole, OTHER_ROLE]
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerAddRole(securityCouncilRole),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveRole', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRole(OTHER_ROLE);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);

      const removeTransaction = await dolomiteOwner.populateTransaction.ownerRemoveRole(OTHER_ROLE);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, removeTransaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(1);

      await expectEvent(dolomiteOwner, res, 'RoleRemoved', {
        _role: OTHER_ROLE,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal(
        [BYTES_ZERO, bypassTimelockRole, executorRole, securityCouncilRole, listingCommitteeRole]
      );
    });

    it('should fail if attempting to remove DEFAULT_ADMIN', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerRemoveRole(BYTES_ZERO);
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        'DolomiteOwnerV2: Cannot remove admin role'
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerRemoveRole(securityCouncilRole),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddRoleAddresses', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);

      const res = await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address]
      );
      await expectEvent(dolomiteOwner, res, 'AddressesAddedToRole', {
        _role: securityCouncilRole,
        _address: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([core.dolomiteRegistry.address]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(BAD_ROLE, [OTHER_ADDRESS]),
        `DolomiteOwnerV2: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `DolomiteOwnerV2: Invalid caller <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveRoleAddresses', () => {
    it('should work normally', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address],
      );

      const res = await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRemoveRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address],
      );
      await expectEvent(dolomiteOwner, res, 'AddressesRemovedFromRole', {
        _role: securityCouncilRole,
        _address: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `DolomiteOwnerV2: Invalid caller <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleFunctionSelectors(
        securityCouncilRole,
        [BYTES4_OTHER_SELECTOR]
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(0);

      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsAddedToRole', {
        _role: securityCouncilRole,
        _selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([BYTES32_OTHER_SELECTOR]);
    });

    it('should fail if invalid role', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleFunctionSelectors(
        BAD_ROLE,
        [BYTES4_OTHER_SELECTOR]
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        `DolomiteOwnerV2: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerAddRoleFunctionSelectors(
          securityCouncilRole,
          [BYTES4_OTHER_SELECTOR]
        ),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleFunctionSelectors(
        securityCouncilRole,
        [BYTES4_OTHER_SELECTOR]
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);

      const removeTransaction = await dolomiteOwner.populateTransaction.ownerRemoveRoleFunctionSelectors(
        securityCouncilRole,
        [BYTES4_OTHER_SELECTOR]
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, removeTransaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(1);
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsRemovedFromRole', {
        _role: securityCouncilRole,
        _selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerRemoveRoleFunctionSelectors(
          securityCouncilRole,
          [BYTES4_OTHER_SELECTOR]
        ),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      expect(
        await dolomiteOwner.getRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address),
      ).to.deep.equal([]);

      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678'],
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(0);

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
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleToAddressFunctionSelectors(
        BAD_ROLE,
        OTHER_ADDRESS,
        ['0x12345678'],
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        `DolomiteOwnerV2: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.gnosisSafe).ownerAddRoleToAddressFunctionSelectors(
          securityCouncilRole,
          OTHER_ADDRESS,
          ['0x12345678']
        ),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemoveRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      const transaction = await dolomiteOwner.populateTransaction.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678'],
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, transaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);

      const removeTransaction = await dolomiteOwner.populateTransaction.ownerRemoveRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678'],
      );
      await dolomiteOwner.connect(core.gnosisSafe).submitTransaction(dolomiteOwner.address, removeTransaction.data!);
      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(1);
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
        dolomiteOwner.connect(core.gnosisSafe).ownerRemoveRoleToAddressFunctionSelectors(
          securityCouncilRole,
          OTHER_ADDRESS,
          ['0x12345678']
        ),
        `DolomiteOwnerV2: Invalid caller <${core.gnosisSafe.address.toLowerCase()}>`,
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
      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);

      await expectThrow(
        dolomiteOwner.ownerCancelTransaction(0),
        'DolomiteOwnerV2: Transaction not cancellable'
      );
    });

    it('should fail if transaction is already cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(dolomiteOwner.ownerCancelTransaction(0), 'DolomiteOwnerV2: Transaction not cancellable');
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(dolomiteOwner.ownerCancelTransaction(0), 'DolomiteOwnerV2: Transaction does not exist');
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
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address],
      );

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should be able to submit an approved function selector', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleFunctionSelectors(securityCouncilRole, ['0xd42d1cb9']);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should be able to submit an approved destination with specific function selector', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address],
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        [data.data!.slice(0, 10)],
      );

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!);
    });

    it('role should NOT be able to submit an unapproved destination', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!),
        'DolomiteOwnerV2: Transaction not approved',
      );
    });

    it('role should NOT be able to submit an unapproved function selector', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(securityCouncilRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address],
      );
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        [BYTES4_OTHER_SELECTOR],
      );

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, data.data!),
        'DolomiteOwnerV2: Transaction not approved',
      );
    });

    it('should fail for default admin when submitting a transaction with data that is too small', async () => {
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x'),
        'DolomiteOwnerV2: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x12'),
        'DolomiteOwnerV2: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x1234'),
        'DolomiteOwnerV2: Invalid calldata length',
      );
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, '0x123456'),
        'DolomiteOwnerV2: Invalid calldata length',
      );
    });

    it('should fail for default admin when submitting a transaction with no data', async () => {
      await expectThrow(
        dolomiteOwner.submitTransaction(core.hhUser1.address, BYTES_EMPTY),
        'DolomiteOwnerV2: Invalid calldata length',
      );
    });

    it('should fail for role when submitting a transaction with no data', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(securityCouncilRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.hhUser5.address],
      );

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES_EMPTY),
        'DolomiteOwnerV2: Invalid calldata length',
      );
    });

    it('should fail if users role is no longer active', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(securityCouncilRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.hhUser5.address],
      );

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES4_OTHER_SELECTOR);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRemoveRole(securityCouncilRole);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, BYTES4_OTHER_SELECTOR),
        'DolomiteOwnerV2: Transaction not approved',
      );
    });

    it('should fail if called by executor role', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(executorRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        executorRole,
        [core.dolomiteRegistry.address]
      );

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, BYTES4_OTHER_SELECTOR),
        'DolomiteOwnerV2: Transaction not approved',
      );
    });

    it('should fail if destination is address zero', async () => {
      await expectThrow(dolomiteOwner.submitTransaction(ADDRESS_ZERO, BYTES_ZERO), 'DolomiteOwnerV2: Address is null');
    });
  });

  describe('#executeTransaction', () => {
    it('should work normally for default admin', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should work normally when there is a time lock but role can bypass it', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV2: Timelock incomplete');

      const bypassTimeLockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimeLockRole, core.hhUser1.address);
      expect(await dolomiteOwner.hasRole(bypassTimeLockRole, core.hhUser1.address)).to.be.true;

      const res = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should work normally for executor', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(executorRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await increase(SECONDS_TIME_LOCKED);
      const res = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should fail if user is not admin or executor', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(dolomiteOwner.connect(core.hhUser1).executeTransaction(0), 'DolomiteOwnerV2: Invalid executor');
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV2: Transaction does not exist');
    });

    it('should fail if transaction is already executed', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransaction(0);
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV2: Transaction not executable');
    });

    it('should fail if transaction is cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(dolomiteOwner.executeTransaction(0), 'DolomiteOwnerV2: Transaction not executable');
    });
  });

  describe('#executeTransactions', () => {
    it('should work normally for default admin', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.executeTransactions([0, 1]);
      expect(await core.dolomiteRegistry.chainlinkPriceOracle()).to.eq(OTHER_ADDRESS);
      expect(await core.dolomiteRegistry.eventEmitter()).to.eq(OTHER_ADDRESS);
    });

    it('should work normally for executor role', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(executorRole);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await increase(SECONDS_TIME_LOCKED);
      await dolomiteOwner.connect(core.hhUser1).executeTransactions([0, 1]);
      expect(await core.dolomiteRegistry.chainlinkPriceOracle()).to.eq(OTHER_ADDRESS);
      expect(await core.dolomiteRegistry.eventEmitter()).to.eq(OTHER_ADDRESS);
    });

    it('should fail if user is not admin or executor', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data2.data!);

      await increase(SECONDS_TIME_LOCKED);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).executeTransactions([0, 1]),
        'DolomiteOwnerV2: Invalid executor',
      );
    });
  });

  describe('#submitTransactionAndExecute', () => {
    it('should work normally if user has required roles', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleAddresses(
        securityCouncilRole,
        [core.dolomiteRegistry.address]
      );

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.connect(core.hhUser1).submitTransactionAndExecute(core.dolomiteRegistry.address, data.data!);
    });
  });

  describe('#grantRole', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.true;
    });

    it('can grant default admin role to bypass timelock user', async () => {
      const defaultAdminRole = await dolomiteOwner.DEFAULT_ADMIN_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser1.address);
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(defaultAdminRole, core.hhUser1.address),
        'DolomiteOwnerV2: Admin cannot bypass timelock',
      );
    });

    it('should fail if granting bypass timelock role to default admin', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.gnosisSafe.address),
        'DolomiteOwnerV2: Admin cannot bypass timelock',
      );
    });

    it('should fail if role is not active', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(BAD_ROLE, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).grantRole(securityCouncilRole, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid caller <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#revokeRole', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).revokeRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getUserToRoles(core.hhUser1.address)).to.deep.equal([]);
    });

    it('should fail if role is not active', async () => {
      await expectThrow(
        dolomiteOwner.connect(dolomiteOwnerImpersonator).revokeRole(BAD_ROLE, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid role <${BAD_ROLE}>`,
      );
    });

    it('should fail if not called by self', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).revokeRole(securityCouncilRole, core.hhUser1.address),
        `DolomiteOwnerV2: Invalid caller <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getTransactionCount', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, data.data!);
      await increase(SECONDS_TIME_LOCKED);
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
      await increase(SECONDS_TIME_LOCKED);
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
    it('should return false when role does not exist', async () => {
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(securityCouncilRole, core.hhUser4.address);
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerRemoveRole(securityCouncilRole);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });

    it('should return false when only user role is EXECUTOR', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(executorRole, core.hhUser4.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });

    it('should return false when only user role is BYPASS_TIMELOCK', async () => {
      const bypassTimelockRole = await dolomiteOwner.BYPASS_TIMELOCK_ROLE();
      await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(bypassTimelockRole, core.hhUser4.address);

      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      expect(
        await dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser4.address,
          core.dolomiteRegistry.address,
          data.data!.slice(0, 10),
        ),
      ).to.be.false;
    });

    it('should fail if destination is address(this)', async () => {
      const data = await dolomiteOwner.populateTransaction.grantRole(securityCouncilRole, core.hhUser1.address);
      await expectThrow(
        dolomiteOwner.isUserApprovedToSubmitTransaction(
          core.hhUser1.address,
          dolomiteOwner.address,
          data.data!.slice(0, 10),
        ),
        'DolomiteOwnerV2: Invalid destination',
      );
    });
  });
});
