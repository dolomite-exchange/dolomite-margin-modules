import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { depositIntoDolomiteMargin } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  advanceByTimeDelta,
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWMNTBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import {
  IWETH,
  MNTIsolationModeTokenVaultV1,
  MNTIsolationModeTokenVaultV1__factory,
  MNTIsolationModeVaultFactory,
  MNTRegistry,
} from '../src/types';
import {
  createMNTIsolationModeTokenVaultV1,
  createMNTIsolationModeVaultFactory,
  createMNTRegistry,
  createMNTUnwrapperTraderV2,
  createMNTWrapperTraderV2,
  setupWmntToken,
} from './mnt-ecosystem-utils';

const defaultAccountNumber = '0';
const otherAccountNumber = '1';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('MNTIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let mntVault: MNTIsolationModeTokenVaultV1;
  let dArbMarketId: BigNumber;
  let otherAccount: AccountInfoStruct;
  let underlyingToken: IWETH;
  let underlyingMarketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.Mantle));

    mntRegistry = await createMNTRegistry(core);

    underlyingToken = await setupWmntToken(core);
    underlyingMarketId = await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingToken.address);
    await disableInterestAccrual(core, underlyingMarketId);

    const vaultImplementation = await createMNTIsolationModeTokenVaultV1();
    mntFactory = await createMNTIsolationModeVaultFactory(mntRegistry, vaultImplementation, underlyingToken, core);

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: mntFactory.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(underlyingToken.address),
    });
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(
        mntFactory.address,
        await core.chroniclePriceOracleV3.getScribeByToken(underlyingToken.address),
        false,
      );

    unwrapper = await createMNTUnwrapperTraderV2(mntFactory, core);
    wrapper = await createMNTWrapperTraderV2(mntFactory, core);

    dArbMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await mntFactory.createVault(core.hhUser1.address);
    mntVault = setupUserVaultProxy<MNTIsolationModeTokenVaultV1>(
      await mntFactory.getVaultByAccount(core.hhUser1.address),
      MNTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    otherAccount = {
      owner: mntVault.address,
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
      await underlyingToken.connect(core.hhUser1).deposit({ value: amountWei });
      await underlyingToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, amountWei);

      const cooldown = (await core.mantleRewardStation.cooldown()).toNumber() + 1_000;
      await advanceByTimeDelta(cooldown);

      await mntVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        underlyingMarketId,
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
        inputMarket: underlyingMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate([otherAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, dArbMarketId);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(underlyingBalanceWei.value).to.eq(amountWei);
      expect(await mntVault.underlyingBalanceOf()).to.eq(amountWei);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(otherAccount, underlyingMarketId);
      expect(otherBalanceWei.value).to.eq(ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper
          .connect(core.hhUser1)
          .exchange(
            mntVault.address,
            core.dolomiteMargin.address,
            mntFactory.address,
            underlyingToken.address,
            amountWei,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
            mntVault.address,
            core.dolomiteMargin.address,
            mntFactory.address,
            core.tokens.weth.address,
            amountWei,
            encodeExternalSellActionDataWithNoData(ZERO_BI),
          ),
        `IsolationModeWrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
            mntVault.address,
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
        wrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
            mntVault.address,
            core.dolomiteMargin.address,
            mntFactory.address,
            underlyingToken.address,
            ZERO_BI,
            encodeExternalSellActionDataWithNoData(ZERO_BI),
          ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#isValidInputToken', () => {
    it('should work with MNT token', async () => {
      expect(await wrapper.isValidInputToken(underlyingToken.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await wrapper.isValidInputToken(core.tokens.usdc.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await wrapper.getExchangeCost(underlyingToken.address, mntFactory.address, amountWei, BYTES_EMPTY)).to.eq(
        amountWei,
      );
    });
  });
});
