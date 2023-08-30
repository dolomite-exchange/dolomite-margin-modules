import { BalanceCheckFlag } from "@dolomite-exchange/dolomite-margin";
import { expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { CustomTestToken, GmxRegistryV2, GmxV2IsolationModeTokenVaultV1, GmxV2IsolationModeTokenVaultV1__factory, GmxV2IsolationModeUnwrapperTraderV2, GmxV2IsolationModeVaultFactory, GmxV2IsolationModeWrapperTraderV2, GmxV2MarketTokenPriceOracle, IGmxMarketToken } from "src/types";
import { createTestToken, depositIntoDolomiteMargin } from "src/utils/dolomite-utils";
import { Network, ZERO_BI } from "src/utils/no-deps-constants";
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from "test/utils";
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from "test/utils/assertions";
import { createGmxRegistryV2, createGmxV2IsolationModeTokenVaultV1, createGmxV2IsolationModeUnwrapperTraderV2, createGmxV2IsolationModeVaultFactory, createGmxV2IsolationModeWrapperTraderV2, getInitiateWrappingParams } from "test/utils/ecosystem-token-utils/gmx";
import { CoreProtocol, disableInterestAccrual, setupCoreProtocol, setupGMBalance, setupTestMarket, setupUserVaultProxy, setupWETHBalance } from "test/utils/setup";
import { getSimpleZapParams } from "test/utils/zap-utils";

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = parseEther('1');
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';

describe('GmxV2IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let priceOracle: GmxV2MarketTokenPriceOracle;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;

  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.gmxEcosystem!.gmxEthUsdMarketToken.connect(core.hhUser1);
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1();
    gmxRegistryV2 = await createGmxRegistryV2(core);
    factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxRegistryV2,
        [], // initialAllowableDebtMarketIds
        [], // initialAllowableCollateralMarketIds
        core.gmxEcosystem!.gmxEthUsdMarketToken,
        userVaultImplementation
    );
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxRegistryV2);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxRegistryV2);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    // Use actual price oracle later
    await core.testEcosystem!.testPriceOracle!.setPrice(
      factory.address,
      '1000000000000000000000000000000',
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);

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

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await wrapper.connect(core.governance).setHandlerStatus(core.gmxEcosystem!.gmxDepositHandler.address, true);
    await wrapper.connect(core.governance).setHandlerStatus(core.gmxEcosystem!.gmxWithdrawalHandler.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
    });
  });

  describe('#initiateWrapping', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(borrowAccountNumber, core.marketIds.weth, amountWei, marketId, 1, wrapper);
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        {value: parseEther(".01")}
      );

      expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should fail if no funds are send with transaction', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, amountWei);

      const initiateWrappingParams = await getInitiateWrappingParams(borrowAccountNumber, core.marketIds.weth, amountWei, marketId, 1, wrapper);
      await expect(vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
      )).to.be.reverted;
    });

    it('should fail when vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);

      const initiateWrappingParams = await getInitiateWrappingParams(borrowAccountNumber, core.marketIds.usdc, 1000e6, marketId, 1, wrapper);
      await expectThrow(
        vault.connect(core.hhUser1).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          {value: amountWei}
        ),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });

    it('should fail if not vault owner', async () => {
      const initiateWrappingParams = await getInitiateWrappingParams(borrowAccountNumber, core.marketIds.usdc, 1000e6, marketId, 1, wrapper);
      await expectThrow(
        vault.connect(core.hhUser2).initiateWrapping(
          borrowAccountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          {value: amountWei}
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  xdescribe('#initiateUnwrapping', () => {});

  describe('#cancelDeposit', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        amountWei,
        BalanceCheckFlag.Both
      );

      const initiateWrappingParams = await getInitiateWrappingParams(borrowAccountNumber, core.marketIds.weth, amountWei, marketId, 1, wrapper);
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        {value: parseEther(".01")}
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      expect(await vault.isVaultFrozen()).to.eq(true);

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelDeposit(depositKey);
      expect(await vault.isVaultFrozen()).to.eq(false);
    });

    it('should fail if not called by vault owner', async () => {
      await expectThrow(
        vault.connect(core.hhUser2).cancelDeposit(DUMMY_DEPOSIT_KEY),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#shouldExecuteDepositIntoVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });
  });

  describe('#shouldExecuteWithdrawalFromVault', () => {
    it('should work normally', async () => {
      await setupGMBalance(core, core.hhUser1.address, amountWei, vault);
      await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, marketId, ZERO_BI);
      await expectProtocolBalance(core, vault, defaultAccountNumber, marketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(vault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.closeBorrowPositionWithOtherTokens(defaultAccountNumber, borrowAccountNumber, []),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.transferIntoPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, 0, amountWei, BalanceCheckFlag.Both),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      await expectThrow(
        vault.transferFromPositionWithOtherToken(defaultAccountNumber, borrowAccountNumber, 0, amountWei, BalanceCheckFlag.Both),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.addCollateralAndSwapExactInputForOutput(
            defaultAccountNumber,
            borrowAccountNumber,
            zapParams.marketIdsPath,
            zapParams.inputAmountWei,
            zapParams.minOutputAmountWei,
            zapParams.tradersPath,
            zapParams.makerAccounts,
            zapParams.userConfig,
          ),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      const zapParams = await getSimpleZapParams(otherMarketId1, amountWei, otherMarketId2, amountWei, core);
      await expectThrow(
        vault.swapExactInputForOutputAndRemoveCollateral(
            defaultAccountNumber,
            borrowAccountNumber,
            zapParams.marketIdsPath,
            zapParams.inputAmountWei,
            zapParams.minOutputAmountWei,
            zapParams.tradersPath,
            zapParams.makerAccounts,
            zapParams.userConfig,
          ),
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should fail if vault is frozen', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
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
        'GmxV2IsolationModeVaultV1: Vault is frozen',
      );
    });
  });

  describe("#setVaultFrozen", () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setVaultFrozen(true);
      expect(await vault.isVaultFrozen()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setVaultFrozen(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe("#setSourceIsWrapper", () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setSourceIsWrapper(true);
      expect(await vault.isSourceIsWrapper()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setSourceIsWrapper(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe("#setShouldSkipTransfer", () => {
    it('should work normally', async () => {
      const impersonatedFactory = await impersonate(factory.address, true);
      await vault.connect(impersonatedFactory).setShouldSkipTransfer(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(true);
    });

    it('should fail if not called by factory', async () => {
      await expectThrow(
        vault.connect(core.hhUser1).setShouldSkipTransfer(true),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});

async function mineBlocks(blockNumber: number) {
  while (blockNumber > 0) {
    blockNumber--;
    await ethers.provider.send('evm_mine', []);
  }
}