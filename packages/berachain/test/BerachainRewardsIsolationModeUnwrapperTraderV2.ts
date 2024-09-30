import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  Network,
  ONE_ETH_BI,
  ZERO_BI
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupUSDCBalance,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { BerachainRewardsRegistry, BerachainRewardsIsolationModeVaultFactory, BerachainRewardsIsolationModeTokenVaultV1, BerachainRewardsIsolationModeTokenVaultV1__factory } from '../src/types';
import { createBerachainRewardsRegistry, createBerachainRewardsIsolationModeTokenVaultV1, createBerachainRewardsIsolationModeVaultFactory, createBerachainRewardsUnwrapperTraderV2, createBerachainRewardsWrapperTraderV2 } from './berachain-ecosystem-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('BerachainRewardsIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let underlyingToken: IERC20;
  let beraRegistry: BerachainRewardsRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let beraFactory: BerachainRewardsIsolationModeVaultFactory;
  let beraVault: BerachainRewardsIsolationModeTokenVaultV1;
  let dUsdcMarketId: BigNumber;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 4_853_900,
      network: Network.Berachain,
    });
    await disableInterestAccrual(core, core.marketIds.usdc);

    beraRegistry = await createBerachainRewardsRegistry(core);
    underlyingToken = core.tokens.usdc;

    const vaultImplementation = await createBerachainRewardsIsolationModeTokenVaultV1();
    beraFactory = await createBerachainRewardsIsolationModeVaultFactory(beraRegistry, underlyingToken, vaultImplementation, core);

    unwrapper = await createBerachainRewardsUnwrapperTraderV2(beraFactory, core);
    wrapper = await createBerachainRewardsWrapperTraderV2(beraFactory, core);

    dUsdcMarketId = await core.dolomiteMargin.getNumMarkets();
    await core.testEcosystem!.testPriceOracle.setPrice(beraFactory.address, ONE_ETH_BI);
    await setupTestMarket(core, beraFactory, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(beraFactory.address, true);
    await beraFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await beraFactory.createVault(core.hhUser1.address);
    beraVault = setupUserVaultProxy<BerachainRewardsIsolationModeTokenVaultV1>(
      await beraFactory.getVaultByAccount(core.hhUser1.address),
      BerachainRewardsIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = {
      owner: beraVault.address,
      number: defaultAccountNumber,
    };

    await setupNewGenericTraderProxy(core, dUsdcMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      await setupUSDCBalance(core, core.hhUser1, amountWei, beraVault);
      await beraVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: beraVault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: beraVault.address,
        otherAccountNumber: defaultAccountNumber,
        inputMarket: dUsdcMarketId,
        outputMarket: core.marketIds.usdc!,
        inputAmount: amountWei,
        minOutputAmount: ZERO_BI,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!.address, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, dUsdcMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await beraVault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc!);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountWei);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          beraFactory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await setupUSDCBalance(core, core.hhUser1, amountWei, unwrapper);
      await underlyingToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          beraFactory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await setupUSDCBalance(core, core.hhUser1, amountWei, unwrapper);
      await underlyingToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          underlyingToken.address,
          beraFactory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(beraFactory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work with ARB', async () => {
      expect(await unwrapper.isValidOutputToken(underlyingToken.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await unwrapper.getExchangeCost(
        beraFactory.address,
        underlyingToken.address,
        amountWei,
        BYTES_EMPTY,
      )).to.eq(amountWei);
    });
  });
});
