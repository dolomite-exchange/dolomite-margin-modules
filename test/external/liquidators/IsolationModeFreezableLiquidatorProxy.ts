import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
  IGmxMarketToken__factory,
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '../../../src/types';
import { AccountStruct } from '../../../src/utils/constants';
import { GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../../src/utils/dolomite-utils';
import { NO_EXPIRY, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectProtocolBalance, expectWalletBalance } from '../../utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2MarketTokenPriceOracle,
  getOracleParams,
} from '../../utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '../../utils/setup';

const CALLBACK_GAS_LIMIT = BigNumber.from('1500000');

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234

describe('IsolationModeFreezableLiquidatorProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let liquidatorProxy: IsolationModeFreezableLiquidatorProxy;

  let liquidAccount: AccountStruct;
  let liquidAccount2: AccountStruct;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());

    const newImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.upgradeTo(newImplementation.address);

    liquidatorProxy = await createContractWithAbi<IsolationModeFreezableLiquidatorProxy>(
      IsolationModeFreezableLiquidatorProxy__factory.abi,
      IsolationModeFreezableLiquidatorProxy__factory.bytecode,
      [
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
        core.expiry.address,
        core.liquidatorAssetRegistry.address,
      ],
    );

    const library = await createGmxV2Library();
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core, library);
    gmxRegistryV2 = await createGmxRegistryV2(core);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxRegistryV2,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
    );
    underlyingToken = IGmxMarketToken__factory.connect(await factory.UNDERLYING_TOKEN(), core.hhUser1);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      library,
      gmxRegistryV2,
      CALLBACK_GAS_LIMIT,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      library,
      gmxRegistryV2,
      CALLBACK_GAS_LIMIT,
    );
    const priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxRegistryV2);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2UnwrapperTrader(unwrapper.address);
    await gmxRegistryV2.connect(core.governance).ownerSetGmxV2WrapperTrader(wrapper.address);

    // Use actual price oracle later
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds(
      [...allowableMarketIds, marketId],
    );

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);
    await wrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.gmxEcosystemV2!.gmxWithdrawalHandler.address, true);

    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.liquidatorProxyV4.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, liquidatorProxy.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(liquidatorProxy.address, true);

    liquidAccount = { owner: vault.address, number: borrowAccountNumber };
    liquidAccount2 = { owner: vault.address, number: defaultAccountNumber };

    await setupGMBalance(core, core.hhUser1, amountWei.mul(2), vault);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
    await vault.openBorrowPosition(
      defaultAccountNumber,
      borrowAccountNumber,
      amountWei,
      { value: GMX_V2_EXECUTION_FEE },
    );
    await vault.openBorrowPosition(
      defaultAccountNumber,
      borrowAccountNumber2,
      amountWei,
      { value: GMX_V2_EXECUTION_FEE },
    );
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
    await expectProtocolBalance(core, vault.address, borrowAccountNumber2, marketId, amountWei);
    await expectWalletBalance(vault, underlyingToken, amountWei.mul(2));
    expect(await vault.isWaitingForCallback(defaultAccountNumber)).to.eq(false);
    expect(await vault.isWaitingForCallback(borrowAccountNumber)).to.eq(false);
    expect(await vault.isWaitingForCallback(borrowAccountNumber2)).to.eq(false);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#prepareForLiquidation', () => {
    let withdrawalKey: string;
    let wethAmount: BigNumber;

    async function setupBalances(
      account: BigNumber,
      devalueCollateral: boolean = true,
      pushFullyUnderwater: boolean = true
    ) {
      // Create debt for the position
      const gmPrice = await core.dolomiteMargin.getMarketPrice(marketId);
      const wethPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.weth);
      wethAmount = amountWei.mul(gmPrice.value).div(wethPrice.value).mul(100).div(120);
      await vault.transferFromPositionWithOtherToken(
        account,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To,
      );

      if (devalueCollateral) {
        // Devalue the collateral so it's underwater
        await core.testEcosystem!.testPriceOracle.setPrice(factory.address, ONE_BI); // as close to 0 as possible
        await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
      }

      if (pushFullyUnderwater) {
        // Increase the value of ETH, so it's underwater after the liquidation is handled too
        await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice.value.mul(107).div(100));
        await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
      }
    }

    enum FinishState {
      Prepared = 0,
      WithdrawalFailed = 1,
      WithdrawalSucceeded = 2,
      Liquidated = 3,
    }

    async function checkStateAfterUnwrapping(accountNumber: BigNumber, walletBalance: BigNumber, state: FinishState) {
      await expectWalletBalance(vault, underlyingToken, walletBalance);

      const withdrawal = await unwrapper.getWithdrawalInfo(withdrawalKey);
      expect(withdrawal.key).to.eq(withdrawalKey);
      if (state === FinishState.WithdrawalSucceeded || state === FinishState.Liquidated) {
        expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
        expect(withdrawal.accountNumber).to.eq(ZERO_BI);
        expect(withdrawal.inputAmount).to.eq(ZERO_BI);
        expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
        expect(withdrawal.outputAmount).to.eq(ZERO_BI);
      } else {
        expect(withdrawal.vault).to.eq(vault.address);
        expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
        expect(withdrawal.inputAmount).to.eq(amountWei);
        expect(withdrawal.outputToken).to.eq(core.tokens.nativeUsdc!.address);
        expect(withdrawal.outputAmount).to.gt(ZERO_BI);
      }

      if (state === FinishState.WithdrawalSucceeded || state === FinishState.Liquidated) {
        await expectProtocolBalance(core, vault.address, accountNumber, marketId, ZERO_BI);
        expect(await vault.isWaitingForCallback(defaultAccountNumber)).to.eq(false);
        expect(await vault.isWaitingForCallback(accountNumber)).to.eq(false);
        expect(await vault.isVaultFrozen()).to.eq(false);
        expect(await vault.shouldSkipTransfer()).to.eq(false);
        expect(await vault.isDepositSourceWrapper()).to.eq(false);
        expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
        if (state === FinishState.Liquidated) {
          await expectProtocolBalance(core, vault.address, accountNumber, core.marketIds.weth, ZERO_BI);
        } else {
          await expectProtocolBalance(
            core,
            vault.address,
            accountNumber,
            core.marketIds.weth,
            wethAmount.mul(-1),
          );
        }
      } else {
        await expectProtocolBalance(core, vault.address, accountNumber, marketId, amountWei);
        await expectProtocolBalance(core, vault.address, accountNumber, core.marketIds.weth, wethAmount.mul(-1));
        expect(await vault.isWaitingForCallback(defaultAccountNumber)).to.eq(false);
        expect(await vault.isWaitingForCallback(accountNumber)).to.eq(true);
        expect(await vault.isVaultFrozen()).to.eq(true);
        expect(await vault.shouldSkipTransfer()).to.eq(false);
        expect(await vault.isDepositSourceWrapper()).to.eq(false);
        expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      }

      if (state === FinishState.WithdrawalFailed) {
        expect(withdrawal.outputAmount).to.be.gt(ZERO_BI);
        if (withdrawal.outputToken === core.tokens.weth.address) {
          await expectWalletBalance(unwrapper, core.tokens.weth, withdrawal.outputAmount);
          await expectWalletBalance(unwrapper, core.tokens.nativeUsdc!, ZERO_BI);
        } else {
          await expectWalletBalance(unwrapper, core.tokens.nativeUsdc!, withdrawal.outputAmount);
          await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
        }
      } else {
        await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
        await expectWalletBalance(unwrapper, core.tokens.nativeUsdc!, ZERO_BI);
      }
    }

    it('should work normally for underwater account', async () => {
      await setupBalances(false);
      const liquidationResult = await liquidatorProxy.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        core.marketIds.nativeUsdc!,
        ONE_BI,
        NO_EXPIRY,
      );
      await expectEvent(core.dolomiteRegistry, liquidationResult, 'LiquidationEnqueued', {
        liquidAccountOwner: liquidAccount.owner,
        liquidAccountNumber: liquidAccount.number,
        heldMarketId: marketId,
        heldAmount: amountWei,
        owedMarketId: core.marketIds.nativeUsdc!,
        minOutputAmount: ONE_BI,
      });
      const filter = unwrapper.filters.WithdrawalCreated();
      withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalExecuted', {
        key: withdrawalKey,
      });
      await checkStateAfterUnwrapping(FinishState.WithdrawalSucceeded);

      // it's sufficiently collateralized now
      const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccount);
      expect(supplyValue.value.mul(ONE_ETH_BI).div(borrowValue.value)).to.be.gt(ONE_ETH_BI.mul(115).div(100));
    });

    it('should work normally for underwater account that must be liquidated', async () => {
      await setupBalances();
      await liquidatorProxy.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        core.marketIds.nativeUsdc!,
        ONE_BI,
        NO_EXPIRY,
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;
      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKey,
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit: 10_000_000 },
        );
      await expectEvent(unwrapper, result, 'WithdrawalFailed', {
        key: withdrawalKey,
        reason: `OperationImpl: Account undercollaterealized <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });
      await checkStateAfterUnwrapping(FinishState.WithdrawalFailed);
    });

    it('should work normally for underwater account when vault is frozen', async () => {
      await liquidator.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        core.marketIds.nativeUsdc!,
        ONE_BI,
        NO_EXPIRY,
      );
      // TODO: check vault is frozen
      // TODO: check liquidation enqueued event
    });

    it('should work normally for expired account', async () => {
      const owedMarket = core.marketIds.nativeUsdc!;
      await setExpiry(core, liquidAccount, owedMarket, 123);
      const expiry = await core.expiry.getExpiry(liquidAccount, owedMarket);
      await increaseByTimeDelta(1234);
      await liquidator.prepareForLiquidation(
        liquidAccount,
        marketId,
        amountWei,
        owedMarket,
        ONE_BI,
        expiry,
      );
      // TODO: check vault is frozen
      // TODO: check liquidation enqueued event
    });

    it('should fail when liquid account is not a valid vault', async () => {
    });

    it('should fail when expiration overflows', async () => {
    });

    it('should fail when position is not expired', async () => {
    });

    it('should fail when position expiration does not match input', async () => {
    });

    it('should fail when liquid account has no supply (should be vaporized)', async () => {
    });

    it('should fail when liquid account is not underwater', async () => {
    });

    it('should fail when there is already a liquidation/operation enqueued for the same account', async () => {
    });
  });
});
