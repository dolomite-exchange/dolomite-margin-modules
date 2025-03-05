import { DolomiteERC4626, DolomiteERC4626__factory, IERC20 } from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetaVault,
  BerachainRewardsMetaVault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeVaultFactory,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { createDolomiteErc4626Proxy } from 'packages/base/test/utils/dolomite';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('POLIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let factory: BerachainRewardsIsolationModeVaultFactory;

  let dToken: DolomiteERC4626;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 10_000_000,
      network: Network.Berachain,
    });

    const dTokenProxy = await createDolomiteErc4626Proxy(core.marketIds.usdc, core);
    dToken = DolomiteERC4626__factory.connect(dTokenProxy.address, core.hhUser1);

    const metaVaultImplementation = await createContractWithAbi<BerachainRewardsMetaVault>(
      BerachainRewardsMetaVault__factory.abi,
      BerachainRewardsMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    factory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      dToken,
      vaultImplementation,
      core,
    );
    // const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    // bgtFactory = await createBGTIsolationModeVaultFactory(registry, core.tokens.bgt, bgtVaultImplementation, core);
    // const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    // iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
    //   registry,
    //   core.tokens.iBgt,
    //   iBgtVaultImplementation,
    //   core,
    // );

    // await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    // await setupTestMarket(core, iBgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);

    // await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    // await setupTestMarket(core, bgtFactory, true);

    // await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    // await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    // await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    // await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    // await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);
    // await otherFactory.connect(core.governance).ownerInitialize([]);
    // await bgtFactory.connect(core.governance).ownerInitialize([]);
    // await iBgtFactory.connect(core.governance).ownerInitialize([]);
    // await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    // await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(iBgtFactory.address);

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
      const res = await factory.createVault(core.hhUser1.address);
      await expectEvent(registry, res, 'MetaVaultCreated', {
        account: core.hhUser1.address,
        metaVault: metaVaultAddress,
      });
    });

    xit('should not create metaVault if it already exists', async () => {
      await factory.createVault(core.hhUser1.address);
      await expect(factory.createVault(core.hhUser1.address)).to.not.emit(registry, 'MetaVaultCreated');
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
