import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, BYTES_EMPTY, BYTES_ZERO, Network } from 'packages/base/src/utils/no-deps-constants';
import {
  DolomiteOwner,
  DolomiteOwner__factory,
  Ownable__factory,
} from '../../src/types';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { BytesLike } from 'ethers';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const BYTES32_OTHER_SELECTOR = '0x1234567800000000000000000000000000000000000000000000000000000000';
const BAD_ROLE = '0x1111111111111111111111111111111111111111111111111111111111111111';
const BYTES4_OTHER_SELECTOR = '0x12345678';

describe('DolomiteOwner', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dolomiteOwner: DolomiteOwner;
  let securityCouncilRole: BytesLike;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    dolomiteOwner = (await createContractWithAbi<DolomiteOwner>(
      DolomiteOwner__factory.abi,
      DolomiteOwner__factory.bytecode,
      [core.governance.address]
    )).connect(core.governance);
    securityCouncilRole = await dolomiteOwner.SECURITY_COUNCIL_ROLE();
    const ownable = Ownable__factory.connect(core.dolomiteMargin.address, core.governance);
    await ownable.transferOwnership(dolomiteOwner.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerAddRole', () => {
    it('should work normally', async () => {
      expect(await dolomiteOwner.getRoles()).to.deep.equal([BYTES_ZERO]);
      const res = await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await expectEvent(dolomiteOwner, res, 'RoleAdded', {
        role: securityCouncilRole,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal([BYTES_ZERO, securityCouncilRole]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRole(securityCouncilRole),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerRemoveRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoles()).to.deep.equal([BYTES_ZERO, securityCouncilRole]);

      const res = await dolomiteOwner.ownerRemoveRole(securityCouncilRole);
      await expectEvent(dolomiteOwner, res, 'RoleRemoved', {
        role: securityCouncilRole,
      });
      expect(await dolomiteOwner.getRoles()).to.deep.equal([BYTES_ZERO]);
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRole(securityCouncilRole),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerAddRoleAddresses', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await expectEvent(dolomiteOwner, res, 'AddressesAddedToRole', {
        role: securityCouncilRole,
        addresses: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([core.dolomiteRegistry.address]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleAddresses(BAD_ROLE, [OTHER_ADDRESS]),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerRemoveRoleAddresses', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);

      const res = await dolomiteOwner.ownerRemoveRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await expectEvent(dolomiteOwner, res, 'AddressesRemovedFromRole', {
        role: securityCouncilRole,
        addresses: [core.dolomiteRegistry.address],
      });
      expect(await dolomiteOwner.getRoleAddresses(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerRemoveRoleAddresses(BAD_ROLE, [OTHER_ADDRESS]),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRoleAddresses(securityCouncilRole, [OTHER_ADDRESS]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerAddRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsAddedToRole', {
        role: securityCouncilRole,
        selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([BYTES32_OTHER_SELECTOR]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleFunctionSelectors(BAD_ROLE, [BYTES4_OTHER_SELECTOR]),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerRemoveRoleFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);

      const res = await dolomiteOwner.ownerRemoveRoleFunctionSelectors(securityCouncilRole, [BYTES4_OTHER_SELECTOR]);
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsRemovedFromRole', {
        role: securityCouncilRole,
        selectors: [BYTES4_OTHER_SELECTOR],
      });
      expect(await dolomiteOwner.getRoleFunctionSelectors(securityCouncilRole)).to.deep.equal([]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerRemoveRoleFunctionSelectors(BAD_ROLE, [BYTES4_OTHER_SELECTOR]),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRoleFunctionSelectors(
          securityCouncilRole,
          [BYTES4_OTHER_SELECTOR]
        ),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerAddRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address)
      ).to.deep.equal([]);

      const res = await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678']
      );
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsAddedToAddress', {
        role: securityCouncilRole,
        address: core.dolomiteRegistry.address,
        selectors: ['0x12345678'],
      });
      expect(await dolomiteOwner.getRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address)
      ).to.deep.equal([BYTES32_OTHER_SELECTOR]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(BAD_ROLE, OTHER_ADDRESS, ['0x12345678']),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, OTHER_ADDRESS, ['0x12345678']),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerRemoveRoleToAddressFunctionSelectors', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(securityCouncilRole, core.dolomiteRegistry.address, ['0x12345678']);

      const res = await dolomiteOwner.ownerRemoveRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        ['0x12345678']
      );
      await expectEvent(dolomiteOwner, res, 'FunctionSelectorsRemovedFromAddress', {
        role: securityCouncilRole,
        address: core.dolomiteRegistry.address,
        selectors: ['0x12345678'],
      });
      expect(await dolomiteOwner.getRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address)
      ).to.deep.equal([]);
    });

    it('should fail if invalid role', async () => {
      await expectThrow(
        dolomiteOwner.ownerRemoveRoleToAddressFunctionSelectors(BAD_ROLE, OTHER_ADDRESS, ['0x12345678']),
        'DolomiteOwner: Invalid role'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerRemoveRoleToAddressFunctionSelectors(
          securityCouncilRole,
          OTHER_ADDRESS,
          ['0x12345678']
        ),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#ownerCancelTransaction', () => {
    it('should work normally', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      const res = await dolomiteOwner.ownerCancelTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionCancelled', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).cancelled).to.be.true;
    });

    it('should fail if transaction is already executed', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      await dolomiteOwner.executeTransaction(0);
      await expectThrow(
        dolomiteOwner.ownerCancelTransaction(0),
        'DolomiteOwner: Transaction not cancellable'
      );
    });

    it('should fail if transaction is already cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(
        dolomiteOwner.ownerCancelTransaction(0),
        'DolomiteOwner: Transaction not cancellable'
      );
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.ownerCancelTransaction(0),
        'DolomiteOwner: Transaction does not exist'
      );
    });

    it('should fail if not called by DEFAULT_ADMIN', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).ownerCancelTransaction(0),
        `AccessControl: account ${core.hhUser1.address.toLowerCase()} is missing role ${BYTES_ZERO}`
      );
    });
  });

  describe('#submitTransaction', () => {
    it('default admin should be able to submit a transaction', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      expect(await dolomiteOwner.transactionCount()).to.eq(1);
      const transaction = await dolomiteOwner.transactions(0);
      expect(transaction.destination).to.eq(core.dolomiteRegistry.address);
      expect(transaction.value).to.eq(0);
      expect(transaction.data).to.eq(data.data);
      expect(transaction.executed).to.eq(false);
      expect(transaction.cancelled).to.eq(false);
    });

    it('role should be able to submit an approved destination with any function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
    });

    it('role should be able to submit an approved function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleFunctionSelectors(securityCouncilRole, ['0xd42d1cb9']);
      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
    });

    it('role should be able to submit an approved destination with specific function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        [data.data!.slice(0, 10)]
      );

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
    });

    it('role should NOT be able to submit an unapproved destination', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, data.data!),
        'DolomiteOwner: Transaction not approved'
      );
    });

    it('role should NOT be able to submit an unapproved function selector', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.dolomiteRegistry.address]);
      await dolomiteOwner.ownerAddRoleToAddressFunctionSelectors(
        securityCouncilRole,
        core.dolomiteRegistry.address,
        [BYTES4_OTHER_SELECTOR]
      );

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, data.data!),
        'DolomiteOwner: Transaction not approved'
      );
    });

    it('default admin should be able to sumbit a transaction with no data', async () => {
      await dolomiteOwner.submitTransaction(core.hhUser1.address, 0, BYTES_EMPTY);
    });

    it('role should be able to submit a transaction with no data', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.hhUser5.address]);

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, 0, BYTES_EMPTY);
    });

    it('should fail if users role is no longer active', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(securityCouncilRole, [core.hhUser5.address]);

      await dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, 0, BYTES_EMPTY);

      await dolomiteOwner.ownerRemoveRole(securityCouncilRole);
      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.hhUser5.address, 0, BYTES_EMPTY),
        'DolomiteOwner: Transaction not approved'
      );
    });

    it('should fail if called by executor role', async () => {
      const executorRole = await dolomiteOwner.EXECUTOR_ROLE();
      await dolomiteOwner.ownerAddRole(executorRole);
      await dolomiteOwner.grantRole(executorRole, core.hhUser1.address);
      await dolomiteOwner.ownerAddRoleAddresses(executorRole, [core.dolomiteRegistry.address]);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).submitTransaction(core.dolomiteRegistry.address, 0, BYTES_EMPTY),
        'DolomiteOwner: Transaction not approved'
      );
    });

    it('should fail if destination is address zero', async () => {
      await expectThrow(
        dolomiteOwner.submitTransaction(ADDRESS_ZERO, 0, BYTES_ZERO),
        'DolomiteOwner: Address is null'
      );
    });
  });

  describe('#executeTransaction', () => {
    it('should work normally for default admin', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

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
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      const res = await dolomiteOwner.connect(core.hhUser1).executeTransaction(0);
      await expectEvent(dolomiteOwner, res, 'TransactionExecuted', {
        transactionId: 0,
      });
      expect((await dolomiteOwner.transactions(0)).executed).to.be.true;
    });

    it('should fail if user is not admin or executor', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      await expectThrow(
        dolomiteOwner.connect(core.hhUser1).executeTransaction(0),
        'DolomiteOwner: Invalid executor'
      );
    });

    it('should fail if transaction does not exist', async () => {
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        'DolomiteOwner: Transaction does not exist'
      );
    });

    it('should fail if transaction is already executed', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      await dolomiteOwner.executeTransaction(0);
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        'DolomiteOwner: Transaction not executable'
      );
    });

    it('should fail if transaction is cancelled', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      await dolomiteOwner.ownerCancelTransaction(0);
      await expectThrow(
        dolomiteOwner.executeTransaction(0),
        'DolomiteOwner: Transaction not executable'
      );
    });
  });

  describe('#executeTransactions', () => {
    it('should work normally', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);

      const data2 = await core.dolomiteRegistry.populateTransaction.ownerSetEventEmitter(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data2.data!);

      await dolomiteOwner.executeTransactions([0, 1]);
      expect(await core.dolomiteRegistry.chainlinkPriceOracle()).to.eq(OTHER_ADDRESS);
      expect(await core.dolomiteRegistry.eventEmitter()).to.eq(OTHER_ADDRESS);
    });
  });

  describe('#submitTransactionAndExecute', () => {
    it('should work normally', async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransactionAndExecute(core.dolomiteRegistry.address, 0, data.data!);
    });
  });

  describe('#grantRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getAddressToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getAddressToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      expect(await dolomiteOwner.hasRole(securityCouncilRole, core.hhUser1.address)).to.be.true;
    });
  });

  describe('#revokeRole', () => {
    it('should work normally', async () => {
      await dolomiteOwner.ownerAddRole(securityCouncilRole);
      expect(await dolomiteOwner.getAddressToRoles(core.hhUser1.address)).to.deep.equal([]);

      await dolomiteOwner.grantRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getAddressToRoles(core.hhUser1.address)).to.deep.equal([securityCouncilRole]);
      await dolomiteOwner.revokeRole(securityCouncilRole, core.hhUser1.address);
      expect(await dolomiteOwner.getAddressToRoles(core.hhUser1.address)).to.deep.equal([]);
    });
  });

  describe('#getTransactionCount', () => {
    beforeEach(async () => {
      const data = await core.dolomiteRegistry.populateTransaction.ownerSetChainlinkPriceOracle(OTHER_ADDRESS);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
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
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
      await dolomiteOwner.submitTransaction(core.dolomiteRegistry.address, 0, data.data!);
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
});
