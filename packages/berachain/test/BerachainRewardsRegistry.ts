import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  IBeraRewardVault,
  IERC20,
  IInfraredVault,
  MetavaultOperator,
  MetavaultOperator__factory
} from '../src/types';
import {
  ADDRESS_ZERO,
  Network,
  ONE_ETH_BI,
  ZERO_BI
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  RewardVaultType
} from './berachain-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { parseEther } from 'ethers/lib/utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.1');

describe('BerachainRewardsRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let factory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;
  let metavaultImplementation: BerachainRewardsMetavault;
  let metavaultOperator: MetavaultOperator;
  let nativeRewardVault: IBeraRewardVault;
  let infraredRewardVault: IInfraredVault;

  let factoryImpersonator: SignerWithAddressWithSafety;
  let otherFactoryImperonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;
    infraredRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault;

    metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    factory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core
    );
    factoryImpersonator = await impersonate(factory.address);
    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_ETH_BI);
    await setupTestMarket(core, factory, true);

    otherFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      otherUnderlyingToken,
      vaultImplementation,
      core
    );
    otherFactoryImperonator = await impersonate(otherFactory.address);
    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize variables properly', async () => {
      expect(await registry.bgt()).to.equal(core.tokens.bgt.address);
      expect(await registry.iBgt()).to.equal(core.tokens.ibgt.address);
      expect(await registry.metavaultImplementation()).to.equal(metavaultImplementation.address);
      expect(await registry.metavaultOperator()).to.equal(metavaultOperator.address);
      expect(await registry.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });

    it('should fail if already initialized', async () => {
      await expectThrow(
        registry.initialize(
          core.tokens.bgt.address,
          core.tokens.ibgt.address,
          metavaultImplementation.address,
          metavaultOperator.address,
          core.dolomiteRegistry.address
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#createMetavault', () => {
    it('should work normally if no metavault exists', async () => {
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);
      const result = await factory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });

      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      expect(await registry.getAccountToMetavault(core.hhUser1.address)).to.equal(metavaultAddress);
      expect(await registry.getMetavaultToAccount(metavaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getVaultToMetavault(vaultAddress)).to.equal(metavaultAddress);
    });

    it('should work normally if metavault already exists', async () => {
      const vaultAddress = await factory.calculateVaultByAccount(core.hhUser1.address);
      const otherVaultAddress = await otherFactory.calculateVaultByAccount(core.hhUser1.address);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);

      const result = await factory.createVault(core.hhUser1.address);
      await expectEvent(registry, result, 'MetavaultCreated', {
        account: core.hhUser1.address,
        metavault: metavaultAddress,
      });

      await otherFactory.createVault(core.hhUser1.address);
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      expect(await registry.getAccountToMetavault(core.hhUser1.address)).to.equal(metavaultAddress);
      expect(await registry.getMetavaultToAccount(metavaultAddress)).to.equal(core.hhUser1.address);
      expect(await registry.getVaultToMetavault(vaultAddress)).to.equal(metavaultAddress);
      expect(await registry.getVaultToMetavault(otherVaultAddress)).to.equal(metavaultAddress);
    });

    // test fails during coverage because asserts are hidden
    xit('should fail if not called by factory', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        registry.connect(core.hhUser5).createMetavault(core.hhUser5.address, OTHER_ADDRESS),
      );
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        registry.connect(core.hhUser5).createMetavault(core.hhUser5.address, OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser5.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setAccountToAssetToDefaultType', () => {
    it('should work normally if called by user', async () => {
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Native,
        nativeRewardVault.address
      );
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Infrared,
        infraredRewardVault.address
      );
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      const res = await registry.connect(core.hhUser1).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Infrared);
    });

    it('should work normally if called by metavault', async () => {
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Native,
        nativeRewardVault.address
      );
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Infrared,
        infraredRewardVault.address
      );
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Native);
      const metavaultAddress = await registry.calculateMetavaultByAccount(core.hhUser1.address);
      await factory.createVault(core.hhUser1.address);

      const metavaultImpersonator = await impersonate(metavaultAddress, true);
      const res = await registry.connect(metavaultImpersonator).setAccountToAssetToDefaultType(
        underlyingToken.address,
        RewardVaultType.Infrared
      );
      await expectEvent(registry, res, 'AccountToAssetToDefaultTypeSet', {
        account: core.hhUser1.address,
        asset: underlyingToken.address,
        type: RewardVaultType.Infrared,
      });
      expect(await registry.getAccountToAssetToDefaultType(
        core.hhUser1.address,
        underlyingToken.address
      )).to.equal(RewardVaultType.Infrared);
    });

    it('should fail if user has staked balance in default type', async () => {
      await factory.createVault(core.hhUser1.address);
      const beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
        await factory.getVaultByAccount(core.hhUser1.address),
        BerachainRewardsIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Native,
        nativeRewardVault.address
      );
      await registry.connect(core.governance).ownerSetRewardVault(
        underlyingToken.address,
        RewardVaultType.Infrared,
        infraredRewardVault.address
      );

      const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
      await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectThrow(
        registry.setAccountToAssetToDefaultType(underlyingToken.address, RewardVaultType.Infrared),
        'BerachainRewardsRegistry: Default type not empty'
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

  describe('#ownerSetIBgt', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetIBgt(OTHER_ADDRESS);
      await expectEvent(registry, result, 'IBgtSet', {
        ibgt: OTHER_ADDRESS,
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

  describe('#ownerSetMetavaultImplementation', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetavaultImplementation(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetavaultImplementationSet', {
        metavaultImplementation: OTHER_ADDRESS,
      });
      expect(await registry.metavaultImplementation()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetavaultImplementation(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetavaultImplementation(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid implementation address',
      );
    });
  });

  describe('#ownerSetMetavaultOperator', () => {
    it('should work normally', async () => {
      const result = await registry.connect(core.governance).ownerSetMetavaultOperator(OTHER_ADDRESS);
      await expectEvent(registry, result, 'MetavaultOperatorSet', {
        metavaultOperator: OTHER_ADDRESS,
      });
      expect(await registry.metavaultOperator()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetMetavaultOperator(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetMetavaultOperator(ADDRESS_ZERO),
        'BerachainRewardsRegistry: Invalid operator address',
      );
    });
  });

  describe('#ownerSetRewardVault', () => {
    it('should work normally', async () => {
      const asset = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address;
      const rewardVaultType = RewardVaultType.Native;
      const rewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address;

      const result = await registry.connect(core.governance).ownerSetRewardVault(
        asset,
        rewardVaultType,
        rewardVault
      );
      await expectEvent(registry, result, 'RewardVaultSet', {
        asset,
        rewardVaultType,
        rewardVault
      });
      expect(await registry.rewardVault(asset, rewardVaultType)).to.equal(rewardVault);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        registry.connect(core.hhUser1).ownerSetRewardVault(
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
          RewardVaultType.Native,
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault.address
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if zero address is set', async () => {
      await expectThrow(
        registry.connect(core.governance).ownerSetRewardVault(
          core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset.address,
          RewardVaultType.Native,
          ADDRESS_ZERO
        ),
        'BerachainRewardsRegistry: Invalid rewardVault address',
      );
    });
  });
});
