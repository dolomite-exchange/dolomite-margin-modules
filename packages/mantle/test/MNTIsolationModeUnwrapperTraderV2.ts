import {
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2,
} from '@dolomite-exchange/modules-base/src/types';
import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
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
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import {
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
} from './mnt-ecosystem-utils';
import { sleep } from '@openzeppelin/upgrades';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('MNTIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let mntRegistry: MNTRegistry;
  let unwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let wrapper: SimpleIsolationModeWrapperTraderV2;
  let mntFactory: MNTIsolationModeVaultFactory;
  let mntVault: MNTIsolationModeTokenVaultV1;
  let dMntMarketId: BigNumber;
  let defaultAccount: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.Mantle));
    await disableInterestAccrual(core, core.marketIds.wmnt);

    mntRegistry = await createMNTRegistry(core);

    const vaultImplementation = await createMNTIsolationModeTokenVaultV1();
    mntFactory = await createMNTIsolationModeVaultFactory(mntRegistry, vaultImplementation, core);

    unwrapper = await createMNTUnwrapperTraderV2(mntFactory, core);
    wrapper = await createMNTWrapperTraderV2(mntFactory, core);

    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: mntFactory.address,
      decimals: 18,
      oracleInfos: await core.oracleAggregatorV2.getOraclesByToken(core.tokens.wmnt.address),
    });
    await core.chroniclePriceOracleV3
      .connect(core.governance)
      .ownerInsertOrUpdateOracleToken(
        mntFactory.address,
        await core.chroniclePriceOracleV3.getScribeByToken(core.tokens.wmnt.address),
        false,
      );

    dMntMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, mntFactory, true, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(mntFactory.address, true);
    await mntFactory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);

    await mntFactory.createVault(core.hhUser1.address);
    mntVault = setupUserVaultProxy<MNTIsolationModeTokenVaultV1>(
      await mntFactory.getVaultByAccount(core.hhUser1.address),
      MNTIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = {
      owner: mntVault.address,
      number: defaultAccountNumber,
    };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      await setupWMNTBalance(core, core.hhUser1, amountWei, mntVault);
      await mntVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      const cooldown = (await core.mantleRewardStation.cooldown()).toNumber() + 1_000;
      await advanceByTimeDelta(cooldown);

      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: mntVault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: mntVault.address,
        otherAccountNumber: defaultAccountNumber,
        inputMarket: dMntMarketId,
        outputMarket: core.marketIds.wmnt,
        inputAmount: amountWei,
        minOutputAmount: ZERO_BI,
        orderData: BYTES_EMPTY,
      });

      const genericTrader = await impersonate(core.genericTraderProxy.address, true);
      await core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, dMntMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await mntVault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.wmnt);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountWei);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper
          .connect(core.hhUser1)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.usdc.address,
            mntFactory.address,
            amountWei,
            BYTES_EMPTY,
          ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
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
      await setupWMNTBalance(core, core.hhUser1, amountWei, unwrapper);
      await core.tokens.wmnt.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.weth.address,
            mntFactory.address,
            amountWei,
            encodeExternalSellActionDataWithNoData(otherAmountWei),
          ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await setupWMNTBalance(core, core.hhUser1, amountWei, unwrapper);
      await core.tokens.wmnt.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper
          .connect(dolomiteMarginImpersonator)
          .exchange(
            core.hhUser1.address,
            core.dolomiteMargin.address,
            core.tokens.wmnt.address,
            mntFactory.address,
            ZERO_BI,
            encodeExternalSellActionDataWithNoData(otherAmountWei),
          ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(mntFactory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work with MNT', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.wmnt.address)).to.eq(true);
    });

    it('should fail with any other token', async () => {
      expect(await unwrapper.isValidOutputToken(core.tokens.usdc.address)).to.eq(false);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(
        await unwrapper.getExchangeCost(mntFactory.address, core.tokens.wmnt.address, amountWei, BYTES_EMPTY),
      ).to.eq(amountWei);
    });
  });
});
