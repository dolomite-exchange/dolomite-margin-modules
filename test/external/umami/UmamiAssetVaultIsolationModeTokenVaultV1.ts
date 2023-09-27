import { expect } from 'chai';
import {
  CustomTestToken,
  IUmamiAggregateVault__factory,
  IUmamiAssetVault,
  TestUmamiAssetVaultIsolationModeTokenVaultV1,
  TestUmamiAssetVaultIsolationModeTokenVaultV1__factory,
  TestUmamiWithdrawalQueuer__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { BigNumber } from 'ethers';
import { createContractWithAbi, createTestToken, depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from 'test/utils/assertions';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { getSimpleZapParams } from 'test/utils/zap-utils';
import { parseEther } from '@ethersproject/units';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = parseEther('1');
const usdcAmount = BigNumber.from('1000000000'); // $1000

describe('UmamiAssetVaultIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let marketId: BigNumber;
  let vault: TestUmamiAssetVaultIsolationModeTokenVaultV1;
  let underlyingAmount: BigNumber;
  let impersonatedFactory: SignerWithAddress;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);
    underlyingToken = core.umamiEcosystem!.glpUsdc.connect(core.hhUser1);
    const userVaultImplementation = await createContractWithAbi<TestUmamiAssetVaultIsolationModeTokenVaultV1>(
      TestUmamiAssetVaultIsolationModeTokenVaultV1__factory.abi,
      TestUmamiAssetVaultIsolationModeTokenVaultV1__factory.bytecode,
      [core.tokens.weth.address],
    );

    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      userVaultImplementation,
    );
    impersonatedFactory = await impersonate(factory.address, true);
    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    const TestUmamiWithdrawalQueuer = await createContractWithAbi(
      TestUmamiWithdrawalQueuer__factory.abi,
      TestUmamiWithdrawalQueuer__factory.bytecode,
      []
    );
    await umamiRegistry.connect(core.governance).ownerSetWithdrawalQueuer(TestUmamiWithdrawalQueuer.address);
    await umamiRegistry.connect(core.governance).ownerSetUmamiUnwrapperTrader(unwrapper.address);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestUmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      TestUmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, underlyingToken);
    underlyingAmount = await underlyingToken.connect(core.hhUser1).previewDeposit(usdcAmount);
    await underlyingToken.connect(core.hhUser1).deposit(usdcAmount, core.hhUser1.address);

    await unwrapper.connect(core.governance).ownerSetIsHandler(core.hhUser2.address, true);

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, amountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, amountWei);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds(
      [marketId, core.marketIds.usdc, otherMarketId1, otherMarketId2]
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work', async () => {
      expect(await vault.WETH()).to.eq(core.tokens.weth.address);
    });
  });

  describe('#initiateUnwrapping', () => {
    it('should work', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        underlyingAmount,
        { value: parseEther('.0005') },
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        underlyingAmount,
        core.tokens.usdc.address,
        ONE_BI
      );

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, underlyingAmount);

      const impersonatedUnwrapper = await impersonate(unwrapper.address, true);
      await setupUSDCBalance(core, impersonatedUnwrapper, 100e6, core.hhUser5);
      await unwrapper.connect(core.hhUser2).afterWithdrawalExecution(withdrawalKey, 100e6);

      expect(await vault.isVaultFrozen()).to.be.false;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.usdc, 100e6);
    });

    it('should fail if the vault is frozen', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        'IsolationModeVaultV1Freezable: Vault is frozen',
      );
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).initiateUnwrapping(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).initiateUnwrapping(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.weth.address,
          ONE_BI
        ),
        'UmamiVaultIsolationModeVaultV1: Invalid output token',
      );
    });

    it('should fail if reentrant', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).callInitiateUnwrappingAndTriggerReentrancy(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#initiateUnwrappingForLiquidation', () => {
    it('should work normally', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        underlyingAmount,
        { value: parseEther('.0005') },
      );
      await vault.connect(core.hhUser5).initiateUnwrappingForLiquidation(
        borrowAccountNumber,
        underlyingAmount,
        core.tokens.usdc.address,
        ONE_BI
      );

      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, underlyingAmount);
    });

    it('should fail if not called by liquidator', async () => {
      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.hhUser2.address);
      await expectThrow(
        vault.connect(core.hhUser5).initiateUnwrappingForLiquidation(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        `UmamiVaultIsolationModeVaultV1: Only liquidator can call <${core.hhUser5.address.toLowerCase()}>`,
      );
    });

    it('should fail if inputAmount does not equal underlying amount', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        underlyingAmount,
        { value: parseEther('.0005') },
      );
      await expectThrow(
        vault.connect(core.hhUser5).initiateUnwrappingForLiquidation(
          borrowAccountNumber,
          underlyingAmount.sub(1),
          core.tokens.usdc.address,
          ONE_BI
        ),
        'UmamiVaultIsolationModeVaultV1: Invalid inputAmount',
      );
    });

    it('should fail if reentrant', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).callInitiateUnwrappingForLiquidationAndTriggerReentrancy(
          borrowAccountNumber,
          underlyingAmount,
          core.tokens.usdc.address,
          ONE_BI
        ),
        'IsolationModeTokenVaultV1: Reentrant call',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await vault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });

    it('should not fail if called by unwrapper', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await vault.connect(unwrapperImpersonator).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });

    it('should fail if not vault owner or unwrapper', async () => {
      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        vault.connect(core.hhUser2).swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'UmamiVaultIsolationModeVaultV1: Only owner or unwrapper can call',
      );
    });

    it('should fail if vault is frozen and called by owner', async () => {
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `UmamiVaultIsolationModeVaultV1: Only unwrapper can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should not fail if vault is frozen and called by unwrapper', async () => {
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await vault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        amountWei,
        BalanceCheckFlag.Both,
      );

      const outputAmount = amountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, outputAmount, core);
      await vault.connect(impersonatedFactory).setIsVaultFrozen(true);
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await vault.connect(unwrapperImpersonator).swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
    });
  });
  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {});
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {});
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work normally', async () => {});
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {});

    it('should fail if invalid execution fee', async () => {
      await expectThrow(
        vault.openBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          underlyingAmount,
          { value: parseEther('.0004') },
        ),
        'UmamiVaultIsolationModeVaultV1: Invalid execution fee',
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally', async () => {});
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally', async () => {});
  });

  describe('#executeDepositIntoVault', () => {
    it('should work normally', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, underlyingAmount);
      expect(await vault.virtualBalance()).to.eq(underlyingAmount);

      await expectWalletBalance(core.dolomiteMargin, factory, underlyingAmount);
      await expectWalletBalance(vault, underlyingToken, underlyingAmount);

      await expectTotalSupply(factory, underlyingAmount);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);
      expect(await vault.virtualBalance()).to.eq(ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, underlyingAmount);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail if transfer is skipped and vault is not frozen', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, ZERO_BI),
        'UmamiVaultIsolationModeVaultV1: Vault should be frozen',
      );
    });

    it('should fail if virtual balance does not equal real balance', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      const vaultImpersonator = await impersonate(vault.address, true);
      await underlyingToken.connect(vaultImpersonator).transfer(core.hhUser1.address, underlyingAmount.div(2));

      await expectThrow(
        vault.connect(impersonatedFactory).executeWithdrawalFromVault(core.hhUser1.address, underlyingAmount.div(2)),
        'UmamiVaultIsolationModeVaultV1: Virtual vs real balance mismatch',
      );
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, ONE_BI),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#setShouldSkipTransfer', () => {
    it('should work normally', async () => {
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      expect(await vault.shouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#dolomiteRegistry', () => {
    it('should work', async () => {
      expect(await vault.dolomiteRegistry()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#registry', () => {
    it('should work normally', async () => {
      expect(await vault.registry()).to.equal(umamiRegistry.address);
    });
  });

  describe('#virtualBalance', () => {
    it('should work normally', async () => {
      expect(await vault.virtualBalance()).to.equal(ZERO_BI);
    });
  });

  describe('#isExternalRedemptionPaused', () => {
    it('should work normally', async () => {
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });

    it('should be paused when aggregateVault pauses vault', async () => {
      const aggregateVault = IUmamiAggregateVault__factory.connect(
        await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).aggregateVault(),
        core.umamiEcosystem!.configurator,
      );

      expect(await vault.isExternalRedemptionPaused()).to.be.false;

      const admin = await impersonate(aggregateVault.address, true);
      await core.umamiEcosystem!.glpUsdc.connect(admin).pauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.true;

      await core.umamiEcosystem!.glpUsdc.connect(admin).unpauseDepositWithdraw();
      expect(await vault.isExternalRedemptionPaused()).to.be.false;
    });
  });

  describe('#isWaitingForCallback', () => {
    it('should return true if waiting for callback', async () => {
      await underlyingToken.connect(core.hhUser1).approve(vault.address, underlyingAmount);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, underlyingAmount);
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        underlyingAmount,
        { value: parseEther('.0005') },
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        underlyingAmount,
        core.tokens.usdc.address,
        ONE_BI
      );
      expect(await vault.isWaitingForCallback(borrowAccountNumber)).to.be.true;
    });

    it('should return false if not waiting for callback', async () => {
      expect(await vault.isWaitingForCallback(defaultAccountNumber)).to.be.false;
    });
  });

  describe('#refundExecutionFeeIfNecessary', () => {
    it('should work normally', async () => {});
  });
});
