import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { DolomiteAccountRegistry, DolomiteAccountRegistry__factory } from '../../src/types';
import { Network } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteAccountRegistryImplementation, createRegistryProxy } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('DolomiteAccountRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let implementation: DolomiteAccountRegistry;
  let registry: DolomiteAccountRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    implementation = await createDolomiteAccountRegistryImplementation();
    const calldata = await implementation.populateTransaction.initialize(
      [core.tokens.dArb.address, core.tokens.dGmx.address]
    );
    const registryProxy = await createRegistryProxy(implementation.address, calldata.data!, core);
    registry = DolomiteAccountRegistry__factory.connect(registryProxy.address, core.governance);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      const factories = await registry.getFactories();
      expect(factories[0]).to.equal(core.tokens.dArb.address);
      expect(factories[1]).to.equal(core.tokens.dGmx.address);
    });

    it('should fail to initialize if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          [core.tokens.dArb.address, core.tokens.dGmx.address]
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#registerVault', () => {
    it('should work normally', async () => {
      expect(await registry.isIsolationModeVault(OTHER_ADDRESS)).to.be.false;
      const res = await registry.connect(core.hhUser5).registerVault(core.hhUser1.address, OTHER_ADDRESS);
      await expectEvent(registry, res, 'VaultAddedToAccount', {
        account: core.hhUser1.address,
        vault: OTHER_ADDRESS,
      });
      expect(await registry.isIsolationModeVault(OTHER_ADDRESS)).to.be.true;
      expect(await registry.getAccountByVault(OTHER_ADDRESS)).to.equal(core.hhUser1.address);
      const vaults = await registry.getVaultsByAccount(core.hhUser1.address);
      expect(vaults.length).to.equal(1);
      expect(vaults[0]).to.equal(OTHER_ADDRESS);
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).registerVault(core.hhUser1.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetRestrictedAccount', () => {
    it('should work normally', async () => {
      expect(await registry.isRestrictedAccount(OTHER_ADDRESS)).to.be.false;
      const res = await registry.ownerSetRestrictedAccount(OTHER_ADDRESS, true);
      await expectEvent(registry, res, 'RestrictedAccountSet', {
        account: OTHER_ADDRESS,
        restricted: true,
      });
      expect(await registry.isRestrictedAccount(OTHER_ADDRESS)).to.be.true;
    });

    it('should fail if zero address', async () => {
      await expectThrow(
        registry.ownerSetRestrictedAccount(ZERO_ADDRESS, true),
        'DolomiteAccountRegistry: Invalid account',
      );
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetRestrictedAccount(OTHER_ADDRESS, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetTransferTokenOverride', () => {
    it('should work normally', async () => {
      expect(await registry.getTransferTokenOverride(core.tokens.dArb.address)).to.equal(ZERO_ADDRESS);
      const res = await registry.ownerSetTransferTokenOverride(core.tokens.dArb.address, OTHER_ADDRESS);
      await expectEvent(registry, res, 'TransferTokenOverrideSet', {
        token: core.tokens.dArb.address,
        override: OTHER_ADDRESS,
      });
      expect(await registry.getTransferTokenOverride(core.tokens.dArb.address)).to.equal(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetTransferTokenOverride(core.tokens.dArb.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#isIsolationModeVault', () => {
    it('should work normally', async () => {
      const vaultAddress = await core.arbEcosystem.live.dArb.calculateVaultByAccount(core.hhUser1.address);
      expect(await registry.isIsolationModeVault(vaultAddress)).to.be.false;
      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      expect(await registry.isIsolationModeVault(vaultAddress)).to.be.true;
    });
  });

  describe('#isAccountInRegistry', () => {
    it('should work normally', async () => {
      const vaultAddress = await core.arbEcosystem.live.dArb.calculateVaultByAccount(core.hhUser1.address);
      expect(await registry.isAccountInRegistry(vaultAddress)).to.be.false;

      await core.arbEcosystem.live.dArb.createVault(core.hhUser1.address);
      expect(await registry.isAccountInRegistry(vaultAddress)).to.be.true;

      expect(await registry.isRestrictedAccount(OTHER_ADDRESS)).to.be.false;
      await registry.ownerSetRestrictedAccount(OTHER_ADDRESS, true);
      expect(await registry.isAccountInRegistry(vaultAddress)).to.be.true;
    });
  });

  describe('#isTokenIsolationMode', () => {
    it('should work normally for standard factory', async () => {
      expect(await registry.isTokenIsolationMode(core.tokens.dArb.address)).to.be.true;
    });

    it('should work normally for dfsGlp', async () => {
      expect(await registry.isTokenIsolationMode(core.tokens.dfsGlp.address)).to.be.true;
    });

    it('should fail for non-factory token', async () => {
      expect(await registry.isTokenIsolationMode(core.tokens.usdc.address)).to.be.false;
    });

    it('should fail for address that does not implement name()', async () => {
      expect(await registry.isTokenIsolationMode(core.dolomiteMargin.address)).to.be.false;
    });
  });

  describe('#isMarketIdIsolationMode', () => {
    it('should work normally for standard factory', async () => {
      expect(await registry.isMarketIdIsolationMode(core.marketIds.dArb)).to.be.true;
    });

    it('should work normally for dfsGlp', async () => {
      expect(await registry.isMarketIdIsolationMode(core.marketIds.dfsGlp)).to.be.true;
    });

    it('should fail for non-factory token', async () => {
      expect(await registry.isMarketIdIsolationMode(core.marketIds.usdc)).to.be.false;
    });
  });
});
