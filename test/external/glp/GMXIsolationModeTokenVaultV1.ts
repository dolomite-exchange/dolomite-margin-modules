import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  GLPIsolationModeVaultFactory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GmxRegistryV1,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
} from '../../../src/types';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot, waitDays } from '../../utils';
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '../../utils/assertions';
import {
  createGLPIsolationModeVaultFactory,
  createGMXIsolationModeTokenVaultV1,
  createGMXIsolationModeVaultFactory,
  createGmxRegistry,
  createTestGLPIsolationModeTokenVaultV2
} from '../../utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGMXBalance,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING } from './glp-utils';

const gmxAmount = BigNumber.from('10000000000000000000'); // 10 GMX
const esGmxAmount = BigNumber.from('10000000000000000'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;

describe('GMXIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistry: GmxRegistryV1;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: GLPIsolationModeVaultFactory;
  let gmxVault: GMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let underlyingMarketIdGmx: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: DEFAULT_BLOCK_NUMBER_FOR_GLP_WITH_VESTING,
      network: Network.ArbitrumOne,
    });

    gmxRegistry = await createGmxRegistry(core);

    const glpVaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    glpFactory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, glpVaultImplementation);
    const vaultImplementation = await createGMXIsolationModeTokenVaultV1();
    gmxFactory = await createGMXIsolationModeVaultFactory(core, gmxRegistry, vaultImplementation);

    await core.testEcosystem!.testPriceOracle.setPrice(glpFactory.address, '1000000000000000000');
    await setupTestMarket(core, glpFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(glpFactory.address, true);
    await glpFactory.connect(core.governance).ownerInitialize([]);

    underlyingMarketIdGmx = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(gmxFactory.address, '1000000000000000000');
    await setupTestMarket(core, gmxFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(gmxFactory.address, true);
    await gmxFactory.connect(core.governance).ownerInitialize([]);

    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      GMXIsolationModeTokenVaultV1__factory,
      core.hhUser1
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1
    );

    await core.gmxEcosystem!.esGmxDistributor.setTokensPerInterval('10333994708994708');

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  async function doHandleRewardsWithWaitTime(daysToWait: number) {
    if (daysToWait > 0) {
      await waitDays(daysToWait);
    }
    await glpVault.handleRewardsWithSpecificDepositAccountNumber(
      true,
      false,
      true,
      false,
      true,
      true,
      false,
      accountNumber,
    );
  }

  describe('#stakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.connect(core.hhUser1).stakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
    });

    it('should work when GMX is already approved for staking', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.setApprovalForGmxForStaking(gmxAmount.div(2)); // use an amount < gmxAmount
      await gmxVault.stakeGmx(gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).stakeGmx(gmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unstakeGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.connect(core.hhUser1).stakeGmx(gmxAmount);

      await gmxVault.connect(core.hhUser1).unstakeGmx(gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).unstakeGmx(gmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#vestGmx', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.stakeGmx(gmxAmount);

      expect(await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount)).to.eq(ZERO_BI);
      await doHandleRewardsWithWaitTime(30);
      const gmxAmountVested = await glpVault.getGmxAmountNeededForEsGmxVesting(esGmxAmount);
      await gmxVault.vestGmx(esGmxAmount);

      expect(await core.gmxEcosystem!.vGmx.pairAmounts(glpVault.address)).to.eq(gmxAmountVested);
      // the amount of GMX in the vault should be unchanged if some of it moves into vesting
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address))
        .gt(gmxAmount.sub(gmxAmountVested))).to.eq(true);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).vestGmx(esGmxAmount),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#unvestGmx', () => {
    it('should work when GMX is re-staked', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.stakeGmx(gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(true);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount.add(esGmxAmount));
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingMarketIdGmx,
        gmxAmount.add(esGmxAmount)
      );
    });

    it('should work when vested GMX is withdrawn', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.stakeGmx(gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      await waitDays(366);
      await gmxVault.unvestGmx(false);

      expect(await glpVault.gmxBalanceOf()).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.eq(esGmxAmount);
      await expectProtocolBalance(
        core,
        gmxVault.address,
        accountNumber,
        underlyingMarketIdGmx,
        gmxAmount.add(esGmxAmount)
      );
    });

    it('should fail when not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).unvestGmx(false),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally with should skip transfer is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(true);

      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.gmx.balanceOf(core.hhUser1.address)).to.eq(gmxAmount);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should work normally with is deposit source GLP vault is true', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);
      const glpVaultImpersonator = await impersonate(await glpFactory.getVaultByAccount(core.hhUser1.address), true);
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(true);
      await setupGMXBalance(core, glpVaultImpersonator, gmxAmount, gmxVault);

      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.eq(gmxAmount);
      expect(await core.gmxEcosystem!.gmx.balanceOf(glpVaultImpersonator.address)).to.eq(ZERO_BI);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, gmxAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.gmxEcosystem!.gmx, gmxAmount);
    });

    it('should work when have to unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.connect(core.hhUser1).depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.connect(core.hhUser1).stakeGmx(gmxAmount);

      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.gmxEcosystem!.gmx, gmxAmount);
    });

    it('should work normally when have to unvest & unstake GMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.stakeGmx(gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      const vaultAccount = { owner: gmxVault.address, number: accountNumber };
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await expectWalletBalance(glpVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.gmxEcosystem!.gmx, gmxAmount);
      expect((await core.dolomiteMargin.getAccountWei(vaultAccount, underlyingMarketIdGmx)).value).to.be.gt(ZERO_BI);
      expect(await core.gmxEcosystem!.gmx.balanceOf(gmxVault.address)).to.be.gt(ZERO_BI);
    });

    it('should work normally when unvest, unstake, and sweep', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.stakeGmx(gmxAmount);

      await doHandleRewardsWithWaitTime(30);
      await gmxVault.vestGmx(esGmxAmount);
      await waitDays(366);
      await gmxVault.connect(core.hhUser1).withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);

      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      await expectWalletBalance(glpVault.address, core.gmxEcosystem!.gmx, ZERO_BI);
      await expectWalletBalance(core.hhUser1.address, core.gmxEcosystem!.gmx, gmxAmount);
      await expectWalletBalance(gmxVault.address, core.gmxEcosystem!.gmx, esGmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, esGmxAmount);
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, gmxAmount),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);

      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(true);
      expect(await gmxVault.shouldSkipTransfer()).to.be.true;
      await gmxVault.connect(factoryImpersonator).setShouldSkipTransfer(false);
      expect(await gmxVault.shouldSkipTransfer()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setIsDepositSourceGLPVault', () => {
    it('should work normally', async () => {
      const factoryImpersonator = await impersonate(gmxFactory.address, true);

      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(true);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.true;
      await gmxVault.connect(factoryImpersonator).setIsDepositSourceGLPVault(false);
      expect(await gmxVault.isDepositSourceGLPVault()).to.be.false;
    });

    it('should fail if not called by the factory', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).setIsDepositSourceGLPVault(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await gmxVault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work', async () => {
      expect(await gmxVault.registry()).to.equal(gmxRegistry.address);
    });
  });

});
