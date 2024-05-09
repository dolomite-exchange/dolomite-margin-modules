import {
  IEventEmitterRegistry,
  TestIsolationModeFreezableLiquidatorProxy,
  TestIsolationModeFreezableLiquidatorProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { AccountStruct } from '@dolomite-exchange/modules-base/src/utils/constants';
import {
  getIsolationModeFreezableLiquidatorProxyConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  BYTES_ZERO,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectWalletAllowance,
  expectWalletBalance,
} from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { toZapBigNumber } from '@dolomite-exchange/modules-base/test/utils/liquidation-utils';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupUserVaultProxy,
  setupWETHBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
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
  getOracleParams,
} from '@dolomite-exchange/modules-gmx-v2/test/gmx-v2-ecosystem-utils';
import { ZapConfig, ZapOutputParam } from '@dolomite-exchange/zap-sdk';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ContractTransaction } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234
const smallAmountWei = amountWei.mul(1).div(100);

const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const executionFee = parseEther('0.01'); // from the contracts directly
const additionalExecutionFee = executionFee;

if (process.env.COVERAGE !== 'true') {
  describe('ZapIntegration', () => {
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

      gmxV2Registry = core.gmxEcosystemV2.live.registry;

      factory = core.gmxEcosystemV2.live.gmEthUsd.factory;
      underlyingToken = IGmxMarketToken__factory.connect(await factory.UNDERLYING_TOKEN(), core.hhUser1);
      unwrapper = core.gmxEcosystemV2.live.gmEthUsd.unwrapper;
      wrapper = core.gmxEcosystemV2.live.gmEthUsd.wrapper;

      // Use actual price oracle later
      marketId = BigNumber.from(core.marketIds.dGmEth);
      await disableInterestAccrual(core, core.marketIds.weth);
      await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

      await factory.connect(core.governance).ownerSetExecutionFee(executionFee);

      await gmxV2Registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, unwrapper.address);
      await gmxV2Registry.connect(core.governance).ownerSetWrapperByToken(factory.address, wrapper.address);
      await gmxV2Registry.connect(core.governance).ownerSetGmxDepositVault(core.gmxEcosystemV2.gmxDepositVault.address);
      await gmxV2Registry.connect(core.governance).ownerSetGmxWithdrawalVault(
        core.gmxEcosystemV2.gmxWithdrawalVault.address,
      );
      const gmxV2Library = await createGmxV2Library();
      // 0000000000000000000000000000000000000000000000000016da65dd1a3f08
      // 0000000000000000000000000000000000000000000000000000000000000000

      const unwrapperImplementation = await createGmxV2IsolationModeUnwrapperTraderV2Implementation(core, gmxV2Library);
      const wrapperImplementation = await createGmxV2IsolationModeWrapperTraderV2Implementation(core, gmxV2Library);
      await core.gmxEcosystemV2.live.gmEthUsd.unwrapperProxy.connect(core.governance)
        .upgradeTo(unwrapperImplementation.address);
      await core.gmxEcosystemV2.live.gmEthUsd.wrapperProxy.connect(core.governance)
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

      await setupGMBalance(core, core.hhUser1, amountWei.mul(2), vault);
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

    describe('#initiateUnwrapping', () => {
      let wethAmount: BigNumber;

      async function getZapConfigForUnwrap(): Promise<Partial<ZapConfig>> {
        const gasPrice = await core.hhUser1.getGasPrice();
        return {
          disallowAggregator: true,
          isLiquidation: false,
          gasPriceInWei: toZapBigNumber(gasPrice),
        };
      }

      async function setupBalances(
        account: BigNumber,
      ) {
        // Create debt for the position
        const gmPrice = (await core.dolomiteMargin.getMarketPrice(marketId)).value;
        const wethPrice = (await core.dolomiteMargin.getMarketPrice(core.marketIds.weth)).value;

        wethAmount = amountWei.mul(gmPrice).div(wethPrice).mul(100).div(125);
        await vault.transferFromPositionWithOtherToken(
          account,
          defaultAccountNumber,
          core.marketIds.weth,
          wethAmount,
          BalanceCheckFlag.To,
        );
      }

      async function getZapForPreparingForUnwrap(outputMarketId: BigNumberish): Promise<ZapOutputParam> {
        const unwrapZaps = await core.zap.getSwapExactTokensForTokensParams(
          { marketId: toZapBigNumber(marketId), symbol: 'GM' },
          toZapBigNumber(amountWei),
          { marketId: toZapBigNumber(outputMarketId), symbol: 'USDC' },
          toZapBigNumber(ONE_BI),
          solidAccount.owner,
          await getZapConfigForUnwrap(),
        );
        expect(unwrapZaps.length).to.eq(1);

        return unwrapZaps[0];
      }

      async function performUnwrapping(key?: string): Promise<ContractTransaction> {
        if (!key) {
          const filter = eventEmitter.filters.AsyncWithdrawalCreated();
          withdrawalKeys.push((await eventEmitter.queryFilter(filter))[0].args.key);
        }
        return await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
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
        const partitionedTotalOutputAmount = withdrawals.reduce<Record<string, BigNumber>>((acc, withdrawal, i) => {
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
            const wethOutputAmount = partitionedTotalOutputAmount[core.tokens.weth.address];
            if (wethOutputAmount && wethOutputAmount.gt(0)) {
              await expectProtocolBalance(
                core,
                vault.address,
                accountNumber,
                core.marketIds.weth,
                wethAmount.mul(-1).add(wethOutputAmount),
              );
            }
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

      it('should work normally for long token', async () => {
        await setupBalances(borrowAccountNumber);
        const unwrapZap = await getZapForPreparingForUnwrap(core.marketIds.weth);
        await vault.initiateUnwrapping(
          liquidAccount.number,
          unwrapZap.amountWeisPath[0].toFixed(),
          core.tokens.weth.address,
          unwrapZap.amountWeisPath[1].toFixed(),
          unwrapZap.traderParams[0].tradeData,
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
      });

      it('should work normally for short token', async () => {
        await setupBalances(borrowAccountNumber);
        const unwrapZap = await getZapForPreparingForUnwrap(core.marketIds.nativeUsdc);
        await vault.initiateUnwrapping(
          liquidAccount.number,
          unwrapZap.amountWeisPath[0].toFixed(),
          core.tokens.nativeUsdc.address,
          unwrapZap.amountWeisPath[1].toFixed(),
          unwrapZap.traderParams[0].tradeData,
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
      });
    });
  });
}
