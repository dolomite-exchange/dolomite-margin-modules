import { expect } from 'chai';
import {
  BerachainRewardsIsolationModeTokenVaultV1,
  BerachainRewardsIsolationModeTokenVaultV1__factory,
  BerachainRewardsIsolationModeVaultFactory,
  BerachainRewardsMetavault,
  BerachainRewardsMetavault__factory,
  BerachainRewardsRegistry,
  INativeRewardVault,
  MetavaultOperator,
  MetavaultOperator__factory,
  BGTIsolationModeVaultFactory,
  BGTIsolationModeTokenVaultV1,
  BGTIsolationModeTokenVaultV1__factory,
  InfraredBGTIsolationModeVaultFactory,
} from '../src/types';
import {
  IERC20,
} from '@dolomite-exchange/modules-base/src/types';
import {
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import {
  createBerachainRewardsIsolationModeTokenVaultV1,
  createBerachainRewardsIsolationModeVaultFactory,
  createBerachainRewardsRegistry,
  createBGTIsolationModeTokenVaultV1,
  createBGTIsolationModeVaultFactory,
  createInfraredBGTIsolationModeTokenVaultV1,
  createInfraredBGTIsolationModeVaultFactory,
} from './berachain-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';

const LP_TOKEN_WHALE_ADDRESS = '0x1293DA55eC372a94368Fa20E8DF69FaBc3320baE';
const defaultAccountNumber = ZERO_BI;
const amountWei = parseEther('.5');

enum RewardVaultType {
  Native,
  Infrared,
}

describe('BGTIsolationModeTokenVaultV1', () => {
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

  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let metavault: BerachainRewardsMetavault;
  let bgtVault: BGTIsolationModeTokenVaultV1;

  let bgtMarketId: BigNumber;
  let bgtBal: BigNumber;

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
    await registry.connect(core.governance).ownerSetRewardVault(
      underlyingToken.address,
      RewardVaultType.Infrared,
      core.berachainRewardsEcosystem.listedRewardAssets.bexHoneyUsdc.infraredRewardVault.address
    );

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
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
    const bgtVaultImplementation = await createBGTIsolationModeTokenVaultV1();
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

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    metavault = BerachainRewardsMetavault__factory.connect(
      await registry.getAccountToMetavault(core.hhUser1.address),
      core.hhUser1,
    );
    bgtVault = setupUserVaultProxy<BGTIsolationModeTokenVaultV1>(
      await bgtFactory.getVaultByAccount(core.hhUser1.address),
      BGTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    const lpWhale = await impersonate(LP_TOKEN_WHALE_ADDRESS);
    await underlyingToken.connect(lpWhale).transfer(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(beraVault.address, amountWei);

    await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
    await increase(10 * ONE_DAY_SECONDS);
    await metavault.getReward(underlyingToken.address, RewardVaultType.Native);

    bgtBal = await core.tokens.bgt.balanceOf(metavault.address);
    await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, bgtBal);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#setIsDepositSourceMetavault', () => {
    it('should work normally', async () => {
      expect(await bgtVault.isDepositSourceMetavault()).to.be.false;
      const metavaultImpersonator = await impersonate(metavault.address, true);
      const res = await bgtVault.connect(metavaultImpersonator).setIsDepositSourceMetavault(true);
      await expectEvent(bgtVault, res, 'IsDepositSourceMetavaultSet', {
        isDepositSourceMetavault: true,
      });
      expect(await bgtVault.isDepositSourceMetavault()).to.be.true;
    });

    it('should fail if not called by metavault', async () => {
      await expectThrow(
        bgtVault.connect(core.hhUser1).setIsDepositSourceMetavault(true),
        'BGTIsolationModeTokenVaultV1: Only metavault'
      );
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should always fail', async () => {
      await expectThrow(
        bgtVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'not implemented'
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally (do nothing)', async () => {
      const metavaultImpersonator = await impersonate(metavault.address, true);
      await bgtVault.connect(metavaultImpersonator).setIsDepositSourceMetavault(true);
      const bgtFactoryImpersonator = await impersonate(bgtFactory.address, true);
      await bgtVault.connect(bgtFactoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei);
    });

    it('should fail if isDepositSourceMetavault is false', async () => {
      const bgtFactoryImpersonator = await impersonate(bgtFactory.address, true);
      await expectThrow(
        bgtVault.connect(bgtFactoryImpersonator).executeDepositIntoVault(core.hhUser1.address, amountWei),
        'BGTIsolationModeTokenVaultV1: Only metavault can deposit'
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        bgtVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await expect(() => bgtVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, bgtBal))
        .to.changeEtherBalance(core.hhUser1, bgtBal);
      await expectProtocolBalance(core, bgtVault, defaultAccountNumber, bgtMarketId, ZERO_BI);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        bgtVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await bgtVault.registry()).to.equal(registry.address);
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work normally', async () => {
      expect(await bgtVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });
});