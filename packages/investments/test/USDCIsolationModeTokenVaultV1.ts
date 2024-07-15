import { expect } from 'chai';
import {
  USDCIsolationModeTokenVaultV1,
  USDCIsolationModeTokenVaultV1__factory,
  USDCIsolationModeVaultFactory,
  USDCRegistry
} from '../src/types';
import {
  IERC20,
  IERC20__factory,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectThrow, expectWalletBalanceIsBetween } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupNativeUSDCBalance,
  setupTestMarket,
  setupUserVaultProxy,
  setupWETHBalance
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  createUSDCIsolationModeTokenVaultV1,
  createUSDCIsolationModeVaultFactory,
  createUSDCRegistry,
  createUSDCUnwrapperTraderV2,
  createUSDCWrapperTraderV2
} from './usdc-ecosystem-utils';
import { BigNumber } from 'ethers';
import { depositIntoDolomiteMargin } from 'packages/base/src/utils/dolomite-utils';
import { AAVE_LENDING_POOL_MAP, AAVE_NATIVE_USDC_A_TOKEN } from 'packages/base/src/utils/constants';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { defaultAbiCoder } from 'ethers/lib/utils';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('101');
const otherAccountNumber = BigNumber.from('123');

const usdcPrice = BigNumber.from('1000000000000000000000000000000');
const usdcLendingPoolAmount = BigNumber.from('100000000000'); // 100,000 USDC
const usdcAmount = BigNumber.from('1000000000'); // 1,000 USDC

describe('USDCIsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let usdcRegistry: USDCRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let usdcFactory: USDCIsolationModeVaultFactory;
  let vaultImplementation: USDCIsolationModeTokenVaultV1;
  let usdcVault: USDCIsolationModeTokenVaultV1;
  let aToken: IERC20;
  let marketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 231_190_060,
      network: Network.ArbitrumOne,
    });
    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.nativeUsdc);

    usdcRegistry = await createUSDCRegistry(core);

    vaultImplementation = await createUSDCIsolationModeTokenVaultV1();
    usdcFactory = await createUSDCIsolationModeVaultFactory(usdcRegistry, vaultImplementation, core);

    unwrapper = await createUSDCUnwrapperTraderV2(usdcFactory, core);
    wrapper = await createUSDCWrapperTraderV2(usdcFactory, core);

    await core.testEcosystem?.testPriceOracle.setPrice(usdcFactory.address, usdcPrice);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, usdcFactory, true, core.testEcosystem!.testPriceOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(usdcFactory.address, true);
    await usdcFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await usdcFactory.createVault(core.hhUser1.address);
    usdcVault = setupUserVaultProxy<USDCIsolationModeTokenVaultV1>(
      await usdcFactory.getVaultByAccount(core.hhUser1.address),
      USDCIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await usdcRegistry.connect(core.governance).ownerSetAaveLendingPool(AAVE_LENDING_POOL_MAP[Network.ArbitrumOne]);
    await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);

    aToken = IERC20__factory.connect(AAVE_NATIVE_USDC_A_TOKEN[Network.ArbitrumOne], core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#borrowToIncreaseStrategySize', () => {
    it('should work normally with Aave', async () => {
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await usdcVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both
      );
      await expectProtocolBalance(core, usdcVault, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);

      const extraData = defaultAbiCoder.encode(
        ['address', 'bytes'],
        [wrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]
      );
      await usdcVault.borrowToIncreaseStrategySize(
        borrowAccountNumber,
        otherAccountNumber,
        1,
        usdcAmount,
        extraData
      );
      await expectProtocolBalance(core, usdcVault, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await expectProtocolBalance(
        core,
        usdcVault,
        borrowAccountNumber,
        core.marketIds.nativeUsdc,
        ZERO_BI.sub(usdcAmount)
      );
      await expectProtocolBalance(core, usdcVault, otherAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, usdcVault, otherAccountNumber, marketId, usdcAmount);
      expect(await core.tokens.nativeUsdc.balanceOf(usdcVault.address)).to.eq(ZERO_BI);
      expectWalletBalanceIsBetween(usdcVault, aToken, usdcAmount.sub(5), usdcAmount.add(5));
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        usdcVault.connect(core.hhUser2).borrowToIncreaseStrategySize(
          borrowAccountNumber,
          otherAccountNumber,
          1,
          usdcAmount,
          BYTES_EMPTY
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferToIncreaseStrategySize', () => {
    it('should work normally with Aave', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const extraData = defaultAbiCoder.encode(
        ['address', 'bytes'],
        [wrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]
      );
      await usdcVault.transferToIncreaseStrategySize(
        defaultAccountNumber,
        otherAccountNumber,
        1,
        usdcAmount,
        extraData
      );

      await expectProtocolBalance(core, usdcVault, otherAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
      await expectProtocolBalance(core, usdcVault, otherAccountNumber, marketId, usdcAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, marketId, ZERO_BI);
      expect(await core.tokens.nativeUsdc.balanceOf(usdcVault.address)).to.eq(ZERO_BI);
      expectWalletBalanceIsBetween(usdcVault, aToken, usdcAmount.sub(5), usdcAmount.add(5));
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        usdcVault.connect(core.hhUser2).transferToIncreaseStrategySize(
          defaultAccountNumber,
          otherAccountNumber,
          1,
          usdcAmount,
          BYTES_EMPTY
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#decreaseStrategySizeAndTransfer', () => {
    it('should work normally with Aave', async () => {
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);

      const wrapData = defaultAbiCoder.encode(
        ['address', 'bytes'],
        [wrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]
      );
      await usdcVault.transferToIncreaseStrategySize(
        defaultAccountNumber,
        otherAccountNumber,
        1,
        usdcAmount,
        wrapData
      );
      await expectProtocolBalance(core, usdcVault, otherAccountNumber, marketId, usdcAmount);

      const unwrapData = defaultAbiCoder.encode(['address', 'bytes'], [unwrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]);
      await usdcVault.decreaseStrategySizeAndTransfer(
        otherAccountNumber,
        defaultAccountNumber,
        1,
        usdcAmount,
        unwrapData
      );
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.nativeUsdc, usdcAmount);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        usdcVault.connect(core.hhUser2).decreaseStrategySizeAndTransfer(
          otherAccountNumber,
          defaultAccountNumber,
          1,
          usdcAmount,
          BYTES_EMPTY
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#decreaseStrategySizeAndRepayDebt', () => {
    it('should work normally with Aave', async () => {
      await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await usdcVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        core.marketIds.weth,
        ONE_ETH_BI,
        BalanceCheckFlag.Both
      );
      const wrapData = defaultAbiCoder.encode(
        ['address', 'bytes'],
        [wrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]
      );
      await usdcVault.borrowToIncreaseStrategySize(
        borrowAccountNumber,
        otherAccountNumber,
        1,
        usdcAmount,
        wrapData
      );

      const unwrapData = defaultAbiCoder.encode(['address', 'bytes'], [unwrapper.address, defaultAbiCoder.encode(['uint256'], [usdcAmount])]);
      await usdcVault.decreaseStrategySizeAndRepayDebt(
        otherAccountNumber,
        borrowAccountNumber,
        1,
        usdcAmount,
        unwrapData
      );
      await expectProtocolBalance(core, usdcVault, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
      await expectProtocolBalance(core, usdcVault, borrowAccountNumber, core.marketIds.nativeUsdc, ZERO_BI);
    });

    it('should fail if not called by the vault owner', async () => {
      await expectThrow(
        usdcVault.connect(core.hhUser2).decreaseStrategySizeAndRepayDebt(
          otherAccountNumber,
          borrowAccountNumber,
          1,
          usdcAmount,
          BYTES_EMPTY
        ),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });
});
