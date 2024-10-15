import { expect } from 'chai';
import {
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  BGTIsolationModeVaultFactory,
  INativeRewardVault,
  InfraredBGTIsolationModeVaultFactory,
  MetavaultOperator,
  MetavaultOperator__factory
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
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const amountWei = parseEther('.5');
const defaultAccountNumber = ZERO_BI;

describe('BGTIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let registry: BerachainRewardsRegistry;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let otherFactory: BerachainRewardsIsolationModeVaultFactory;
  let bgtFactory: BGTIsolationModeVaultFactory;
  let ibgtFactory: InfraredBGTIsolationModeVaultFactory;

  let underlyingToken: IERC20;
  let otherUnderlyingToken: IERC20;
  let nativeRewardVault: INativeRewardVault;

  let vaultImplementation: BerachainRewardsIsolationModeTokenVaultV1;
  let bgtVaultImplementation: BGTIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });

    underlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.asset;
    otherUnderlyingToken = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyWbera.asset;
    nativeRewardVault = core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.nativeRewardVault;

    const metavaultImplementation = await createContractWithAbi<BerachainRewardsMetavault>(
      BerachainRewardsMetavault__factory.abi,
      BerachainRewardsMetavault__factory.bytecode,
      [],
    );
    const metavaultOperator = await createContractWithAbi<MetavaultOperator>(
      MetavaultOperator__factory.abi,
      MetavaultOperator__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    registry = await createBerachainRewardsRegistry(core, metavaultImplementation, metavaultOperator);
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Native,
      nativeRewardVault.address
    );

    vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      underlyingToken,
      vaultImplementation,
      core,
    );
    otherFactory = await createBerachainRewardsIsolationModeVaultFactory(
      registry,
      otherUnderlyingToken,
      vaultImplementation,
      core,
    );
    bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
    bgtFactory = await createBGTIsolationModeVaultFactory(
      registry,
      core.tokens.bgt,
      bgtVaultImplementation,
      core,
    );
    const ibgtVaultImplementation = await createInfraredBGTIsolationModeTokenVaultV1();
    ibgtFactory = await createInfraredBGTIsolationModeVaultFactory(
      registry,
      core.tokens.ibgt,
      ibgtVaultImplementation,
      core,
    );

    await core.testEcosystem!.testPriceOracle.setPrice(ibgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, ibgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);

    bgtMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(bgtFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, bgtFactory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, otherFactory, true);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(otherFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(bgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(ibgtFactory.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(metavaultOperator.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([]);
    await otherFactory.connect(core.governance).ownerInitialize([]);
    await bgtFactory.connect(core.governance).ownerInitialize([]);
    await ibgtFactory.connect(core.governance).ownerInitialize([]);
    await registry.connect(core.governance).ownerSetBgtIsolationModeVaultFactory(bgtFactory.address);
    await registry.connect(core.governance).ownerSetIBgtIsolationModeVaultFactory(ibgtFactory.address);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should initialize variables properly', async () => {
      expect(await bgtFactory.berachainRewardsRegistry()).to.equal(registry.address);
      expect(await bgtFactory.UNDERLYING_TOKEN()).to.equal(core.tokens.bgt.address);
      expect(await bgtFactory.BORROW_POSITION_PROXY()).to.equal(core.borrowPositionProxyV2.address);
      expect(await bgtFactory.userVaultImplementation()).to.equal(bgtVaultImplementation.address);
      expect(await bgtFactory.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#depositIntoDolomiteMarginFromMetavault', () => {
    it('should work normally', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      const beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
        await beraFactory.getVaultByAccount(core.hhUser1.address),
        BerachainRewardsIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const metavault = BerachainRewardsMetavault__factory.connect(
        await registry.getAccountToMetavault(core.hhUser1.address),
        core.hhUser1,
      );
      const bgtVault = setupUserVaultProxy<BGTIsolationModeTokenVaultV1>(
        await bgtFactory.getVaultByAccount(core.hhUser1.address),
        BGTIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );
      const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
      await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await increase(10 * ONE_DAY_SECONDS);
      const bal = await metavault.callStatic.getReward(underlyingToken.address, RewardVaultType.Native);
      await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bal);
    });

    it('should fail if not called by owners metavault', async () => {
      await beraFactory.createVault(core.hhUser1.address);
      await expectThrow(
        bgtFactory.connect(core.hhUser1).depositIntoDolomiteMarginFromMetavault(
          core.hhUser1.address,
          ZERO_BI,
          ONE_ETH_BI
        ),
        'BGTIsolationModeVaultFactory: Can only deposit from metavault'
      );
    });
  });

  describe('#createVault', () => {
    it('should work normally if called by registry', async () => {
      const registryImpersonator = await impersonate(registry.address, true);
      const vaultAddress = await bgtFactory.calculateVaultByAccount(core.hhUser1.address);
      const res = await bgtFactory.connect(registryImpersonator).createVault(core.hhUser1.address);
      await expectEvent(bgtFactory, res, 'VaultCreated', {
        account: core.hhUser1.address,
        vault: vaultAddress
      });
    });

    it('should fail if not called by registry', async () => {
      await expectThrow(
        bgtFactory.connect(core.hhUser1).createVault(core.hhUser1.address),
        'BGTIsolationModeVaultFactory: Only registry can create vaults'
      );
    });
  });

  describe('#ownerSetBerachainRewardsRegistry', () => {
    it('should work normally', async () => {
      const result = await bgtFactory.connect(core.governance).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS);
      await expectEvent(bgtFactory, result, 'BerachainRewardsRegistrySet', {
        berachainRewardsRegistry: OTHER_ADDRESS,
      });
      expect(await bgtFactory.berachainRewardsRegistry()).to.equal(OTHER_ADDRESS);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        bgtFactory.connect(core.hhUser1).ownerSetBerachainRewardsRegistry(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      expect(await bgtFactory.allowableCollateralMarketIds()).to.deep.equal([]);
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally', async () => {
      expect(await bgtFactory.allowableDebtMarketIds()).to.deep.equal([]);
    });
  });
});
