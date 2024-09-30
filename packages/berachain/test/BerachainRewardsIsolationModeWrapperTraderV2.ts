import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import {
  IERC20,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
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
  setupUSDCBalance,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { BerachainRewardsRegistry, BerachainRewardsIsolationModeVaultFactory, BerachainRewardsIsolationModeTokenVaultV1, BerachainRewardsIsolationModeTokenVaultV1__factory } from '../src/types';
import { createBerachainRewardsRegistry, createBerachainRewardsIsolationModeTokenVaultV1, createBerachainRewardsIsolationModeVaultFactory, createBerachainRewardsUnwrapperTraderV2, createBerachainRewardsWrapperTraderV2 } from './berachain-ecosystem-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '1';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('BerachainRewardsIsolationModeWrapperTraderV2', () => {
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
  let otherAccount: AccountInfoStruct;

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
    otherAccount = {
      owner: beraVault.address,
      number: otherAccountNumber,
    };

    await setupNewGenericTraderProxy(core, dUsdcMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      await setupUSDCBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc!, amountWei);
      await beraVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        core.marketIds.usdc!,
        amountWei,
        BalanceCheckFlag.Both,
      );
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: ZERO_ADDRESS,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: ZERO_ADDRESS,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: dUsdcMarketId,
        inputMarket: core.marketIds.usdc!,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate([otherAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, dUsdcMarketId);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(underlyingBalanceWei.value).to.eq(amountWei);
      expect(await beraVault.underlyingBalanceOf()).to.eq(amountWei);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, core.marketIds.usdc!);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          beraVault.address,
          core.dolomiteMargin.address,
          beraFactory.address,
          core.tokens.usdc!.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          beraVault.address,
          core.dolomiteMargin.address,
          beraFactory.address,
          core.tokens.weth!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.weth!.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          beraVault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          underlyingToken.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          beraVault.address,
          core.dolomiteMargin.address,
          beraFactory.address,
          underlyingToken.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work with ARB token', async () => {
      expect(await wrapper.isValidInputToken(underlyingToken.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.weth.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await wrapper.getExchangeCost(underlyingToken.address, beraFactory.address, amountWei, BYTES_EMPTY))
        .to
        .eq(amountWei);
    });
  });
});
