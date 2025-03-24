import { DolomiteERC4626, DolomiteERC4626__factory, RegistryProxy__factory } from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupWETHBalance } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { createLiquidatorProxyV5 } from 'packages/base/test/utils/dolomite';
import {
  BerachainRewardsRegistry,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
  POLIsolationModeTokenVaultV1,
  POLIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createPOLIsolationModeTokenVaultV1,
  createPOLIsolationModeVaultFactory, createPolLiquidatorProxy,
} from './berachain-ecosystem-utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('POLIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let dToken: DolomiteERC4626;

  let factory: POLIsolationModeVaultFactory;
  let factory2: POLIsolationModeVaultFactory;
  let vaultImplementation: POLIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_679_500,
      network: Network.Berachain,
    });

    dToken = DolomiteERC4626__factory.connect(core.dolomiteTokens.weth!.address, core.hhUser1);
    const dToken2 = DolomiteERC4626__factory.connect(core.dolomiteTokens.usdc!.address, core.hhUser1);

    const liquidatorProxyV5 = await createLiquidatorProxyV5(core);
    const polLiquidatorProxy = await createPolLiquidatorProxy(core, liquidatorProxyV5);
    const metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation, polLiquidatorProxy);

    vaultImplementation = await createPOLIsolationModeTokenVaultV1();
    factory = await createPOLIsolationModeVaultFactory(core, registry, dToken, vaultImplementation, [], []);
    factory2 = await createPOLIsolationModeVaultFactory(core, registry, dToken2, vaultImplementation, [], []);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await core.testEcosystem!.testPriceOracle.setPrice(factory2.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);
    await setupTestMarket(core, factory2, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory2.address, true);
    await factory.connect(core.governance).ownerInitialize([]);
    await factory2.connect(core.governance).ownerInitialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await factory.berachainRewardsRegistry()).to.equal(registry.address);
      expect(await factory.UNDERLYING_TOKEN()).to.equal(dToken.address);
      expect(await factory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await factory.userVaultImplementation()).to.equal(vaultImplementation.address);
      expect(await factory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#createVault', () => {
    it('should create metaVault if it does not exist', async () => {
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      const res = await factory.createVault(core.hhUser1.address);
      await expectEvent(registry, res, 'MetaVaultCreated', {
        account: core.hhUser1.address,
        metaVault: metaVaultAddress,
      });
      await expectEvent(factory, res, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: metaVaultAddress
      });
      await expectEvent(factory, res, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: vaultAddress
      });
    });

    it('should not emit event if metaVault already exists', async () => {
      await factory2.connect(core.hhUser1).createVault(core.hhUser1.address);

      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      const res = await factory.createVault(core.hhUser1.address);
      await expectEvent(factory, res, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: vaultAddress
      });
      expect(res).to.emit(factory, 'VaultCreated').withArgs(core.hhUser1.address, metaVaultAddress).to.throw;
    });
  });

  describe('#ownerSetBerachainRewardsRegistry', () => {
    it('should work normally', async () => {
      const result = await factory.connect(core.governance).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS);
      await expectEvent(factory, result, 'BerachainRewardsRegistrySet', {
        berachainRewardsRegistry: OTHER_ADDRESS,
      });
      expect(await factory.berachainRewardsRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        factory.connect(core.hhUser1).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await factory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
