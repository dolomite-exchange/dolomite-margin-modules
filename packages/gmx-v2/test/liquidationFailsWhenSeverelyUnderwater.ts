import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from 'packages/base/src/types';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from 'packages/base/src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, NO_EXPIRY, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletAllowance,
  expectWalletBalance,
} from 'packages/base/test/utils/assertions';
import { createDolomiteRegistryImplementation, createEventEmitter } from 'packages/base/test/utils/dolomite';
import { liquidateV4WithZapParam } from 'packages/base/test/utils/liquidation-utils';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'packages/base/test/utils/setup';
import { getLiquidateIsolationModeZapPath } from 'packages/base/test/utils/zap-utils';
import { AccountStruct } from '../../../packages/base/src/utils/constants';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE_FOR_TESTS } from '../src/gmx-v2-constructors';
import {
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Registry,
  IGenericTraderProxyV1__factory,
  IGmxMarketToken,
  IGmxMarketToken__factory,
} from '../src/types';
import {
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  createGmxV2Library,
  createGmxV2MarketTokenPriceOracle,
  createGmxV2Registry,
  getInitiateWrappingParams,
  getOracleParams,
} from './gmx-v2-ecosystem-utils';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234
const smallAmountWei = amountWei.mul(1).div(100);
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
const NEW_GENERIC_TRADER_PROXY = '0x905F3adD52F01A9069218c8D1c11E240afF61D2B';

describe('POC: liquidationFailsWhenSeverelyUnderwater', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IGmxMarketToken;
  let gmxV2Registry: GmxV2Registry;
  let allowableMarketIds: BigNumberish[];
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;
  let liquidatorProxy: IsolationModeFreezableLiquidatorProxy;
  let eventEmitter: EventEmitterRegistry;

  let solidAccount: AccountStruct;
  let liquidAccount: AccountStruct;
  let withdrawalKeys: string[];
  let depositKey: string | undefined;
  let depositAmountIn: BigNumber;
  let depositMinAmountOut: BigNumber;
  let totalAmountWei: BigNumber;

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
      getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
    );

    const gmxV2Library = await createGmxV2Library();
    const userVaultImplementation = await createGmxV2IsolationModeTokenVaultV1(core, gmxV2Library);
    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);

    allowableMarketIds = [core.marketIds.nativeUsdc!, core.marketIds.weth];
    factory = await createGmxV2IsolationModeVaultFactory(
      core,
      gmxV2Library,
      gmxV2Registry,
      allowableMarketIds,
      allowableMarketIds,
      core.gmxV2Ecosystem!.gmTokens.ethUsd,
      userVaultImplementation,
      GMX_V2_EXECUTION_FEE_FOR_TESTS,
    );
    underlyingToken = IGmxMarketToken__factory.connect(await factory.UNDERLYING_TOKEN(), core.hhUser1);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(
      core,
      factory,
      gmxV2Library,
      gmxV2Registry,
    );
    const priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxV2Registry);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

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

    await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
    await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);

    eventEmitter = await createEventEmitter(core);
    const newRegistry = await createDolomiteRegistryImplementation();
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);

    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.liquidatorProxyV4.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, liquidatorProxy.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(liquidatorProxy.address, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(NEW_GENERIC_TRADER_PROXY, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV4.address, true);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(NEW_GENERIC_TRADER_PROXY);
    const trader = IGenericTraderProxyV1__factory.connect(NEW_GENERIC_TRADER_PROXY, core.governance);
    await trader.ownerSetEventEmitterRegistry(eventEmitter.address);

    solidAccount = { owner: core.hhUser5.address, number: defaultAccountNumber };
    liquidAccount = { owner: vault.address, number: borrowAccountNumber };

    await setupGMBalance(core, core.gmxV2Ecosystem.gmxEthUsdMarketToken, core.hhUser1, amountWei.mul(2), vault);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
    await vault.openBorrowPosition(
      defaultAccountNumber,
      borrowAccountNumber,
      amountWei,
      { value: GMX_V2_EXECUTION_FEE_FOR_TESTS },
    );
    await vault.openBorrowPosition(
      defaultAccountNumber,
      borrowAccountNumber2,
      amountWei,
      { value: GMX_V2_EXECUTION_FEE_FOR_TESTS },
    );
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
    await expectProtocolBalance(core, vault.address, borrowAccountNumber2, marketId, amountWei);
    await expectWalletBalance(vault, underlyingToken, amountWei.mul(2));
    expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber2)).to.eq(false);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    withdrawalKeys = [];
    depositKey = undefined;
    depositAmountIn = ZERO_BI;
    depositMinAmountOut = ZERO_BI;
    totalAmountWei = amountWei;
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#prepareForLiquidation', () => {
    let wethAmount: BigNumber;
    let amountWeiForLiquidation: BigNumber;

    enum ZapType {
      None,
      Deposit,
      Withdraw,
    }

    async function setupBalances(
      account: BigNumber,
      devalueCollateral: boolean = true,
      pushFullyUnderwater: boolean = true,
      performZapType: ZapType = ZapType.None,
    ) {
      // Create debt for the position
      let gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      let wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const usdcPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.nativeUsdc!)).value;

      wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(121);
      await vault.transferFromPositionWithOtherToken(
        account,
        defaultAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.To,
      );

      if (performZapType === ZapType.Deposit) {
        depositAmountIn = amountWei.mul(gmPrice).div(usdcPrice).mul(1).div(100);
        depositMinAmountOut = amountWei.mul(99).div(100).mul(1).div(100);
        totalAmountWei = totalAmountWei.add(depositMinAmountOut);

        const initiateWrappingParams = await getInitiateWrappingParams(
          account,
          core.marketIds.nativeUsdc!,
          depositAmountIn,
          marketId,
          depositMinAmountOut,
          wrapper,
        );
        await vault.swapExactInputForOutput(
          initiateWrappingParams.accountNumber,
          initiateWrappingParams.marketPath,
          initiateWrappingParams.amountIn,
          initiateWrappingParams.minAmountOut,
          initiateWrappingParams.traderParams,
          initiateWrappingParams.makerAccounts,
          initiateWrappingParams.userConfig,
          { value: GMX_V2_EXECUTION_FEE_FOR_TESTS },
        );
      } else if (performZapType === ZapType.Withdraw) {
        const result = await vault.initiateUnwrapping(
          account,
          smallAmountWei,
          core.tokens.nativeUsdc!.address,
          ONE_BI,
          DEFAULT_EXTRA_DATA,
          { value: GMX_V2_EXECUTION_FEE_FOR_TESTS },
        );
        const filter = eventEmitter.filters.AsyncWithdrawalCreated();
        withdrawalKeys.push((await eventEmitter.queryFilter(filter, result.blockNumber))[0].args.key);
      }

      if (devalueCollateral) {
        // Devalue the collateral so it's underwater
        gmPrice = gmPrice.mul(95).div(100);
        await core.testEcosystem!.testPriceOracle.setPrice(factory.address, gmPrice);
        await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
      }

      if (pushFullyUnderwater) {
        // Increase the value of ETH, so it's severely underwater after the liquidation is handled too
        wethPrice = wethPrice.mul(120).div(100);
        await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice);
        await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
      }

      amountWeiForLiquidation = wethAmount.mul(wethPrice).mul(105).div(100).div(gmPrice);
      if (amountWeiForLiquidation.gt(totalAmountWei)) {
        // Cap the size at amountWei
        amountWeiForLiquidation = totalAmountWei;
      }
    }

    async function performUnwrapping(key?: string): Promise<ContractTransaction> {
      if (!key) {
        const filter = eventEmitter.filters.AsyncWithdrawalCreated();
        withdrawalKeys.push((await eventEmitter.queryFilter(filter))[0].args.key);
      }
      return await core.gmxV2Ecosystem!.gmxWithdrawalHandler.connect(core.gmxV2Ecosystem!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKeys[withdrawalKeys.length - 1],
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit: 10_000_000 },
        );
    }

    enum UnwrapperTradeType {
      FromWithdrawal = 0,
      FromDeposit = 1,
    }

    enum FinishState {
      WithdrawalFailed = 1,
      WithdrawalSucceeded = 2,
      Liquidated = 3,
      Expired = 4,
      Vaporized = 5,
    }

    async function checkStateAfterUnwrapping(
      accountNumber: BigNumber,
      state: FinishState,
      vaultErc20Balance: BigNumber = amountWei,
      outputAmount: BigNumber = ZERO_BI,
      isFrozenAfterLiquidation?: boolean,
      outputAmountForSwap: BigNumber = ZERO_BI,
    ) {
      await expectWalletBalance(vault, underlyingToken, vaultErc20Balance);

      const withdrawals = await Promise.all(withdrawalKeys.map(key => unwrapper.getWithdrawalInfo(key)));
      const partitionedTotalOutputAmount = withdrawals.reduce((acc, withdrawal, i) => {
        if (
          state === FinishState.WithdrawalSucceeded
          || state === FinishState.Liquidated
          || state === FinishState.Expired
          || state === FinishState.Vaporized
        ) {
          expect(withdrawal.key).to.eq(BYTES_ZERO);
          expect(withdrawal.vault).to.eq(ZERO_ADDRESS);
          expect(withdrawal.accountNumber).to.eq(ZERO_BI);
          expect(withdrawal.inputAmount).to.eq(ZERO_BI);
          expect(withdrawal.outputToken).to.eq(ZERO_ADDRESS);
          expect(withdrawal.outputAmount).to.eq(ZERO_BI);
          expect(withdrawal.isRetryable).to.eq(false);
        } else {
          expect(withdrawal.key).to.eq(withdrawalKeys[i]);
          expect(withdrawal.vault).to.eq(vault.address);
          expect(withdrawal.accountNumber).to.eq(borrowAccountNumber);
          expect(
            withdrawal.inputAmount.eq(amountWei)
            || withdrawal.inputAmount.eq(smallAmountWei)
            || withdrawal.inputAmount.eq(amountWei.sub(smallAmountWei)),
          ).to.eq(true);
          expect(withdrawal.outputToken).to.eq(core.tokens.nativeUsdc!.address);
          expect(withdrawal.outputAmount).to.gt(ZERO_BI);
          expect(withdrawal.isRetryable).to.eq(true);
        }
        if (!acc[withdrawal.outputToken]) {
          acc[withdrawal.outputToken] = ZERO_BI;
        }
        acc[withdrawal.outputToken] = acc[withdrawal.outputToken].add(withdrawal.outputAmount);
        return acc;
      }, {} as any);

      const deposit = depositKey ? await wrapper.getDepositInfo(depositKey) : undefined;
      if (deposit &&
        (state === FinishState.WithdrawalSucceeded ||
          state === FinishState.Liquidated ||
          state === FinishState.Expired ||
          state === FinishState.Vaporized)
      ) {
        expect(deposit.vault).to.eq(ZERO_ADDRESS);
        expect(deposit.accountNumber).to.eq(ZERO_BI);
        expect(deposit.inputToken).to.eq(ZERO_ADDRESS);
        expect(deposit.inputAmount).to.eq(ZERO_BI);
        expect(deposit.outputAmount).to.eq(ZERO_BI);
        expect(deposit.isRetryable).to.eq(false);
      } else if (deposit) {
        expect(deposit.vault).to.eq(vault.address);
        expect(deposit.accountNumber).to.eq(borrowAccountNumber);
        expect(deposit.inputToken).to.eq(core.tokens.nativeUsdc!.address);
        expect(deposit.inputAmount).to.eq(depositAmountIn);
        expect(deposit.outputAmount).to.eq(depositMinAmountOut);
        expect(deposit.isRetryable).to.eq(true);
      }

      if (
        state === FinishState.WithdrawalSucceeded
        || state === FinishState.Liquidated
        || state === FinishState.Expired
        || state === FinishState.Vaporized
      ) {
        await expectProtocolBalance(core, vault.address, accountNumber, marketId, ZERO_BI);
        expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
        expect(await vault.isVaultAccountFrozen(accountNumber)).to.eq(false);
        expect(await vault.shouldSkipTransfer()).to.eq(false);
        expect(await vault.isDepositSourceWrapper()).to.eq(false);

        if (state === FinishState.Liquidated && isFrozenAfterLiquidation) {
          expect(await vault.isVaultFrozen()).to.eq(isFrozenAfterLiquidation);
        } else {
          expect(await vault.isVaultFrozen()).to.eq(false);
        }

        if (state === FinishState.Liquidated || state === FinishState.Vaporized) {
          if (state === FinishState.Liquidated) {
            await expectProtocolBalance(
              core,
              vault,
              accountNumber,
              core.marketIds.weth,
              ZERO_BI,
            );
          } else {
            const rawBalanceWei = await core.dolomiteMargin.getAccountWei(liquidAccount, marketId);
            const balanceWei = rawBalanceWei.sign ? rawBalanceWei.value : rawBalanceWei.value.mul(-1);
            expect(balanceWei.lt(ZERO_BI));
          }

          await expectProtocolBalance(
            core,
            vault.address,
            accountNumber,
            core.marketIds.nativeUsdc!,
            outputAmount.sub(outputAmountForSwap).sub(depositAmountIn),
          );
          await expectProtocolBalance(
            core,
            solidAccount.owner,
            solidAccount.number,
            core.marketIds.nativeUsdc!,
            ZERO_BI,
          );
          await expectProtocolBalance(
            core,
            solidAccount.owner,
            solidAccount.number,
            marketId,
            ZERO_BI,
          );
          if (state === FinishState.Liquidated) {
            // The trader always outputs the debt amount (which means the solid account does not earn a profit in ETH)
            await expectProtocolBalance(
              core,
              solidAccount.owner,
              solidAccount.number,
              core.marketIds.weth,
              ZERO_BI,
            );
          } else {
            // The trader always outputs the debt amount (which means the solid account does not earn a profit in ETH)
            await expectProtocolBalance(
              core,
              solidAccount.owner,
              solidAccount.number,
              core.marketIds.weth,
              (await core.dolomiteMargin.getAccountWei(liquidAccount, core.marketIds.weth)).value,
            );
          }
        } else if (state === FinishState.WithdrawalSucceeded) {
          await expectProtocolBalance(core, vault.address, accountNumber, core.marketIds.weth, wethAmount.mul(-1));
        } else {
          await expectProtocolBalanceIsGreaterThan(
            core,
            { owner: vault.address, number: accountNumber },
            core.marketIds.weth,
            ONE_BI,
            0,
          );
        }
      } else {
        await expectProtocolBalance(core, vault.address, accountNumber, marketId, totalAmountWei);
        await expectProtocolBalance(
          core,
          vault.address,
          accountNumber,
          core.marketIds.weth,
          wethAmount.mul(-1),
        );
        expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
        expect(await vault.isVaultAccountFrozen(accountNumber)).to.eq(true);
        expect(await vault.isVaultFrozen()).to.eq(true);
        expect(await vault.shouldSkipTransfer()).to.eq(false);
        expect(await vault.isDepositSourceWrapper()).to.eq(false);
        await expectWalletBalance(vault, underlyingToken, vaultErc20Balance);
      }

      if (state === FinishState.WithdrawalFailed) {
        const weth = core.tokens.weth;
        const usdc = core.tokens.nativeUsdc!;
        if (withdrawals[0].outputToken === weth.address) {
          expect(partitionedTotalOutputAmount).to.be.gt(ZERO_BI);
          await expectWalletBalance(unwrapper, weth, partitionedTotalOutputAmount[weth.address]);
          await expectWalletBalance(unwrapper, usdc, ZERO_BI);
        } else {
          await expectWalletBalance(unwrapper, usdc, partitionedTotalOutputAmount[usdc.address]);
          await expectWalletBalance(unwrapper, weth, ZERO_BI);
        }
        if (deposit) {
          if (deposit.inputToken === weth.address) {
            expect(partitionedTotalOutputAmount).to.be.gt(ZERO_BI);
            await expectWalletBalance(wrapper, weth, depositAmountIn);
            await expectWalletBalance(wrapper, usdc, ZERO_BI);
          } else {
            await expectWalletBalance(wrapper, usdc, depositAmountIn);
            await expectWalletBalance(wrapper, weth, ZERO_BI);
          }
        }
      } else {
        await expectWalletBalance(unwrapper, core.tokens.weth, ZERO_BI);
        await expectWalletBalance(unwrapper, core.tokens.nativeUsdc!, ZERO_BI);
      }

      await expectWalletAllowance(wrapper, unwrapper, core.tokens.weth, ZERO_BI);
      await expectWalletAllowance(wrapper, unwrapper, core.tokens.nativeUsdc!, ZERO_BI);
    }

    async function calculateZapParams(wethPrice: BigNumber, isFullyUnderwater: boolean) {

      const gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
      amountWeiForLiquidation = wethAmount.mul(wethPrice).mul(105).div(100).div(gmPrice);
      if (amountWeiForLiquidation.gt(totalAmountWei)) {
        // Cap the size at amountWei
        amountWeiForLiquidation = totalAmountWei;
      }

      const allKeys = withdrawalKeys.concat(depositKey ? [depositKey] : []);
      const tradeTypes = allKeys.map(key => key === depositKey
        ? UnwrapperTradeType.FromDeposit
        : UnwrapperTradeType.FromWithdrawal);
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, !isFullyUnderwater],
      );
      const withdrawals = await Promise.all(withdrawalKeys.map(key => unwrapper.getWithdrawalInfo(key)));
      const deposit = depositKey ? await wrapper.getDepositInfo(depositKey) : undefined;
      const allStructs = withdrawals
        .map(w => ({ inputAmount: w.inputAmount, outputAmount: w.outputAmount }))
        .concat(deposit ? [{ inputAmount: deposit.outputAmount, outputAmount: deposit.inputAmount }] : []);
      const outputAmountForSwap = allStructs
        .reduce((acc, struct) => {
          if (acc.input.gt(ZERO_BI)) {
            const inputAmount = acc.input.lt(struct.inputAmount)
              ? acc.input
              : struct.inputAmount;
            const outputAmount = acc.input.lt(struct.inputAmount)
              ? struct.outputAmount.mul(acc.input).div(struct.inputAmount)
              : struct.outputAmount;

            acc.input = acc.input.sub(inputAmount);
            acc.output = acc.output.add(outputAmount);
          }
          return acc;
        }, { output: ZERO_BI, input: amountWeiForLiquidation })
        .output;
      const totalOutputAmount = allStructs.reduce((acc, struct) => {
        return acc.add(struct.outputAmount);
      }, ZERO_BI);

      const zapParam = await getLiquidateIsolationModeZapPath(
        [marketId, core.marketIds.nativeUsdc!, core.marketIds.weth],
        [amountWeiForLiquidation, outputAmountForSwap, wethAmount],
        unwrapper,
        core,
      );
      zapParam.tradersPath[0].tradeData = liquidationData;

      return {
        zapParam,
        totalOutputAmount,
        outputAmountForSwap,
      };
    }

    async function isVaporizable(account: AccountStruct) {
      let hasNegative = false;
      const markets = await core.dolomiteMargin.getAccountMarketsWithBalances(account);
      for (const market of markets) {
        const par = await core.dolomiteMargin.getAccountPar(account, market.toNumber());
        if (par.value.isZero()) {
          // Do nothing
        } else if (par.sign) {
          console.log(`\tAccount ${account.number} has a positive balance of ${par.value.toString()} in the market ${market}`);
          return false;
        } else {
          hasNegative = true;
        }
      }
      return hasNegative;
    }

    it('Severely underwater position cannot be liquidated', async () => {
      await setupBalances(borrowAccountNumber);

      // liquidation preparation results in withdrawal failed due to undercollateralized account
      await liquidatorProxy.prepareForLiquidation({
        liquidAccount,
        freezableMarketId: marketId,
        inputTokenAmount: amountWei,
        outputMarketId: core.marketIds.nativeUsdc!,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
        extraData: DEFAULT_EXTRA_DATA,
      });
      const result = await performUnwrapping();
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKeys[0],
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });

      // validated state after unwrapping
      await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalFailed);

      // setup for launching the liquidation through core proxy
      const testTrader = await impersonate(core.testEcosystem!.testExchangeWrapper.address, true, wethAmount.mul(10));
      await setupWETHBalance(
        core,
        testTrader,
        wethAmount.mul(5),
        { address: '0x000000000000000000000000000000000000dead' },
      );

      // user current, high, WETH price to calculate the required zapParams for calling liquidated
      const initialWethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
      const { zapParam: zapParams1 } = await calculateZapParams(initialWethPrice, false);

      // Actions that are done in a liquidation: [CallFunction, Sell, CallFunction, Sell]
      // liquidation fails, since being severely undercollateralized, the entire available user amount
      // will be used. That results in the first sale action deleting the withdrawal position and when
      // the second Call action tries to invoke a function on the vault (which is now address(0)) it
      // reverts with the error: `function call to a non-contract account`
      await expectThrow(
        liquidateV4WithZapParam(
          core,
          solidAccount,
          liquidAccount,
          zapParams1,
        ),
        'function call to a non-contract account',
      );

      // show account is not Vaporizable because not all of its markets are negative, specifically the GM one
      expect(await isVaporizable(liquidAccount)).to.be.false;

      // // decreasing the price of WETH will result in a healthier liquidation position
      // const decreasedWethPrice = initialWethPrice.mul(90).div(100);
      // await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, decreasedWethPrice);

      // we recalculate the zap params for it
      const {
        zapParam: zapParamAfterDecrease,
        totalOutputAmount: totalOutputAmountAfterDecrease,
        outputAmountForSwap: outputAmountForSwapAfterDecrease,
      } = await calculateZapParams(initialWethPrice, true);

      // call liquidate with the new values and price state
      await liquidateV4WithZapParam(
        core,
        solidAccount,
        liquidAccount,
        zapParamAfterDecrease,
      );

      // show it succeeds
      await checkStateAfterUnwrapping(
        borrowAccountNumber,
        FinishState.Vaporized,
        amountWei,
        totalOutputAmountAfterDecrease,
        false,
        outputAmountForSwapAfterDecrease,
      );

      // The account should be vaporizable now, since all GM should have been spent
      expect(await isVaporizable(liquidAccount)).to.be.true;
    });
  });
});
