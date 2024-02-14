import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  EventEmitterRegistry,
  IsolationModeFreezableLiquidatorProxy,
  IsolationModeFreezableLiquidatorProxy__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { takeSnapshot } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, BigNumberish, ethers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { AccountStruct } from '../../base/src/utils/constants';
import { createContractWithAbi } from '../../base/src/utils/dolomite-utils';
import { NO_EXPIRY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../base/test/utils';
import { expectEvent, expectProtocolBalance, expectWalletBalance } from '../../base/test/utils/assertions';
import { createDolomiteRegistryImplementation, createEventEmitter } from '../../base/test/utils/dolomite';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfigForGmxV2,
  setupCoreProtocol,
  setupGMBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from '../../base/test/utils/setup';
import { GMX_V2_CALLBACK_GAS_LIMIT, GMX_V2_EXECUTION_FEE } from '../src/gmx-v2-constructors';
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
import { getIsolationModeFreezableLiquidatorProxyConstructorParams } from 'packages/base/src/utils/constructors/dolomite';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = defaultAccountNumber.add(ONE_BI);
const borrowAccountNumber2 = borrowAccountNumber.add(ONE_BI);

const amountWei = ONE_ETH_BI.mul('1234'); // 1,234
const DEFAULT_EXTRA_DATA = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [parseEther('.5'), ONE_BI]);
const NEW_GENERIC_TRADER_PROXY = '0x905F3adD52F01A9069218c8D1c11E240afF61D2B';

const executionFee = process.env.COVERAGE !== 'true' ? GMX_V2_EXECUTION_FEE : GMX_V2_EXECUTION_FEE.mul(10);

describe('POC: dosLiquidationBytes32', () => {
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

  let liquidAccount: AccountStruct;
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
      await getIsolationModeFreezableLiquidatorProxyConstructorParams(core)
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
      executionFee,
    );
    underlyingToken = IGmxMarketToken__factory.connect(await factory.UNDERLYING_TOKEN(), core.hhUser1);
    unwrapper = await createGmxV2IsolationModeUnwrapperTraderV2(core, factory, gmxV2Library, gmxV2Registry);
    wrapper = await createGmxV2IsolationModeWrapperTraderV2(core, factory, gmxV2Library, gmxV2Registry);
    const priceOracle = await createGmxV2MarketTokenPriceOracle(core, gmxV2Registry);
    await priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

    // Use actual price oracle later
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds([...allowableMarketIds, marketId]);

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
    const trader = await IGenericTraderProxyV1__factory.connect(NEW_GENERIC_TRADER_PROXY, core.governance);
    await trader.ownerSetEventEmitterRegistry(eventEmitter.address);

    liquidAccount = { owner: vault.address, number: borrowAccountNumber };

    await setupGMBalance(core, core.hhUser1, amountWei.mul(2), vault);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei.mul(2));
    await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: executionFee });
    await vault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber2, amountWei, { value: executionFee });
    await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, amountWei);
    await expectProtocolBalance(core, vault.address, borrowAccountNumber2, marketId, amountWei);
    await expectWalletBalance(vault, underlyingToken, amountWei.mul(2));
    expect(await vault.isVaultAccountFrozen(defaultAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber)).to.eq(false);
    expect(await vault.isVaultAccountFrozen(borrowAccountNumber2)).to.eq(false);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
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

    it('DOS Liquidations with OOG via extra data', async () => {
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
        extraData: DEFAULT_EXTRA_DATA,
      });

      const filter = eventEmitter.filters.AsyncWithdrawalCreated();
      const withdrawalKey = (await eventEmitter.queryFilter(filter, prepareForLiquidationResult.blockNumber))[0].args
        .key;

      const result = await core
        .gmxEcosystemV2!.gmxWithdrawalHandler.connect(core.gmxEcosystemV2!.gmxExecutor)
        .executeWithdrawal(withdrawalKey, getOracleParams(core.tokens.weth.address, core.tokens.nativeUsdc!.address), {
          gasLimit: 20_500_000,
        });

      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {
        key: withdrawalKey,
        token: factory.address,
        reason: `OperationImpl: Undercollateralized account <${vault.address.toLowerCase()}, ${borrowAccountNumber.toString()}>`,
      });

      // restore snapshot to show how we desecrate things
      await beforePrepareForLiquidationSnapshot.restore();

      // create an extra data payload that has the first 32 bytes as the minimum output 1 and append to that garbage
      // we do this to cause a gas spike when loaded into memory and cause the afterWithdrawalExecution function to
      // revert
      const abi = ethers.utils.defaultAbiCoder;
      const garbageBytes = Buffer.alloc(100_000);
      const _extraData: ethers.utils.BytesLike = abi.encode(
        ['uint256', 'uint256', 'bytes'],
        [parseEther('.5'), 1, garbageBytes],
      );

      // POC should now fail after fix
      await expect(liquidatorProxy.prepareForLiquidation(
        {
          liquidAccount,
          freezableMarketId: marketId,
          inputTokenAmount: amountWei,
          outputMarketId: core.marketIds.nativeUsdc!,
          minOutputAmount: ONE_BI,
          expirationTimestamp: NO_EXPIRY,
          extraData: _extraData,
        },
        { gasLimit: 20_000_000 },
      )).to.be.revertedWith('GmxV2Library: Invalid extra data');
      /*
        diff --git a/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol
          b/contracts/external/interfaces/gmx/IGmxWithdrawalHandler.sol
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
            function createWithdrawal(
              address _account,
              CreateWithdrawalParams calldata _params
            ) external returns (bytes32);

            function cancelWithdrawal(bytes32 _key) external;
      */
    });
  });
});
