import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from 'packages/base/src/utils/dolomite-utils';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsRegistry,
  IERC20,
  IInfraredVault,
  IInfraredVault__factory,
  INativeRewardVault,
  INativeRewardVault__factory,
  InfraredBGTIsolationModeTokenVaultV1,
  InfraredBGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
  InfraredBGTMetaVault,
  InfraredBGTMetaVault__factory,
} from '../src/types';
import {
  createBerachainRewardsRegistry,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
  RewardVaultType,
} from './berachain-ecosystem-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('BerachainRewardsRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let metaVaultImplementation: InfraredBGTMetaVault;

  let iBgtFactory: InfraredBGTIsolationModeVaultFactory;
  let iBgtVault: InfraredBGTIsolationModeTokenVaultV1;
  let iBgtMarketId: BigNumber;

  let asset: IERC20;
  let infraredVault: IInfraredVault;
  let nativeVault: INativeRewardVault;

  let factoryImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 1_342_200,
      network: Network.Berachain,
    });

    metaVaultImplementation = await createContractWithAbi<InfraredBGTMetaVault>(
      InfraredBGTMetaVault__factory.abi,
      InfraredBGTMetaVault__factory.bytecode,
      [],
    );
    registry = await createBerachainRewardsRegistry(core, metaVaultImplementation);

    const iBgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    iBgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.iBgt,
      iBgtVaultImplementation,
      core,
    );
    factoryImpersonator = await impersonate(iBgtFactory.address, true);

    iBgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(iBgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, iBgtFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(iBgtFactory.address, true);
    await iBgtFactory.connect(core.governance).ownerInitialize([]);

    asset = core.dolomiteTokens.weth!;
    infraredVault = IInfraredVault__factory.connect(
      await core.berachainRewardsEcosystem.infrared.vaultRegistry(asset.address),
      core.hhUser1
    );
    nativeVault = INativeRewardVault__factory.connect(
      await core.berachainRewardsEcosystem.berachainRewardsFactory.getVault(asset.address),
      core.hhUser1
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.bgt()).to.equal(core.tokens.bgt.address);
      expect(await registry.bgtm()).to.equal(core.berachainRewardsEcosystem.bgtm.address);
      expect(await registry.iBgt()).to.equal(core.tokens.iBgt.address);
      expect(await registry.wbera()).to.equal(core.tokens.wbera.address);

      expect(await registry.berachainRewardsFactory()).to.equal(
        core.berachainRewardsEcosystem.berachainRewardsFactory.address,
      );
      expect(await registry.iBgtStakingVault()).to.equal(core.berachainRewardsEcosystem.iBgtStakingPool.address);
      expect(await registry.infrared()).to.equal(core.berachainRewardsEcosystem.infrared.address);

      expect(await registry.metaVaultImplementation()).to.equal(metaVaultImplementation.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.tokens.bgt.address,
          core.berachainRewardsEcosystem.bgtm.address,
          core.tokens.iBgt.address,
          core.tokens.wbera.address,
          core.berachainRewardsEcosystem.berachainRewardsFactory.address,
          core.berachainRewardsEcosystem.iBgtStakingPool.address,
          core.berachainRewardsEcosystem.infrared.address,
          metaVaultImplementation.address,
          core.dolomiteRegistry.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#createMetaVault', () => {
    it('should work normally if no metaVault exists', async () => {
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      const result = await iBgtFactory.createVault(core.hhUser1.address);
      const vaultAddress = await iBgtFactory.getVaultByAccount(core.hhUser1.address);
      await expectEvent(registry, result, 'MetaVaultCreated', {
        account: core.hhUser1.address,
        metaVault: metaVaultAddress,
      });

      expect(await registry.getMetaVaultByAccount(core.hhUser1.address)).to.equal(metaVaultAddress);
      expect(await registry.getAccountByMetaVault(metaVaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getMetaVaultByVault(vaultAddress)).to.equal(metaVaultAddress);
    });

    it('should work normally if metaVault already exists', async () => {
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      await iBgtFactory.createVault(core.hhUser1.address);
      const vaultAddress = await iBgtFactory.getVaultByAccount(core.hhUser1.address);

      await registry.connect(factoryImpersonator).createMetaVault(core.hhUser1.address, vaultAddress);
      expect(await registry.getMetaVaultByAccount(core.hhUser1.address)).to.equal(metaVaultAddress);
      expect(await registry.getAccountByMetaVault(metaVaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getMetaVaultByVault(vaultAddress)).to.equal(metaVaultAddress);
    });

    it('should fail if not called by a factory', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        registry.connect(core.hhUser5).createMetaVault(core.hhUser5.address, OTHER_ADDRESS),
        `BerachainRewardsRegistry: Caller is not a valid factory <${core.hhUser5.addressLower}>`,
      );
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        registry.connect(core.hhUser5).createMetaVault(core.hhUser5.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser5.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setDefaultRewardVaultTypeFromMetaVaultByAsset', () => {
    it('should work normally if called by meta vault', async () => {
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, asset.address)).to.equal(
        RewardVaultType.Native,
      );
      const metaVaultAddress = await registry.calculateMetaVaultByAccount(core.hhUser1.address);
      await iBgtFactory.createVault(core.hhUser1.address);

      const metaVaultImpersonator = await impersonate(metaVaultAddress, true);
      const res = await registry
        .connect(metaVaultImpersonator)
        .setDefaultRewardVaultTypeFromMetaVaultByAsset(asset.address, RewardVaultType.Infrared);
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: asset.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(core.hhUser1.address, asset.address)).to.equal(
        RewardVaultType.Infrared,
      );
    });

    it('should fail if the caller is not the meta vault', async () => {
      await iBgtFactory.createVault(core.hhUser1.address);
      await expectThrow(
        registry.connect(core.hhUser1).setDefaultRewardVaultTypeFromMetaVaultByAsset(
          asset.address,
          RewardVaultType.Infrared,
        ),
        `BerachainRewardsRegistry: Unauthorized meta vault <${core.hhUser1.addressLower}>`,
      );
    });
  });

  describe('#ownerSetBerachainRewardsFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBerachainRewardsFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BerachainRewardsFactorySet', {
        berachainRewardsFactory: OTHER_ADDRESS,
      });
      expect(await registry.berachainRewardsFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBerachainRewardsFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid vault factory address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBerachainRewardsFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetInfrared', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetInfrared(OTHER_ADDRESS);
      await expectEvent(registry, result, 'InfraredSet', {
        infrared: OTHER_ADDRESS,
      });
      expect(await registry.infrared()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetInfrared(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid infrared address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetInfrared(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetBgt', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgt(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtSet', {
        bgt: OTHER_ADDRESS,
      });
      expect(await registry.bgt()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgt(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgt(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid BGT address',
      );
    });
  });

  describe('#ownerSetBgtm', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtm(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtmSet', {
        bgtm: OTHER_ADDRESS,
      });
      expect(await registry.bgtm()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtm(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid BGTM address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtm(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetIBgt', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgt(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtSet', {
        iBgt: OTHER_ADDRESS,
      });
      expect(await registry.iBgt()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgt(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgt(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBGT address',
      );
    });
  });

  describe('#ownerSetIBgtStakingVault', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgtStakingVault(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtStakingVaultSet', {
        iBgtStakingVault: OTHER_ADDRESS,
      });
      expect(await registry.iBgtStakingVault()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgtStakingVault(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgtStakingVault(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBgtStakingVault address',
      );
    });
  });

  describe('#ownerSetMetaVaultImplementation', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetaVaultImplementation(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetaVaultImplementationSet', {
        metaVaultImplementation: OTHER_ADDRESS,
      });
      expect(await registry.metaVaultImplementation()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetaVaultImplementation(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetaVaultImplementation(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid implementation address',
      );
    });
  });

  describe('#ownerSetBgtIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtIsolationModeVaultFactorySet', {
        bgtIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.bgtIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid bgt factory address',
      );
    });
  });

  describe('#ownerSetBgtmIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'BgtmIsolationModeVaultFactorySet', {
        bgtmIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.bgtmIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetBgtmIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid bgtm factory address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetBgtmIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetIBgtIsolationModeVaultFactory', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtIsolationModeVaultFactorySet', {
        iBgtIsolationModeVaultFactory: OTHER_ADDRESS,
      });
      expect(await registry.iBgtIsolationModeVaultFactory()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetIBgtIsolationModeVaultFactory(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid iBgt factory address',
      );
    });
  });

  describe('#ownerSetRewardVaultOverride', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetRewardVaultOverride(
        asset.address,
        RewardVaultType.Infrared,
        OTHER_ADDRESS,
      );
      await expectEvent(registry, result, 'RewardVaultOverrideSet', {
        asset: asset.address,
        rewardVaultType: RewardVaultType.Infrared,
        infraredVault: OTHER_ADDRESS,
      });
      expect(await registry.rewardVault(asset.address, RewardVaultType.Infrared)).to.equal(OTHER_ADDRESS);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry
          .connect(core.hhUser1)
          .ownerSetRewardVaultOverride(
            asset.address,
            RewardVaultType.Infrared,
            OTHER_ADDRESS,
          ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry
          .connect(core.governance)
          .ownerSetRewardVaultOverride(
            asset.address,
            RewardVaultType.Infrared,
            ADDRESS_ZERO,
          ),
        'BerachainRewardsRegistry: Invalid rewardVault address',
      );
    });
  });

  describe('#ownerSetWbera', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetWbera(OTHER_ADDRESS);
      await expectEvent(registry, result, 'WberaSet', {
        wbera: OTHER_ADDRESS,
      });
      expect(await registry.wbera()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetWbera(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid wbera address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetWbera(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetPolUnwrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPolUnwrapperTrader(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PolUnwrapperTraderSet', {
        polUnwrapperTrader: OTHER_ADDRESS,
      });
      expect(await registry.polUnwrapperTrader()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPolUnwrapperTrader(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid polUnwrapperTrader',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPolUnwrapperTrader(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetPolWrapperTrader', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPolWrapperTrader(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PolWrapperTraderSet', {
        polWrapperTrader: OTHER_ADDRESS,
      });
      expect(await registry.polWrapperTrader()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPolWrapperTrader(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid polWrapperTrader',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPolWrapperTrader(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetPolFeeAgent', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPolFeeAgent(OTHER_ADDRESS);
      await expectEvent(registry, result, 'PolFeeAgentSet', {
        polFeeAgent: OTHER_ADDRESS,
      });
      expect(await registry.polFeeAgent()).to.equal(OTHER_ADDRESS);
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPolFeeAgent(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid polFeeAgent address',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPolFeeAgent(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetPolFeePercentage', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetPolFeePercentage(parseEther('0.5'));
      await expectEvent(registry, result, 'PolFeePercentageSet', {
        polFeePercentage: parseEther('0.5'),
      });
      expect(await registry.polFeePercentage()).to.equal(parseEther('0.5'));
    });

    it('should fail if fee percentage is greater than 1', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetPolFeePercentage(parseEther('1.1')),
        'BerachainRewardsRegistry: Invalid polFeePercentage',
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetPolFeePercentage(parseEther('0.5')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#rewardVault', () => {
    it('should return the correct reward vault for native', async () => {
      expect(await registry.rewardVault(asset.address, RewardVaultType.Native)).to.equal(nativeVault.address);
    });

    it('should return the correct reward vault for infrared', async () => {
      expect(await registry.rewardVault(asset.address, RewardVaultType.Infrared)).to.equal(infraredVault.address);
    });

    it('should return the correct reward vault for bgtm', async () => {
      expect(await registry.rewardVault(asset.address, RewardVaultType.BGTM)).to.equal(nativeVault.address);
    });

    it('should return the correct reward vault if overridden', async () => {
      expect(await registry.rewardVault(asset.address, RewardVaultType.Infrared)).to.equal(infraredVault.address);

      await registry.connect(core.governance).ownerSetRewardVaultOverride(
        asset.address,
        RewardVaultType.Infrared,
        OTHER_ADDRESS
      );
      expect(await registry.rewardVault(asset.address, RewardVaultType.Infrared)).to.equal(OTHER_ADDRESS);
    });
  });
});
