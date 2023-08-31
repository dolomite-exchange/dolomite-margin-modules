import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import {
  GmxRegistryV2,
  GmxV2IsolationModeTokenVaultV1,
  GmxV2IsolationModeTokenVaultV1__factory,
  GmxV2IsolationModeUnwrapperTraderV2,
  GmxV2IsolationModeVaultFactory,
  GmxV2IsolationModeWrapperTraderV2,
  IGmxMarketToken,
} from 'src/types';
import { depositIntoDolomiteMargin } from 'src/utils/dolomite-utils';
import { BYTES_EMPTY, Network } from 'src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, sendEther, setEtherBalance, snapshot } from 'test/utils';
import { expectEvent, expectProtocolBalance, expectThrow, expectWalletBalance } from 'test/utils/assertions';
import {
  createGmxRegistryV2,
  createGmxV2IsolationModeTokenVaultV1,
  createGmxV2IsolationModeUnwrapperTraderV2,
  createGmxV2IsolationModeVaultFactory,
  createGmxV2IsolationModeWrapperTraderV2,
  getInitiateWrappingParams,
} from 'test/utils/ecosystem-token-utils/gmx';
import {
  CoreProtocol,
  disableInterestAccrual,
  setupCoreProtocol,
  setupGMBalance,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance,
} from 'test/utils/setup';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const wethAmount = parseEther('1');
const usdcAmount = BigNumber.from('1000000000'); // $1000
const DUMMY_DEPOSIT_KEY = '0x6d1ff6ffcab884211992a9d6b8261b7fae5db4d2da3a5eb58647988da3869d6f';

describe('GmxV2IsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IGmxMarketToken;
  let gmxRegistryV2: GmxRegistryV2;
  let unwrapper: GmxV2IsolationModeUnwrapperTraderV2;
  let wrapper: GmxV2IsolationModeWrapperTraderV2;
  let factory: GmxV2IsolationModeVaultFactory;
  let vault: GmxV2IsolationModeTokenVaultV1;
  let marketId: BigNumber;

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
    await core.testEcosystem!.testPriceOracle!.setPrice(factory.address, '1000000000000000000000000000000');
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc!);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GmxV2IsolationModeTokenVaultV1>(
      vaultAddress,
      GmxV2IsolationModeTokenVaultV1__factory,
      core.hhUser1
    );

    await setupWETHBalance(core, core.hhUser1, wethAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, wethAmount);

    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
    await wrapper.connect(core.governance).setHandlerStatus(core.gmxEcosystem!.gmxDepositHandler.address, true);
    await wrapper.connect(core.governance).setHandlerStatus(core.gmxEcosystem!.gmxWithdrawalHandler.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await wrapper.GMX_REGISTRY_V2()).to.eq(gmxRegistryV2.address);
    });
  });

  describe('#initiateWrapping', () => {
    it('should work normally with long token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') } // @follow-up How to calculate executionFee
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should work normally with short token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') } // @follow-up How to calculate executionFee
      );

      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });
  });

  describe('#afterDepositExecution', () => {
    it('should work normally with long token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;

      await setupGMBalance(core, wrapper.address, 10, vault);
      const depositExecutor = await impersonate(core.gmxEcosystem!.gmxDepositHandler.address, true);
      // @todo Helper function for this
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [
            {
              key: 'longTokenAmount',
              value: wethAmount,
            },
            {
              key: 'shortTokenAmount',
              value: 0,
            },
            {
              key: 'receivedMarketToken',
              value: 10,
            },
          ],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };
      await wrapper.connect(depositExecutor).afterDepositExecution(depositKey, deposit, eventData);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 10);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      await expectWalletBalance(vault.address, underlyingToken, 10);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should work normally with short token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        BalanceCheckFlag.Both
      );
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;

      await setupGMBalance(core, wrapper.address, 10, vault);
      const depositExecutor = await impersonate(core.gmxEcosystem!.gmxDepositHandler.address, true);
      // @todo Helper function for this
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.nativeUsdc!.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: 0,
          initialShortTokenAmount: usdcAmount,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [
            {
              key: 'longTokenAmount',
              value: 0,
            },
            {
              key: 'shortTokenAmount',
              value: usdcAmount,
            },
            {
              key: 'receivedMarketToken',
              value: 10,
            },
          ],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };
      await wrapper.connect(depositExecutor).afterDepositExecution(depositKey, deposit, eventData);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 10);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, 0);
      await expectWalletBalance(vault.address, underlyingToken, 10);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should work when received market tokens equals min market tokens', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );
      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;

      await setupGMBalance(core, wrapper.address, 1, vault);
      const depositExecutor = await impersonate(core.gmxEcosystem!.gmxDepositHandler.address, true);
      // @todo Helper function for this
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [
            {
              key: 'longTokenAmount',
              value: wethAmount,
            },
            {
              key: 'shortTokenAmount',
              value: 0,
            },
            {
              key: 'receivedMarketToken',
              value: 1,
            },
          ],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };
      await wrapper.connect(depositExecutor).afterDepositExecution(depositKey, deposit, eventData);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      await expectWalletBalance(vault.address, underlyingToken, 1);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should fail when not called by deposit handler', async () => {
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };

      await expectThrow(
        wrapper.connect(core.hhUser1).afterDepositExecution(DUMMY_DEPOSIT_KEY, deposit, eventData),
        `GmxV2IsolationModeWrapperV2: Only handler can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail when deposit was not created through wrapper', async () => {
      const depositExecutor = await impersonate(core.gmxEcosystem!.gmxDepositHandler.address, true);
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };

      await expectThrow(
        wrapper.connect(depositExecutor).afterDepositExecution(DUMMY_DEPOSIT_KEY, deposit, eventData),
        'GmxV2IsolationModeWrapperV2: Invalid deposit key'
      );
    });
  });

  describe('#afterDepositCancellation', () => {
    it('should work normally with long token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);
      const wethBalanceBefore = await core.tokens.weth.balanceOf(core.dolomiteMargin.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelDeposit(depositKey);

      expect(await core.tokens.weth.balanceOf(core.dolomiteMargin.address)).to.eq(wethBalanceBefore);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 0);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.weth, wethAmount);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should work normally with short token', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
      const usdcBalanceBefore = await core.tokens.nativeUsdc!.balanceOf(core.dolomiteMargin.address);

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.nativeUsdc!,
        usdcAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );

      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 1);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, 0);
      expect(await vault.isVaultFrozen()).to.eq(true);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      await vault.connect(core.hhUser1).cancelDeposit(depositKey);

      expect(await core.tokens.nativeUsdc!.balanceOf(core.dolomiteMargin.address)).to.eq(usdcBalanceBefore);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, marketId, 0);
      await expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.nativeUsdc!, usdcAmount);
      expect(await vault.isVaultFrozen()).to.eq(false);
      expect(await vault.isShouldSkipTransfer()).to.eq(false);
      expect(await vault.isSourceIsWrapper()).to.eq(false);
    });

    it('should fail when not called by deposit handler', async () => {
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };

      await expectThrow(
        wrapper.connect(core.hhUser1).afterDepositCancellation(DUMMY_DEPOSIT_KEY, deposit, eventData),
        `GmxV2IsolationModeWrapperV2: Only handler can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail when deposit was not created through wrapper', async () => {
      const depositExecutor = await impersonate(core.gmxEcosystem!.gmxDepositHandler.address, true);
      const deposit = {
        addresses: {
          account: wrapper.address,
          receiver: wrapper.address,
          callbackContract: wrapper.address,
          uiFeeReceiver: ZERO_ADDRESS,
          market: underlyingToken.address,
          initialLongToken: core.tokens.weth.address,
          initialShortToken: core.tokens.usdc.address,
          longTokenSwapPath: [],
          shortTokenSwapPath: [],
        },
        numbers: {
          initialLongTokenAmount: parseEther('1'),
          initialShortTokenAmount: 0,
          minMarketTokens: 1,
          updatedAtBlock: 123123123,
          executionFee: parseEther('.01'),
          callbackGasLimit: 850000,
        },
        flags: {
          shouldUnwrapNativeToken: false,
        },
      };
      const eventData = {
        addressItems: {
          items: [],
          arrayItems: [],
        },
        uintItems: {
          items: [],
          arrayItems: [],
        },
        intItems: {
          items: [],
          arrayItems: [],
        },
        boolItems: {
          items: [],
          arrayItems: [],
        },
        bytes32Items: {
          items: [],
          arrayItems: [],
        },
        bytesItems: {
          items: [],
          arrayItems: [],
        },
        stringItems: {
          items: [],
          arrayItems: [],
        },
      };

      await expectThrow(
        wrapper.connect(depositExecutor).afterDepositCancellation(DUMMY_DEPOSIT_KEY, deposit, eventData),
        'GmxV2IsolationModeWrapperV2: Invalid deposit key'
      );
    });

    xit('should handle case when we receive callback but our function fails', async () => {});
  });

  describe('#cancelDeposit', () => {
    it('should work normally', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;

      // Mine blocks so we can cancel deposit
      await mineBlocks(1200);
      const result = await vault.connect(core.hhUser1).cancelDeposit(depositKey);
      await expectEvent(wrapper, result, 'DepositCancelled', {
        key: depositKey,
      });
    });

    it('should fail if not called by deposit creator (vault)', async () => {
      await vault.connect(core.hhUser1).transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        BalanceCheckFlag.Both
      );

      const initiateWrappingParams = await getInitiateWrappingParams(
        borrowAccountNumber,
        core.marketIds.weth,
        wethAmount,
        marketId,
        1,
        wrapper
      );
      await vault.connect(core.hhUser1).initiateWrapping(
        borrowAccountNumber,
        initiateWrappingParams.marketPath,
        initiateWrappingParams.amountIn,
        initiateWrappingParams.minAmountOut,
        initiateWrappingParams.traderParams,
        initiateWrappingParams.makerAccounts,
        initiateWrappingParams.userConfig,
        { value: parseEther('.01') }
      );
      const filter = wrapper.filters.DepositCreated();
      const depositKey = (await wrapper.queryFilter(filter))[0].args.key;

      await expectThrow(
        wrapper.connect(core.hhUser1).cancelDeposit(depositKey),
        'GmxV2IsolationModeWrapperV2: Only vault can cancel deposit'
      );
    });
  });

  describe('#ownerWithdrawETH', () => {
    it('should work normally', async () => {
      await setEtherBalance(wrapper.address, parseEther("1"));
      await expect(() => wrapper.connect(core.governance).ownerWithdrawETH(core.hhUser1.address))
      .to.changeEtherBalance(core.hhUser1, parseEther("1"));
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).ownerWithdrawETH(core.hhUser1.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if call fails', async () => {
      await setEtherBalance(wrapper.address, parseEther("1"));
      await expectThrow(
        wrapper.connect(core.governance).ownerWithdrawETH(core.governance.address),
        'GmxV2IsolationModeWrapperV2: Unable to withdraw funds',
        );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work normally', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.weth.address)).to.eq(true);
      expect(await wrapper.isValidInputToken(core.tokens.nativeUsdc!.address)).to.eq(true);
    });

    it('should fail if token is not one of two assets in LP', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.wbtc.address)).to.eq(false);
      expect(await wrapper.isValidInputToken(core.hhUser1.address)).to.eq(false);
    });
  });

  describe('#setHandlerStatus', () => {
    it('should work normally', async () => {
      await wrapper.connect(core.governance).setHandlerStatus(core.gmxEcosystem!.gmxDepositHandler.address, true);
      expect(await wrapper.getHandlerStatus(core.gmxEcosystem!.gmxDepositHandler.address)).to.eq(true);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).setHandlerStatus(core.gmxEcosystem!.gmxDepositHandler.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.nativeUsdc!.address, factory.address, wethAmount, BYTES_EMPTY),
        'GmxV2IsolationModeWrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});

async function mineBlocks(blockNumber: number) {
  let i = blockNumber;
  while (i > 0) {
    await ethers.provider.send('evm_mine', []);
    i--;
  }
}
