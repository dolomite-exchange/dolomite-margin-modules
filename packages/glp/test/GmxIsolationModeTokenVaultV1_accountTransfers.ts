import { GMX_GOV_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitDays,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  setupCoreProtocol,
  setupGMXBalance,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  AccountTransferReceiver,
  AccountTransferReceiver__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IGLPIsolationModeVaultFactoryOld,
  IGMXIsolationModeVaultFactory,
  SignalAccountTransferImplementation,
  SignalAccountTransferImplementation__factory,
  TestGLPIsolationModeTokenVaultV2,
  TestGLPIsolationModeTokenVaultV2__factory,
  TestGMXIsolationModeTokenVaultV1,
  TestGMXIsolationModeTokenVaultV1__factory,
} from '../src/types';
import {
  createTestGLPIsolationModeTokenVaultV2,
  createTestGMXIsolationModeTokenVaultV1,
} from './glp-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { freezeAndGetOraclePrice } from 'packages/base/test/utils/dolomite';

const gmxAmount = parseEther('10'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const esGmxAmount = parseEther('0.01'); // 0.01 esGMX tokens
const accountNumber = ZERO_BI;

describe('GMXIsolationModeTokenVaultV1_accountTransfers', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxFactory: IGMXIsolationModeVaultFactory;
  let glpFactory: IGLPIsolationModeVaultFactoryOld;
  let gmxVault: TestGMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let underlyingMarketIdGlp: BigNumber;
  let underlyingMarketIdGmx: BigNumber;
  let otherImpersonator: SignerWithAddressWithSafety;
  let transferReceiver: AccountTransferReceiver;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 249_700_000,
      network: Network.ArbitrumOne,
    });

    const glpVaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    const vaultImplementation = await createTestGMXIsolationModeTokenVaultV1();
    glpFactory = core.gmxEcosystem!.live.dGlp.connect(core.hhUser1);
    gmxFactory = core.gmxEcosystem!.live.dGmx.connect(core.hhUser1);
    await glpFactory.connect(core.governance).setUserVaultImplementation(glpVaultImplementation.address);
    await gmxFactory.connect(core.governance).ownerSetUserVaultImplementation(vaultImplementation.address);
    underlyingMarketIdGmx = BigNumber.from(core.marketIds.dGmx);
    underlyingMarketIdGlp = BigNumber.from(core.marketIds.dfsGlp);

    const gmxRegistryImplementation = await createContractWithAbi<GmxRegistryV1>(
      GmxRegistryV1__factory.abi,
      GmxRegistryV1__factory.bytecode,
      []
    );
    const signalAccountTransferImpl = await createContractWithAbi<SignalAccountTransferImplementation>(
      SignalAccountTransferImplementation__factory.abi,
      SignalAccountTransferImplementation__factory.bytecode,
      []
    );
    await core.gmxEcosystem!.live.gmxRegistryProxy.upgradeTo(gmxRegistryImplementation.address);
    await core.gmxEcosystem.live.gmxRegistry.ownerSetIsHandler(core.hhUser5.address, true);
    await core.gmxEcosystem.live.gmxRegistry.ownerSetSignalAccountTransferImpl(signalAccountTransferImpl.address);

    await gmxFactory.createVault(core.hhUser1.address);
    gmxVault = setupUserVaultProxy<TestGMXIsolationModeTokenVaultV1>(
      await gmxFactory.getVaultByAccount(core.hhUser1.address),
      TestGMXIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    glpVault = setupUserVaultProxy<TestGLPIsolationModeTokenVaultV2>(
      await glpFactory.getVaultByAccount(core.hhUser1.address),
      TestGLPIsolationModeTokenVaultV2__factory,
      core.hhUser1,
    );
    transferReceiver = AccountTransferReceiver__factory.connect(
      await glpVault.getAccountTransferOutReceiverAddress(),
      core.hhUser1
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
      core.tokens.usdc.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );
    // // use sGLP for approvals/transfers and fsGLP for checking balances
    const glpAmount = await core.gmxEcosystem!.fsGlp.connect(core.hhUser1).balanceOf(core.hhUser1.address);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);
    // await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

    // Make sure distributor has high tokens per interval and enough esGMX
    await core.gmxEcosystem!.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core.gmxEcosystem!.esGmx.connect(gov).mint(
      core.gmxEcosystem!.esGmxDistributorForStakedGmx.address,
      parseEther('100000000'),
    );
    otherImpersonator = await impersonate(transferReceiver.address, true);

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

  async function requestTransferAndSignal(gmxAmount: BigNumber, glpAmount: BigNumber) {
    await gmxVault.requestAccountTransfer();
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    expect(await gmxVault.transferRequested()).to.eq(true);

    const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, glpAmount);
    // @follow-up Do we want to change this event at all to have the recipient? Come from glpVault maybe?
    await expectEvent(gmxVault, result, 'AccountTransferSignaled', {});
    expect(await gmxVault.transferRequested()).to.eq(false);
    expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
  }

  describe('#requestAccountTransfer', () => {
    it('should work normally', async () => {
      const result = await gmxVault.requestAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {});
      expect(await gmxVault.transferRequested()).to.eq(true);
      expect(await gmxVault.isVaultFrozen()).to.be.true;
      expect(await glpVault.isVaultFrozen()).to.be.true;
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).requestAccountTransfer(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer is already in progress', async () => {
      const result = await gmxVault.requestAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {});

      await expectThrow(
        gmxVault.requestAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer already in progress',
      );
    });
  });

  describe('#signalAccountTransfer', () => {
    it('should work normally with staked gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.gte(gmxAmount);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with glp balance', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with glp and gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally after previously canceling a transfer', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);

      await gmxVault.requestAccountTransfer();
      await gmxVault.cancelAccountTransfer();

      await requestTransferAndSignal(gmxAmount, amountWei);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally with both balances and transfer to account from receiver', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);

      await transferReceiver.connect(core.hhUser1).signalAccountTransfer(core.hhUser3.address);
      await core.gmxEcosystem.gmxRewardsRouterV3.connect(core.hhUser3).acceptTransfer(transferReceiver.address);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser3.address)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser3.address)).to.eq(amountWei);
    });

    it('should work normally when need to stake gmx', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.unstakeGmx(gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);
      expect(await core.gmxEcosystem.gmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
    });

    it('should work normally if user has no gmx or glp balance but has esGMX', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await freezeAndGetOraclePrice(core, gmxFactory as any);
      await waitDays(30);
      await glpVault.handleRewards(
        true,
        false,
        true,
        false,
        true,
        true,
        false,
      );
      await gmxVault.withdrawFromVaultForDolomiteMargin(accountNumber, gmxAmount);
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
      const esGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      expect(await core.gmxEcosystem.esGmx.balanceOf(transferReceiver.address)).to.eq(esGmxAmount);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should work normally if user has no gmx or glp balance', async () => {
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(transferReceiver.address)).to.gte(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(transferReceiver.address)).to.eq(ZERO_BI);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);
    });

    it('should cancel transfer if gmx virtual balance is incorrect', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer();

      const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(ONE_BI, ZERO_BI);
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should cancel transfer if glp virtual balance is incorrect', async () => {
      await gmxVault.requestAccountTransfer();

      const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(ZERO_BI, ONE_BI);
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('transfer back and forth FAILS', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.requestAccountTransfer();
      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await expectThrow(
        transferReceiver.connect(core.hhUser1).signalAccountTransfer(glpVault.address)
      );
    });

    it('should fail if user has already transferred out', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);

      await gmxVault.requestAccountTransfer();
      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);

      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer();
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GLPIsolationModeTokenVaultV2: Cannot transfer more than once'
      );
    });

    it('should fail if GLP vault is not called by GMX vault', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser1).signalAccountTransfer(0),
        'GLPIsolationModeTokenVaultV2: Invalid GMX vault'
      );
    });

    it('should fail if no transfer is requested', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser1).signalAccountTransfer(gmxAmount, ZERO_BI),
        `GMXIsolationModeTokenVaultV1: Invalid handler <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#cancelAccountTransfer', () => {
    it('should work normally after user requests transfer', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer();

      const result = await gmxVault.cancelAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, underlyingMarketIdGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, underlyingMarketIdGlp, ZERO_BI);

      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if transfer was already cancelled by handler', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await gmxVault.requestAccountTransfer();

      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if there is no transfer in progress', async () => {
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress',
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).cancelAccountTransfer(),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });
});
