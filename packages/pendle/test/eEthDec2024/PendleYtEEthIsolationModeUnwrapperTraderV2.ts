import { AccountInfoStruct } from '@dolomite-exchange/modules-base/src/utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupNewGenericTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWeEthBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import {
  IERC20,
  IPendleSyToken,
  IPendleSyToken__factory,
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
import { encodeSwapExactYtForTokensV3 } from '../pendle-utils';
import { parseEther } from 'ethers/lib/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

const initialAllowableDebtMarketIds = [0, 1];

describe('PendleYtEEthIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingYtToken: IPendleYtToken;
  let syToken: IPendleSyToken;
  let underlyingMarketId: BigNumber;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendleYtIsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtIsolationModeWrapperTraderV2;
  let factory: PendleYtIsolationModeVaultFactory;
  let vault: PendleYtIsolationModeTokenVaultV1;
  let priceOracle: PendleYtPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let ytBal: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      // Have to use real latest block number because API call
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
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    syToken = IPendleSyToken__factory.connect(await pendleRegistry.syToken(), core.hhUser1);
    await setupWeEthBalance(core, core.hhUser1, parseEther('1'), syToken);
    await syToken.connect(core.hhUser1).deposit(
      core.hhUser1.address,
      underlyingToken.address,
      ethers.utils.parseEther('1'),
      0,
    );

    await underlyingYtToken.connect(core.hhUser1).approve(vault.address, ethers.constants.MaxUint256);
    ytBal = await underlyingYtToken.balanceOf(core.hhUser1.address);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ytBal);

    expect(await underlyingYtToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(ytBal);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(ytBal);

    await setupNewGenericTraderProxy(core, underlyingMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { minTokenOutput, extraOrderData } = await encodeSwapExactYtForTokensV3(
        Network.ArbitrumOne,
        unwrapper.address,
        core.pendleEcosystem.weEthJun2024.weEthMarket.address,
        ytBal,
        underlyingToken.address,
        0.001,
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.weEth,
        inputMarket: underlyingMarketId,
        minOutputAmount: minTokenOutput,
        inputAmount: ytBal,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.weEth);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gte(minTokenOutput);
    });

    it('should fail if output amount is insufficient', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { minTokenOutput, extraOrderData } = await encodeSwapExactYtForTokensV3(
        Network.ArbitrumOne,
        unwrapper.address,
        core.pendleEcosystem.weEthJun2024.weEthMarket.address,
        ytBal,
        underlyingToken.address,
        0.001,
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: core.marketIds.weEth,
        inputMarket: underlyingMarketId,
        minOutputAmount: BigNumber.from(minTokenOutput).pow(2),
        inputAmount: ytBal,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await expectThrow(
        core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions),
        'PendleYtUnwrapperV2: Insufficient output amount',
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          ytBal,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weEth.address,
          core.tokens.weth.address,
          ytBal,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await setupWeEthBalance(core, core.hhUser1, ONE_ETH_BI, unwrapper);
      await underlyingToken.connect(core.hhUser1).transfer(unwrapper.address, ONE_ETH_BI);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth!.address,
          factory.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weEth.address,
          factory.address,
          ZERO_BI,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#pendleRegistry', () => {
    it('should work', async () => {
      expect(await unwrapper.PENDLE_REGISTRY()).to.eq(pendleRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(factory.address, core.tokens.weEth.address, ytBal, BYTES_EMPTY),
        'PendleYtUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
