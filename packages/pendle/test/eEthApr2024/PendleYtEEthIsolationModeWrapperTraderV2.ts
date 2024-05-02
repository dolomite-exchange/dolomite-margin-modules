import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectProtocolBalance, expectThrow, expectWalletBalance } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWeEthBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseRouter } from '@pendle/sdk-v2';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import {
  IERC20,
  IPendleYtToken,
  PendleRegistry,
  PendleYtIsolationModeTokenVaultV1,
  PendleYtIsolationModeTokenVaultV1__factory,
  PendleYtIsolationModeUnwrapperTraderV2,
  PendleYtIsolationModeVaultFactory,
  PendleYtIsolationModeWrapperTraderV2,
  PendleYtPriceOracle,
} from '../../src/types';
import {
  createPendleRegistry,
  createPendleYtIsolationModeTokenVaultV1,
  createPendleYtIsolationModeUnwrapperTraderV2,
  createPendleYtIsolationModeVaultFactory,
  createPendleYtIsolationModeWrapperTraderV2,
  createPendleYtPriceOracle,
} from '../pendle-ecosystem-utils';
import { encodeSwapExactTokensForYtV3 } from '../pendle-utils';
import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const FIVE_BIPS = 0.0005;

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';
const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtEEthJun2024IsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingYtToken: IPendleYtToken;
  let underlyingMarketId: BigNumber;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendleYtIsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtIsolationModeWrapperTraderV2;
  let factory: PendleYtIsolationModeVaultFactory;
  let vault: PendleYtIsolationModeTokenVaultV1;
  let priceOracle: PendleYtPriceOracle;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.tokens.weEth;
    underlyingYtToken = core.pendleEcosystem!.weEthJun2024.ytWeEthToken;

    const userVaultImplementation = await createPendleYtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthJun2024.weEthMarket,
      core.pendleEcosystem!.weEthJun2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    factory = await createPendleYtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      initialAllowableDebtMarketIds,
      [],
      underlyingYtToken,
      userVaultImplementation,
    );
    unwrapper = await createPendleYtIsolationModeUnwrapperTraderV2(core, underlyingToken, factory, pendleRegistry);
    wrapper = await createPendleYtIsolationModeWrapperTraderV2(core, underlyingToken, factory, pendleRegistry);
    priceOracle = await createPendleYtPriceOracle(core, factory, pendleRegistry, underlyingToken);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendleYtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendleYtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: borrowAccountNumber };

    await setupWeEthBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.weEth, ONE_ETH_BI);
    await vault.transferIntoPositionWithOtherToken(
      ZERO_BI,
      borrowAccountNumber,
      core.marketIds.weEth,
      ONE_ETH_BI,
      BalanceCheckFlag.Both
    );

    await expectProtocolBalance(core, vault, borrowAccountNumber, core.marketIds.weEth, ONE_ETH_BI);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weEth)).value).to.eq(ONE_ETH_BI);

    await setupNewGenericTraderProxy(core, underlyingMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { extraOrderData, minAmountOut } = await encodeSwapExactTokensForYtV3(
        Network.ArbitrumOne,
        wrapper.address,
        core.pendleEcosystem.weEthJun2024.weEthMarket.address,
        core.tokens.weEth.address,
        ONE_ETH_BI,
        0.001
      );

      const actions = await wrapper.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: ZERO_ADDRESS,
        primaryAccountNumber: borrowAccountNumber,
        otherAccountOwner: ZERO_ADDRESS,
        otherAccountNumber: borrowAccountNumber,
        outputMarket: underlyingMarketId,
        inputMarket: core.marketIds.weEth,
        minOutputAmount: ONE_BI,
        inputAmount: ONE_ETH_BI,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await expectWalletBalance(wrapper.address, underlyingYtToken, ZERO_BI);
      await core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.gte(minAmountOut);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.gte(minAmountOut);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weEth);
      expect(otherBalanceWei.value).to.eq(0);

      await expectWalletBalance(wrapper.address, underlyingToken, ZERO_BI);
      await expectWalletBalance(wrapper.address, underlyingYtToken, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper
          .connect(core.hhUser1)
          .exchange(
            vault.address,
            core.dolomiteMargin.address,
            factory.address,
            core.tokens.usdc.address,
            usableUsdcAmount,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if trade originator is not a vault', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          OTHER_ADDRESS,
          usableUsdcAmount,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `IsolationModeWrapperTraderV2: Invalid trade originator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not whitelisted', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          OTHER_ADDRESS,
          usableUsdcAmount,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.weEth.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weEth.address,
          ZERO_BI,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#pendleVaultRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.weEth.address, factory.address, amountWei, BYTES_EMPTY),
        'PendleYtWrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
