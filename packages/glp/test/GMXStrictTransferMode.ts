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
  GLPIsolationModeTokenVaultV1,
  GLPIsolationModeTokenVaultV1__factory,
  GLPIsolationModeTokenVaultV2,
  GLPIsolationModeTokenVaultV2__factory,
  GMXIsolationModeTokenVaultV1,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory,
  GMXIsolationModeVaultFactory__factory,
  GmxRegistryV1,
  GmxRegistryV1__factory,
  IERC20,
  IIsolationModeVaultFactoryOld,
  IIsolationModeVaultFactoryOld__factory,
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
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

const gmxAmount = parseEther('10'); // 10 GMX
const usdcAmount = BigNumber.from('2000000000'); // 2,000 USDC
const amountWei = BigNumber.from('1250000000000000000000'); // 1,250 GLP tokens
const accountNumber = ZERO_BI;
const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

xdescribe('GMXStrictTransferMode', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gmxRegistry: GmxRegistryV1;
  let gmxFactory: GMXIsolationModeVaultFactory;
  let glpFactory: IIsolationModeVaultFactoryOld;
  let gmxVault: TestGMXIsolationModeTokenVaultV1;
  let glpVault: TestGLPIsolationModeTokenVaultV2;
  let otherImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 200_000_000,
      network: Network.ArbitrumOne,
    });

    gmxRegistry = GmxRegistryV1__factory.connect(
      core.gmxEcosystem.live.gmxRegistryProxy.address,
      core.governance
    );

    glpFactory = IIsolationModeVaultFactoryOld__factory.connect(
      core.gmxEcosystem.live.dGlp.address,
      core.governance
    );
    gmxFactory = GMXIsolationModeVaultFactory__factory.connect(
      core.gmxEcosystem.live.dGmx.address,
      core.governance
    );
    const glpVaultImplementation = await createTestGLPIsolationModeTokenVaultV2();
    const gmxVaultImplementation = await createTestGMXIsolationModeTokenVaultV1();
    // await glpFactory.setUserVaultImplementation(glpVaultImplementation.address);
    // await gmxFactory.ownerSetUserVaultImplementation(gmxVaultImplementation.address);

    const newGmxRegistry = await createContractWithAbi<GmxRegistryV1>(
      GmxRegistryV1__factory.abi,
      GmxRegistryV1__factory.bytecode,
      []
    );
    await core.gmxEcosystem.live.gmxRegistryProxy.connect(core.governance).upgradeTo(newGmxRegistry.address);
    await gmxRegistry.connect(core.governance).ownerSetGlpVaultFactory(glpFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetGmxVaultFactory(gmxFactory.address);
    await gmxRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);

    await gmxRegistry.ownerSetGmxRewardsRouter(core.gmxEcosystem.gmxRewardsRouterV3.address);
    const gmxGov = await impersonate(await core.gmxEcosystem.gmxRewardsRouterV3.gov());
    await core.gmxEcosystem.gmxRewardsRouterV3.connect(gmxGov).setInStrictTransferMode(true);

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

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(
      core.tokens.usdc.address,
      usdcAmount,
      ONE_BI,
      ONE_BI,
    );

    // use sGLP for approvals/transfers and fsGLP for checking balances
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1).approve(glpVault.address, MAX_UINT_256_BI);

    // Make sure distributor has high tokens per interval and enough esGMX
    await core.gmxEcosystem!.esGmxDistributorForStakedGmx.setTokensPerInterval('10333994708994708');
    const gov = await impersonate(GMX_GOV_MAP[Network.ArbitrumOne]!, true);
    await core.gmxEcosystem!.esGmx.connect(gov).mint(
      core.gmxEcosystem!.esGmxDistributorForStakedGmx.address,
      parseEther('100000000'),
    );
    otherImpersonator = await impersonate(OTHER_ADDRESS, true);

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
    await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    expect(await gmxVault.recipient()).to.eq(OTHER_ADDRESS);

    const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, glpAmount);
    await expectEvent(gmxVault, result, 'AccountTransferSignaled', {
      recipient: OTHER_ADDRESS
    });
    expect(await gmxVault.recipient()).to.eq(ADDRESS_ZERO);
    expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(OTHER_ADDRESS);
    expect(await gmxVault.isVaultFrozen()).to.be.true;
    expect(await glpVault.isVaultFrozen()).to.be.true;
    await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
    await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
  }

  describe('#requestAccountTransfer', () => {
    it('should work normally', async () => {
      const result = await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {
        recipient: OTHER_ADDRESS,
      });
      expect(await gmxVault.recipient()).to.eq(OTHER_ADDRESS);
      expect(await gmxVault.isVaultFrozen()).to.be.true;
      expect(await glpVault.isVaultFrozen()).to.be.true;
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        gmxVault.connect(core.hhUser2).requestAccountTransfer(OTHER_ADDRESS),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if transfer is already in progress', async () => {
      const result = await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectEvent(gmxVault, result, 'AccountTransferRequested', {
        recipient: OTHER_ADDRESS,
      });

      await expectThrow(
        gmxVault.requestAccountTransfer(OTHER_ADDRESS),
        'GMXIsolationModeTokenVaultV1: Transfer already in progress',
      );
    });
  });

  describe('#signalAccountTransfer', () => {
    it('should work normally with staked gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
    });

    it('should work normally with glp balance', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
    });

    it('should work normally with glp and gmx balance', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(gmxAmount);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(amountWei);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
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

      await freezeAndGetOraclePrice(gmxFactory);
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
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      const esGmxAmount = await core.gmxEcosystem.esGmx.balanceOf(glpVault.address);
      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);

      expect(await core.gmxEcosystem.esGmx.balanceOf(OTHER_ADDRESS)).to.eq(esGmxAmount);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
    });

    it('should work normally if user has no gmx or glp balance', async () => {
      await requestTransferAndSignal(ZERO_BI, ZERO_BI);

      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);
      expect(await gmxVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      expect(await glpVault.gmxBalanceOf()).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(glpVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(OTHER_ADDRESS)).to.gte(ZERO_BI);
      expect(await core.gmxEcosystem!.fsGlp.balanceOf(OTHER_ADDRESS)).to.eq(ZERO_BI);

      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
    });

    it('should cancel transfer if gmx virtual balance is incorrect', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      const result = await gmxVault.connect(core.hhUser5).signalAccountTransfer(ONE_BI, ZERO_BI);
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, gmxAmount);
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should cancel transfer if glp virtual balance is incorrect', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

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

      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).acceptTransfer(glpVault.address);
      await expectThrow(
        core.gmxEcosystem.gmxRewardsRouterV3.connect(otherImpersonator).signalTransfer(glpVault.address),
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
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      const result = await gmxVault.cancelAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);

      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should work normally with gmx bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await requestTransferAndSignal(gmxAmount, ZERO_BI);

      const result = await gmxVault.cancelAccountTransfer();
      await expectEvent(gmxVault, result, 'AccountTransferCanceled', {});
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, ZERO_BI);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should work normally with glp bal', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, ZERO_BI);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, amountWei);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should work normally with gmx and glp bal', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      await gmxVault.cancelAccountTransfer();
      expect(await core.gmxEcosystem.gmxRewardsRouterV3.pendingReceivers(glpVault.address)).to.eq(ADDRESS_ZERO);
      expect(await gmxVault.isVaultFrozen()).to.be.false;
      expect(await glpVault.isVaultFrozen()).to.be.false;
      await expectProtocolBalance(core, gmxVault.address, accountNumber, core.marketIds.dGmx, gmxAmount);
      await expectProtocolBalance(core, glpVault.address, accountNumber, core.marketIds.dfsGlp, amountWei);
      await expectThrow(
        gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if transfer was already cancelled by handler', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);

      await gmxVault.connect(core.hhUser5).signalAccountTransfer(gmxAmount, ZERO_BI);
      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Transfer not in progress'
      );
    });

    it('should fail if underlying balance is less than temp balance on glp vault', async () => {
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(ZERO_BI, amountWei);

      const glpVaultImpersonator = await impersonate(glpVault.address, true);
      await core.gmxEcosystem.sGlp.connect(glpVaultImpersonator).transfer(core.hhUser1.address, amountWei);

      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GLPIsolationModeTokenVaultV2: Invalid underlying balance of'
      );
    });

    it('should fail if underlying balance is less than temp balance on gmx vault', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, gmxVault);
      await gmxVault.depositIntoVaultForDolomiteMargin(accountNumber, gmxAmount);
      await glpVault.depositIntoVaultForDolomiteMargin(accountNumber, amountWei);
      await requestTransferAndSignal(gmxAmount, amountWei);

      const glpVaultImpersonator = await impersonate(glpVault.address, true);
      await core.gmxEcosystem.gmxRewardsRouterV3.connect(glpVaultImpersonator).unstakeGmx(gmxAmount);
      await core.tokens.gmx.connect(glpVaultImpersonator).transfer(core.hhUser1.address, gmxAmount);

      await expectThrow(
        gmxVault.cancelAccountTransfer(),
        'GMXIsolationModeTokenVaultV1: Invalid underlying balance of'
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

  describe.only('#acceptFullAccountTransfer', () => {
    it('should work when the glpVault has had no interactions with GMX and gmxVault does not exist', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await freezeAndGetOraclePrice(gmxFactory);
      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV3.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);

      await core.gmxEcosystem.sbfGmx.connect(core.hhUser1).approve(vaultAddress, MAX_UINT_256_BI);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await newVault.acceptFullAccountTransfer(core.hhUser1.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, core.marketIds.dGmx, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work when the glpVault has had no interactions with GMX and gmxVault does exist', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await freezeAndGetOraclePrice(gmxFactory);
      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV3.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem.sbfGmx.connect(core.hhUser1).approve(vaultAddress, MAX_UINT_256_BI);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, core.marketIds.dGmx, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work if glpVault is created after gmxVault', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await freezeAndGetOraclePrice(gmxFactory);
      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV3.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem.sbfGmx.connect(core.hhUser1).approve(vaultAddress, MAX_UINT_256_BI);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).signalTransfer(vaultAddress);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );

      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, core.marketIds.dGmx, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should work if gmxVault is already created and synced', async () => {
      await setupGMXBalance(core, core.hhUser1, gmxAmount, core.gmxEcosystem!.sGmx);
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeGmx(gmxAmount);
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address);

      await freezeAndGetOraclePrice(gmxFactory);
      await waitDays(30);
      await core.gmxEcosystem!.gmxRewardsRouterV3.handleRewards(true, false, true, false, true, true, true);
      const totalEsGmxAmount = await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address);
      const depositEsGmxAmount = totalEsGmxAmount.div(2);
      const balanceEsGmxAmount = totalEsGmxAmount.sub(depositEsGmxAmount);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).stakeEsGmx(depositEsGmxAmount);

      await gmxFactory.createVault(core.hhUser2.address);
      const gmxVault = setupUserVaultProxy<GMXIsolationModeTokenVaultV1>(
        await gmxFactory.getVaultByAccount(core.hhUser2.address),
        GMXIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem.sbfGmx.connect(core.hhUser1).approve(vaultAddress, MAX_UINT_256_BI);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser1).signalTransfer(vaultAddress);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV2>(
        vaultAddress,
        GLPIsolationModeTokenVaultV2__factory,
        core.hhUser2,
      );
      await newVault.acceptFullAccountTransfer(core.hhUser1.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(gmxVault.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(vaultAddress)).to.eq(balanceEsGmxAmount);
      expect((await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).eq(ZERO_BI)).to.eq(false);
      await expectProtocolBalance(core, gmxVault.address, 0, core.marketIds.dGmx, gmxAmount);
      expect(await newVault.hasSynced()).to.be.true;
    });

    it('should fail when triggered more than once on the same glpVault', async () => {
      await core.gmxEcosystem!.esGmxDistributorForStakedGlp.setTokensPerInterval('0');
      const usdcAmount = BigNumber.from('100000000'); // 100 USDC
      await setupUSDCBalance(core, core.hhUser2, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );
      const glpAmount = await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser2.address);

      const vaultAddress = await glpFactory.connect(core.hhUser2).calculateVaultByAccount(core.hhUser2.address);
      await core.gmxEcosystem.sbfGmx.connect(core.hhUser1).approve(vaultAddress, MAX_UINT_256_BI);
      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser2).signalTransfer(vaultAddress);
      await glpFactory.createVault(core.hhUser2.address);

      const newVault = setupUserVaultProxy<GLPIsolationModeTokenVaultV1>(
        vaultAddress,
        GLPIsolationModeTokenVaultV1__factory,
        core.hhUser2,
      );
      expect(await newVault.hasAcceptedFullAccountTransfer()).to.eq(false);
      await newVault.acceptFullAccountTransfer(core.hhUser2.address);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.esGmx.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      expect(await core.gmxEcosystem!.fsGlp.balanceOf(vaultAddress)).to.eq(glpAmount);
      expect(await core.gmxEcosystem!.sbfGmx.balanceOf(vaultAddress)).to.eq(ZERO_BI);

      expect(await newVault.hasAcceptedFullAccountTransfer()).to.eq(true);

      await setupUSDCBalance(core, core.hhUser2, usdcAmount, core.gmxEcosystem!.glpManager);
      await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser2).mintAndStakeGlp(
        core.tokens.usdc.address,
        usdcAmount,
        ONE_BI,
        ONE_BI,
      );

      await core.gmxEcosystem!.gmxRewardsRouterV3.connect(core.hhUser2).signalTransfer(vaultAddress);
      await expectThrow(
        newVault.acceptFullAccountTransfer(core.hhUser2.address),
        'GLPIsolationModeTokenVaultV2: Cannot transfer more than once',
      );
    });

    it('should fail when sender is the zero address', async () => {
      await expectThrow(
        glpVault.acceptFullAccountTransfer(ZERO_ADDRESS),
        'GLPIsolationModeTokenVaultV2: Invalid sender',
      );
    });

    it('should fail when reentrancy is triggered in the user glpVault', async () => {
      await expectThrow(
        glpVault.callAcceptFullAccountTransferAndTriggerReentrancy(core.hhUser1.address),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });

    it('should fail when not called by glpVault owner or factory', async () => {
      await expectThrow(
        glpVault.connect(core.hhUser2).acceptFullAccountTransfer(core.hhUser2.address),
        `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if vault is frozen', async () => {
      await gmxVault.requestAccountTransfer(OTHER_ADDRESS);
      await expectThrow(
        glpVault.connect(core.hhUser5).acceptFullAccountTransfer(glpVault.address),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });
  });

  async function freezeAndGetOraclePrice(token: IERC20): Promise<BigNumber> {
    const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token.address);
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
    return price.value;
  }
});
