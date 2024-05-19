import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import {
  ARBIsolationModeTokenVaultV1,
  ARBIsolationModeTokenVaultV1__factory,
  ARBIsolationModeVaultFactory,
  ARBRegistry,
} from '../src/types';
import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_EMPTY,
  Network,
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
  createARBIsolationModeTokenVaultV1,
  createARBIsolationModeVaultFactory,
  createARBRegistry,
  createARBUnwrapperTraderV2,
  createARBWrapperTraderV2,
} from './arb-ecosystem-utils';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupARBBalance,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';

const defaultAccountNumber = '0';
const otherAccountNumber = '1';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('ARBIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let arbRegistry: ARBRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let arbFactory: ARBIsolationModeVaultFactory;
  let arbVault: ARBIsolationModeTokenVaultV1;
  let dArbMarketId: BigNumber;
  let otherAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await disableInterestAccrual(core, core.marketIds.arb!);

    arbRegistry = await createARBRegistry(core);

    const vaultImplementation = await createARBIsolationModeTokenVaultV1();
    arbFactory = await createARBIsolationModeVaultFactory(arbRegistry, vaultImplementation, core);

    unwrapper = await createARBUnwrapperTraderV2(arbFactory, core);
    wrapper = await createARBWrapperTraderV2(arbFactory, core);
    await core.chainlinkPriceOracleV1!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      arbFactory.address,
      await arbFactory.decimals(),
      await core.chainlinkPriceOracleV1!.getAggregatorByToken(core.tokens.arb!.address),
      ADDRESS_ZERO,
    );

    dArbMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, arbFactory, true, core.chainlinkPriceOracleV1);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(arbFactory.address, true);
    await arbFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await arbFactory.createVault(core.hhUser1.address);
    arbVault = setupUserVaultProxy<ARBIsolationModeTokenVaultV1>(
      await arbFactory.getVaultByAccount(core.hhUser1.address),
      ARBIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    otherAccount = {
      owner: arbVault.address,
      number: otherAccountNumber,
    };

    await setupNewGenericTraderProxy(core, dArbMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      await setupARBBalance(core, core.hhUser1, amountWei, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.arb!, amountWei);
      await arbVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        core.marketIds.arb!,
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
        outputMarket: dArbMarketId,
        inputMarket: core.marketIds.arb!,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate([otherAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, dArbMarketId);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(underlyingBalanceWei.value).to.eq(amountWei);
      expect(await arbVault.underlyingBalanceOf()).to.eq(amountWei);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, core.marketIds.arb!);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          arbVault.address,
          core.dolomiteMargin.address,
          arbFactory.address,
          core.tokens.arb!.address,
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
          arbVault.address,
          core.dolomiteMargin.address,
          arbFactory.address,
          core.tokens.dfsGlp!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          arbVault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          core.tokens.arb!.address,
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
          arbVault.address,
          core.dolomiteMargin.address,
          arbFactory.address,
          core.tokens.arb!.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work with ARB token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.arb!.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.usdc.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await wrapper.getExchangeCost(core.tokens.arb!.address, arbFactory.address, amountWei, BYTES_EMPTY))
        .to
        .eq(amountWei);
    });
  });
});
