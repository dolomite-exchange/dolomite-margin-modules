import { INTEGERS } from '@dolomite-exchange/dolomite-margin';
import {
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
  IGmxMarketToken__factory,
  IGmxV2Registry,
} from '@dolomite-exchange/modules-gmx-v2/src/types';
import {
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2Implementation,
  createGmxV2IsolationModeWrapperTraderV2Implementation,
  createGmxV2Library,
  getInitiateWrappingParams,
  getOracleParams,
} from '@dolomite-exchange/modules-gmx-v2/test/gmx-v2-ecosystem-utils';
import {
  ApiAsyncAction,
  ApiAsyncActionType,
  ApiAsyncWithdrawalStatus,
  GenericTraderType,
  ZapConfig,
  ZapOutputParam,
} from '@dolomite-exchange/zap-sdk';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { GenericTraderParam } from '@dolomite-margin/dist/src/modules/GenericTraderProxyV1';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import hardhat from 'hardhat';
import {
  IEventEmitterRegistry,
  TestIsolationModeFreezableLiquidatorProxy,
  TestIsolationModeFreezableLiquidatorProxy__factory,
} from '../../src/types';
import { AccountStruct } from '../../src/utils/constants';
import { getIsolationModeFreezableLiquidatorProxyConstructorParams } from '../../src/utils/constructors/dolomite';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import {
  BYTES_ZERO,
  MAX_UINT_256_BI,
  Network,
  NO_EXPIRY,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  getRealLatestBlockNumber,
  impersonate,
  increaseByTimeDelta,
  revertToSnapshotAndCapture,
  snapshot,
} from '../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletAllowance,
  expectWalletBalance,
} from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { setExpiry } from '../utils/expiry-utils';
import { toZapBigNumber } from '../utils/liquidation-utils';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupUserVaultProxy,
  setupWETHBalance,
} from '../utils/setup';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);
const borrowAccountNumber3 = borrowAccountNumber2.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234
const smallAmountWei = amountWei.mul(1).div(100);
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);

const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const executionFee = parseEther('0.01'); // from the contracts directly
const additionalExecutionFee = ZERO_BI;

const DEVALUE_COLLATERAL_NUMERATOR = BigNumber.from(95);
const DEVALUE_COLLATERAL_DENOMINATOR = BigNumber.from(100);
hardhat.tracer.enabled = false;

if (process.env.COVERAGE !== 'true') {
  describe('IsolationModeFreezableLiquidatorProxyWithZap', () => {
    let snapshotId: string;

    let core: CoreProtocolArbitrumOne;
    let underlyingToken: IGmxMarketToken;
    let gmxV2Registry: IGmxV2Registry;
    let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
    let wrapper: GmxV2IsolationModeWrapperTraderV2;
    let factory: GmxV2IsolationModeVaultFactory;
    let vault: GmxV2IsolationModeTokenVaultV1;
    let marketId: BigNumber;
    let liquidatorProxy: TestIsolationModeFreezableLiquidatorProxy;
    let eventEmitter: IEventEmitterRegistry;

    let solidAccount: AccountStruct;
    let liquidAccount: AccountStruct;
    let liquidAccount2: AccountStruct;
    let withdrawalKeys: string[];
    let depositKey: string | undefined;
    let depositAmountIn: BigNumber;
    let depositMinAmountOut: BigNumber;
    let totalAmountWei: BigNumber;

    before(async () => {
      const network = Network.ArbitrumOne;
      core = await setupCoreProtocol({
        network,
        blockNumber: await getRealLatestBlockNumber(true, network),
      });

      liquidatorProxy = await createContractWithAbi<TestIsolationModeFreezableLiquidatorProxy>(
        TestIsolationModeFreezableLiquidatorProxy__factory.abi,
        TestIsolationModeFreezableLiquidatorProxy__factory.bytecode,
        getIsolationModeFreezableLiquidatorProxyConstructorParams(core),
      );

      gmxV2Registry = core.gmxV2Ecosystem.live.registry;

      factory = core.gmxV2Ecosystem.live.gmEthUsd.factory;
      underlyingToken = IGmxMarketToken__factory.connect(await factory.UNDERLYING_TOKEN(), core.hhUser1);
      unwrapper = core.gmxV2Ecosystem.live.gmEthUsd.unwrapper;
      wrapper = core.gmxV2Ecosystem.live.gmEthUsd.wrapper;

      // Use actual price oracle later
      marketId = BigNumber.from(core.marketIds.dGmEth);
      await disableInterestAccrual(core, core.marketIds.weth);
      await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

      await factory.connect(core.governance).ownerSetExecutionFee(executionFee);

      await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
      await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);
      await gmxV2Registry.connect(core.governance).ownerSetGmxDepositVault(core.gmxV2Ecosystem.gmxDepositVault.address);
      await gmxV2Registry.connect(core.governance).ownerSetGmxWithdrawalVault(
        core.gmxV2Ecosystem.gmxWithdrawalVault.address,
      );
      const gmxV2Library = await createGmxV2Library();

      const unwrapperImplementation = await createGmxV2IsolationModeUnwrapperTraderV2Implementation(core, gmxV2Library);
      const wrapperImplementation = await createGmxV2IsolationModeWrapperTraderV2Implementation(core, gmxV2Library);
      await core.gmxV2Ecosystem.live.gmEthUsd.unwrapperProxy.connect(core.governance)
        .upgradeTo(unwrapperImplementation.address);
      await core.gmxV2Ecosystem.live.gmEthUsd.wrapperProxy.connect(core.governance)
        .upgradeTo(wrapperImplementation.address);

      const userImplementation = await createGmxV2IsolationModeTokenVaultV1(core, gmxV2Library);
      await factory.connect(core.governance).ownerSetUserVaultImplementation(userImplementation.address);

      await factory.createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
        vaultAddress,
        GmxV2IsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      await setupWETHBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);

      await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, liquidatorProxy.address);

      solidAccount = { owner: core.hhUser5.address, number: defaultAccountNumber };
      liquidAccount = { owner: vault.address, number: borrowAccountNumber };
      liquidAccount2 = { owner: vault.address, number: borrowAccountNumber2 };

      await setupGMBalance(core, core.gmxV2Ecosystem.gmxEthUsdMarketToken, core.hhUser1, amountWei.mul(2), vault);
      await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
        { value: executionFee },
      );
      await vault.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber2,
        amountWei,
        { value: executionFee },
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber2, marketId, amountWei);
      await expectWalletBalance(vault, underlyingToken, amountWei.mul(2));
      expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
      expect(await vault.isVaultAccountFrozen(borrowAccountNumber2)).to.eq(false);

      eventEmitter = core.eventEmitterRegistry;

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

      async function getZapConfigForUnwrap(): Promise<Partial<ZapConfig>> {
        const gasPrice = await core.hhUser1.getGasPrice();
        return {
          disallowAggregator: true,
          isLiquidation: true,
          gasPriceInWei: toZapBigNumber(gasPrice),
          slippageTolerance: 0.025,
        };
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
            { value: executionFee },
          );
        } else if (performZapType === ZapType.Withdraw) {
          const result = await vault.initiateUnwrapping(
            account,
            smallAmountWei,
            core.tokens.nativeUsdc!.address,
            ONE_BI,
            DEFAULT_EXTRA_DATA,
            { value: executionFee },
          );
          const filter = eventEmitter.filters.AsyncWithdrawalCreated();
          withdrawalKeys.push((await eventEmitter.queryFilter(filter, result.blockNumber))[0].args.key);
        }

        if (devalueCollateral) {
          // Devalue the collateral so it's underwater
          gmPrice = gmPrice.mul(DEVALUE_COLLATERAL_NUMERATOR).div(DEVALUE_COLLATERAL_DENOMINATOR);
          await core.testEcosystem!.testPriceOracle.setPrice(factory.address, gmPrice);
          await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
        }

        if (pushFullyUnderwater) {
          // Increase the value of the borrowed ETH, so it's underwater after the liquidation is handled too
          wethPrice = wethPrice.mul(107).div(100);
          await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice);
          await core.dolomiteMargin.ownerSetPriceOracle(
            core.marketIds.weth,
            core.testEcosystem!.testPriceOracle.address,
          );
        }

        amountWeiForLiquidation = wethAmount.mul(wethPrice).mul(105).div(100).div(gmPrice);
        if (amountWeiForLiquidation.gt(totalAmountWei)) {
          // Cap the size at amountWei
          amountWeiForLiquidation = totalAmountWei;
        }
      }

      async function getZapForPreparingForUnwrap(outputMarketId: BigNumberish): Promise<ZapOutputParam> {
        const gmPrice = await core.dolomiteMargin.getMarketPrice(marketId);
        const outputPrice = await core.dolomiteMargin.getMarketPrice(outputMarketId);
        const minOutputAmount = amountWei.mul(gmPrice.value).div(outputPrice.value.mul(101).div(100)).div(2);
        const unwrapZaps = await core.zap.getSwapExactTokensForTokensParams(
          { marketId: toZapBigNumber(marketId), symbol: 'GM' },
          toZapBigNumber(amountWei),
          { marketId: toZapBigNumber(outputMarketId), symbol: 'OUTPUT_TOKEN' },
          toZapBigNumber(minOutputAmount),
          solidAccount.owner,
          await getZapConfigForUnwrap(),
        );
        expect(unwrapZaps.length).to.eq(1);

        const unwrapZap = unwrapZaps[0];
        const values = ethers.utils.defaultAbiCoder.decode(['uint', 'uint'], unwrapZap.traderParams[0].tradeData);
        unwrapZap.amountWeisPath[1] = unwrapZap.amountWeisPath[1]
          .times(DEVALUE_COLLATERAL_NUMERATOR.toString())
          .dividedToIntegerBy(DEVALUE_COLLATERAL_DENOMINATOR.toString());
        unwrapZap.traderParams[0].tradeData = ethers.utils.defaultAbiCoder.encode(
          ['uint', 'uint'],
          [values[0], values[1].mul(DEVALUE_COLLATERAL_NUMERATOR).div(DEVALUE_COLLATERAL_DENOMINATOR)],
        );

        return unwrapZap;
      }

      async function cancelWrapping(): Promise<ContractTransaction> {
        await mine(1200);
        const filter = eventEmitter.filters.AsyncDepositCreated();
        depositKey = (await eventEmitter.queryFilter(filter))[0].args.key;
        return await vault.connect(core.hhUser1).cancelDeposit(depositKey);
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
            { gasLimit },
          );
      }

      enum FinishState {
        WithdrawalFailed = 1,
        WithdrawalSucceeded = 2,
        Liquidated = 3,
        Expired = 4,
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
            state === FinishState.Expired)
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

          if (state === FinishState.Liquidated) {
            await expectProtocolBalance(
              core,
              vault.address,
              accountNumber,
              core.marketIds.nativeUsdc!,
              outputAmount.sub(outputAmountForSwap).sub(depositAmountIn),
            );
            await expectProtocolBalance(
              core,
              vault,
              accountNumber,
              core.marketIds.weth,
              ZERO_BI,
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
            // The trader always outputs the debt amount (which means the solid account does not earn a profit in ETH)
            await expectProtocolBalance(
              core,
              solidAccount.owner,
              solidAccount.number,
              core.marketIds.weth,
              ZERO_BI,
            );
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

      async function performLiquidationAndCheckState(
        vaultErc20Balance: BigNumber,
        isFrozen: boolean,
        skipZap: boolean = false,
      ) {
        // Give the contract the WETH needed to complete the exchange
        const testTrader = await impersonate(core.testEcosystem!.testExchangeWrapper.address, true, wethAmount.mul(10));
        await setupWETHBalance(
          core,
          testTrader,
          wethAmount.mul(5),
          { address: '0x000000000000000000000000000000000000dead' },
        );

        const withdrawals = await Promise.all(withdrawalKeys.map(key => unwrapper.getWithdrawalInfo(key)));
        const deposits = depositKey ? [await wrapper.getDepositInfo(depositKey)] : [];
        const allStructs = withdrawals
          .map<ApiAsyncAction>(withdrawal => ({
            id: `${factory.address.toLowerCase()}-${withdrawal.key}`,
            key: withdrawal.key,
            actionType: ApiAsyncActionType.WITHDRAWAL,
            owner: liquidAccount.owner,
            accountNumber: toZapBigNumber(liquidAccount.number),
            status: ApiAsyncWithdrawalStatus.WITHDRAWAL_EXECUTION_FAILED,
            inputToken: {
              marketId: toZapBigNumber(marketId),
              symbol: 'GM',
              tokenAddress: factory.address,
              name: 'GM',
              decimals: 18,
            },
            inputAmount: toZapBigNumber(withdrawal.inputAmount),
            outputToken: {
              marketId: toZapBigNumber(core.marketIds.nativeUsdc),
              symbol: 'USDC',
              tokenAddress: core.tokens.nativeUsdc.address,
              name: 'USD Coin',
              decimals: 6,
            },
            outputAmount: toZapBigNumber(withdrawal.outputAmount),
          }))
          .concat(deposits.map(deposit => ({
            id: `${factory.address.toLowerCase()}-${deposit.key}`,
            key: deposit.key,
            actionType: ApiAsyncActionType.DEPOSIT,
            owner: liquidAccount.owner,
            accountNumber: toZapBigNumber(liquidAccount.number),
            status: ApiAsyncWithdrawalStatus.WITHDRAWAL_EXECUTION_FAILED,
            inputToken: {
              marketId: toZapBigNumber(marketId),
              symbol: 'GM',
              tokenAddress: factory.address,
              name: 'GM',
              decimals: 18,
            },
            inputAmount: toZapBigNumber(deposit.outputAmount),
            outputToken: {
              marketId: toZapBigNumber(core.marketIds.nativeUsdc),
              symbol: 'USDC',
              tokenAddress: core.tokens.nativeUsdc.address,
              name: 'USD Coin',
              decimals: 6,
            },
            outputAmount: toZapBigNumber(deposit.inputAmount),
          })));
        const marketIdToActionsMap = { [core.marketIds.nativeUsdc.toString()]: allStructs };
        const totalOutputAmount = allStructs.reduce((acc, struct) => {
          return acc.plus(struct.outputAmount);
        }, INTEGERS.ZERO);

        const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
        const usdcPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.nativeUsdc!)).value;
        const marketIdToOracleMap = {
          [core.marketIds.weth.toString()]: { oraclePrice: toZapBigNumber(wethPrice) },
          [core.marketIds.nativeUsdc.toString()]: { oraclePrice: toZapBigNumber(usdcPrice) },
        };

        if (!skipZap) {
          const zapOutputs = await core.zap.getSwapExactAsyncTokensForTokensParamsForLiquidation(
            { marketId: toZapBigNumber(marketId), symbol: 'GM' },
            toZapBigNumber(amountWeiForLiquidation),
            { marketId: toZapBigNumber(core.marketIds.weth), symbol: 'WETH' },
            toZapBigNumber(wethAmount),
            core.hhUser5.address,
            marketIdToActionsMap,
            marketIdToOracleMap,
            { isLiquidation: true, subAccountNumber: toZapBigNumber(liquidAccount.number) },
          );
          expect(zapOutputs.length).to.be.gt(0);

          const zap = zapOutputs[0];
          zap.traderParams[1] = {
            trader: core.testEcosystem!.testExchangeWrapper.address,
            traderType: GenericTraderType.ExternalLiquidity,
            tradeData: ethers.utils.defaultAbiCoder.encode(
              ['uint256', 'bytes'],
              [wethAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [wethAmount])],
            ),
            makerAccountIndex: 0,
            readableName: 'Test Exchange Wrapper',
          };

          await core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
            solidAccount,
            liquidAccount,
            zap.marketIdsPath.map(m => m.toFixed()),
            MAX_UINT_256_BI,
            MAX_UINT_256_BI,
            zap.traderParams,
            zap.makerAccounts,
            NO_EXPIRY,
          );

          await checkStateAfterUnwrapping(
            borrowAccountNumber,
            FinishState.Liquidated,
            vaultErc20Balance,
            BigNumber.from(totalOutputAmount.toFixed()),
            isFrozen,
            BigNumber.from(zap.amountWeisPath[1].toFixed()),
          );
        } else {
          const allKeys = withdrawalKeys.concat(depositKey ? [depositKey] : []);
          const tradeTypes = allKeys.map(key => key === depositKey ? 1 : 0);

          const traderParams: GenericTraderParam[] = [
            {
              trader: unwrapper.address,
              traderType: GenericTraderType.IsolationModeUnwrapper,
              tradeData: ethers.utils.defaultAbiCoder.encode(
                ['uint8[]', 'bytes32[]', 'bool'],
                [tradeTypes, allKeys, false],
              ),
              makerAccountIndex: 0,
            },
            {
              trader: core.testEcosystem!.testExchangeWrapper.address,
              traderType: GenericTraderType.ExternalLiquidity,
              tradeData: ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'bytes'],
                [wethAmount, ethers.utils.defaultAbiCoder.encode(['uint256'], [wethAmount])],
              ),
              makerAccountIndex: 0,
            },
          ];

          await core.liquidatorProxyV4!.connect(core.hhUser5).liquidate(
            solidAccount,
            liquidAccount,
            [marketId, core.marketIds.nativeUsdc, core.marketIds.weth],
            MAX_UINT_256_BI,
            MAX_UINT_256_BI,
            traderParams,
            [],
            NO_EXPIRY,
          );
        }
      }

      it('should work normally for underwater account', async () => {
        await setupBalances(borrowAccountNumber, true, false);
        const unwrapZap = await getZapForPreparingForUnwrap(core.marketIds.nativeUsdc);
        await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: unwrapZap.amountWeisPath[0].toFixed(),
            outputMarketId: core.marketIds.nativeUsdc!,
            minOutputAmount: unwrapZap.amountWeisPath[1].toFixed(),
            expirationTimestamp: NO_EXPIRY,
            extraData: unwrapZap.traderParams[0].tradeData,
          },
          {
            value: additionalExecutionFee,
          },
        );
        const result = await performUnwrapping();
        await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
          key: withdrawalKeys[0],
          token: factory.address,
        });
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalSucceeded);

        // it's sufficiently collateralized now
        const [supplyValue, borrowValue] = await core.dolomiteMargin.getAccountValues(liquidAccount);
        expect(supplyValue.value.mul(ONE_ETH_BI).div(borrowValue.value)).to.be.gt(ONE_ETH_BI.mul(115).div(100));
      });

      it('should work normally for underwater account that must be liquidated', async () => {
        await setupBalances(borrowAccountNumber);
        await liquidatorProxy.prepareForLiquidation({
          liquidAccount,
          freezableMarketId: marketId,
          inputTokenAmount: amountWei,
          outputMarketId: core.marketIds.nativeUsdc!,
          minOutputAmount: ONE_BI,
          expirationTimestamp: NO_EXPIRY,
          extraData: DEFAULT_EXTRA_DATA,
        }, {
          value: additionalExecutionFee,
        });
        const result = await performUnwrapping();
        await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
          key: withdrawalKeys[0],
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalFailed);

        await performLiquidationAndCheckState(amountWei, false);
      });

      it('should work normally for underwater account when vault is frozen', async () => {
        await setupBalances(borrowAccountNumber2, false, false);
        await setupBalances(borrowAccountNumber);
        await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.nativeUsdc!,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          },
          {
            value: additionalExecutionFee,
          },
        );

        const filter = eventEmitter.filters.AsyncWithdrawalCreated();
        withdrawalKeys.push((await eventEmitter.queryFilter(filter))[0].args.key);

        await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount: liquidAccount2,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.nativeUsdc!,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          },
          {
            value: additionalExecutionFee,
          },
        );

        const result = await performUnwrapping(withdrawalKeys[withdrawalKeys.length - 1]);
        await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
          key: withdrawalKeys[withdrawalKeys.length - 1],
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });
        withdrawalKeys[0] = withdrawalKeys.pop()!;
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalFailed, ZERO_BI);

        await performLiquidationAndCheckState(ZERO_BI, true);
      });

      it('should work normally for expired account (same expired market as unwind)', async () => {
        await setupBalances(borrowAccountNumber, false, false);
        const owedMarket = core.marketIds.weth;
        await setExpiry(core, liquidAccount, owedMarket, 123);
        const expiry = await core.expiry.getExpiry(liquidAccount, owedMarket);
        await increaseByTimeDelta(1234);
        await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: owedMarket,
            minOutputAmount: ONE_BI,
            expirationTimestamp: expiry,
            extraData: DEFAULT_EXTRA_DATA,
          },
          {
            value: additionalExecutionFee,
          },
        );

        const result = await performUnwrapping();
        await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {
          key: withdrawalKeys[0],
          token: factory.address,
        });
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.Expired);

        // At this point the expiration should not be unset but the user's owed balance should be gt 0
        await expectProtocolBalanceIsGreaterThan(core, liquidAccount, owedMarket, ONE_BI, 0);
        expect(await core.expiry.getExpiry(liquidAccount, owedMarket)).to.eq(expiry);
      });

      it('should work for underwater account when there is already a pending deposit', async () => {
        await setupBalances(borrowAccountNumber, true, true, ZapType.Deposit);
        await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.nativeUsdc!,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          },
          {
            value: additionalExecutionFee,
          },
        );
        const result1 = await cancelWrapping();
        await expectEvent(eventEmitter, result1, 'AsyncDepositCancelledFailed', {
          key: depositKey,
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });
        const result2 = await performUnwrapping();
        await expectEvent(eventEmitter, result2, 'AsyncWithdrawalFailed', {
          key: withdrawalKeys[0],
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalFailed);

        await performLiquidationAndCheckState(amountWei, false);
      });

      it('should work for underwater account when there is already a pending withdrawal', async () => {
        await setupBalances(borrowAccountNumber, true, true, ZapType.Withdraw);
        const result1 = await performUnwrapping(withdrawalKeys[0]);
        await expectEvent(eventEmitter, result1, 'AsyncWithdrawalFailed', {
          key: withdrawalKeys[0],
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });

        const result2 = await liquidatorProxy.prepareForLiquidation(
          {
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.sub(smallAmountWei),
            outputMarketId: core.marketIds.nativeUsdc!,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          },
          {
            value: additionalExecutionFee,
          },
        );
        const filter = eventEmitter.filters.AsyncWithdrawalCreated();
        withdrawalKeys.push((await eventEmitter.queryFilter(filter, result2.blockNumber))[0].args.key);

        const result3 = await performUnwrapping(withdrawalKeys[withdrawalKeys.length - 1]);
        await expectEvent(eventEmitter, result3, 'AsyncWithdrawalFailed', {
          key: withdrawalKeys[withdrawalKeys.length - 1],
          token: factory.address,
          reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
        });
        await checkStateAfterUnwrapping(borrowAccountNumber, FinishState.WithdrawalFailed);

        await performLiquidationAndCheckState(amountWei, false);
      });

      it('should fail when liquid account is not a valid vault', async () => {
        const liquidAccount = { owner: ZERO_ADDRESS, number: ZERO_BI };
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          `FreezableVaultLiquidatorProxy: Invalid liquid account <${liquidAccount.owner}>`,
        );
      });

      it('should fail when expiration overflows', async () => {
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: MAX_UINT_256_BI,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'FreezableVaultLiquidatorProxy: Invalid expiration timestamp',
        );
      });

      it('should fail when position is not expired', async () => {
        const timestamp = await getBlockTimestamp(core.config.blockNumber);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: timestamp + 3600,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'FreezableVaultLiquidatorProxy: Account not expired',
        );
      });

      it('should fail when position expiration does not match input', async () => {
        await setupBalances(borrowAccountNumber, false, false);
        const owedMarket = core.marketIds.weth;
        await setExpiry(core, liquidAccount, owedMarket, 123);
        const expiry = await core.expiry.getExpiry(liquidAccount, owedMarket);
        await increaseByTimeDelta(1234);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: owedMarket,
            minOutputAmount: ONE_BI,
            expirationTimestamp: expiry + 321,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'FreezableVaultLiquidatorProxy: Expiration mismatch',
        );
      });

      it('should fail when liquid account has no supply', async () => {
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount: { owner: vault.address, number: borrowAccountNumber3 },
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'FreezableVaultLiquidatorProxy: Liquid account has no supply',
        );
      });

      it('should fail if minOutputAmount is too large', async () => {
        await setupBalances(borrowAccountNumber, true, false);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount: { owner: vault.address, number: borrowAccountNumber },
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: amountWei,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'GmxV2Library: minOutputAmount too large',
        );

        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount: { owner: vault.address, number: borrowAccountNumber },
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), amountWei]),
          }),
          'GmxV2Library: minOutputAmount too large',
        );

      });

      it('should fail when vault account is frozen', async () => {
        await setupBalances(borrowAccountNumber, true, false);
        await liquidatorProxy.prepareForLiquidation({
          liquidAccount,
          freezableMarketId: marketId,
          inputTokenAmount: amountWei,
          outputMarketId: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          expirationTimestamp: NO_EXPIRY,
          extraData: DEFAULT_EXTRA_DATA,
        });
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei,
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          `IsolationModeVaultV1Freezable: Account is frozen <${liquidAccount.owner.toLowerCase()}, ${liquidAccount.number.toString()}>`,
        );
      });

      it('should fail when vault withdraws too little', async () => {
        await setupBalances(borrowAccountNumber, true, false);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.div(3),
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          `IsolationModeVaultV1Freezable: Liquidation must be full balance <${liquidAccount.owner.toLowerCase()}, ${liquidAccount.number.toString()}>`,
        );
      });

      it(
        'should fail when vault attempts to create a withdrawal/deposit with a different conversion token',
        async () => {
          await setupBalances(borrowAccountNumber, true, true, ZapType.Deposit);
          await expectThrow(
            liquidatorProxy.prepareForLiquidation({
              liquidAccount,
              freezableMarketId: marketId,
              inputTokenAmount: amountWei,
              outputMarketId: core.marketIds.weth,
              minOutputAmount: ONE_BI,
              expirationTimestamp: NO_EXPIRY,
              extraData: DEFAULT_EXTRA_DATA,
            }),
            `FreezableVaultFactory: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
          );
        },
      );

      it('should fail when vault attempts to create 2x withdrawals with a different conversion token', async () => {
        await setupBalances(borrowAccountNumber, true, true, ZapType.Withdraw);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.sub(smallAmountWei),
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          `FreezableVaultFactory: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
        );
      });

      it('should fail if the structs are not retryable', async () => {
        await setupBalances(borrowAccountNumber, true, true);
        const result = await liquidatorProxy.prepareForLiquidation({
          liquidAccount,
          freezableMarketId: marketId,
          inputTokenAmount: amountWei,
          outputMarketId: core.marketIds.weth,
          minOutputAmount: ONE_BI,
          expirationTimestamp: NO_EXPIRY,
          extraData: DEFAULT_EXTRA_DATA,
        });
        const filter = eventEmitter.filters.AsyncWithdrawalCreated();
        withdrawalKeys.push((await eventEmitter.queryFilter(filter, result.blockNumber))[0].args.key);

        await expectThrow(
          performLiquidationAndCheckState(amountWei, false, true),
          'AsyncIsolationModeUnwrapperImpl: All trades must be retryable',
        );
      });

      it('should fail if reentered', async () => {
        await setupBalances(borrowAccountNumber, true, false);
        await expectThrow(
          liquidatorProxy.callPrepareForLiquidationAndTriggerReentrancy({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.div(3),
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'ReentrancyGuard: reentrant call',
        );
      });

      it('should fail if asset is not whitelisted for liquidation', async () => {
        await core.liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(marketId, liquidatorProxy.address);
        await setupBalances(borrowAccountNumber, true, false);
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.div(3),
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          `HasLiquidatorRegistry: Asset not whitelisted <${marketId.toString()}>`,
        );
      });

      it('should fail if account is not liquidatable', async () => {
        await expectThrow(
          liquidatorProxy.prepareForLiquidation({
            liquidAccount,
            freezableMarketId: marketId,
            inputTokenAmount: amountWei.div(3),
            outputMarketId: core.marketIds.weth,
            minOutputAmount: ONE_BI,
            expirationTimestamp: NO_EXPIRY,
            extraData: DEFAULT_EXTRA_DATA,
          }),
          'FreezableVaultLiquidatorProxy: Liquid account not liquidatable',
        );
      });
    });

    describe('#testCheckIsLiquidatble', () => {
      it('should fail if not liquidatable', async () => {
        await expectThrow(
          liquidatorProxy.testCheckIsLiquidatable(liquidAccount),
          'FreezableVaultLiquidatorProxy: Liquid account not liquidatable',
        );
      });

      it('should pass if liquidatable', async () => {
        const gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
        const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
        const wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(121);
        await vault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          wethAmount,
          BalanceCheckFlag.To,
        );

        await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '10');
        await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);
        await expect(liquidatorProxy.testCheckIsLiquidatable(liquidAccount)).to.not.be.reverted;
      });

      it('should pass if account is liquid status', async () => {
        const gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
        const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;
        const wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(121);
        await vault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          core.marketIds.weth,
          wethAmount,
          BalanceCheckFlag.To,
        );

        await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '10');
        await core.dolomiteMargin.ownerSetPriceOracle(marketId, core.testEcosystem!.testPriceOracle.address);

        await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.liquidatorProxyV1.address);
        await setupWETHBalance(core, core.hhUser5, parseEther('.2'), { address: core.dolomiteMargin.address });
        await depositIntoDolomiteMargin(
          core,
          core.hhUser5,
          defaultAccountNumber,
          core.marketIds.weth,
          parseEther('.2'),
        );
        await core.liquidatorProxyV1!.connect(core.hhUser5).liquidate(
          solidAccount,
          liquidAccount,
          { value: BigNumber.from('150000000000000000') },
          ONE_BI,
          [core.marketIds.weth],
          [marketId],
        );
        await liquidatorProxy.testCheckIsLiquidatable(liquidAccount);
      });
    });
  });
}
