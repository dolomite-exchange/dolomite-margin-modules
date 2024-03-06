import { ADDRESS_ZERO, BYTES_EMPTY, Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot
} from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import {
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWeEthBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import {
  IERC20,
  IPendlePtMarket,
  IPendlePtToken,
  PendlePtIsolationModeTokenVaultV1,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtPriceOracle,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtEEthPriceOracle,
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV2,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { BigNumber } from 'ethers';
import { ONE_TENTH_OF_ONE_BIPS_NUMBER, encodeSwapExactPtForTokens } from '../pendle-utils';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expectThrow } from 'packages/base/test/utils/assertions';
import { setupNewGenericTraderProxy } from 'packages/base/test/utils/dolomite';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, WE_ETH_ETH_REDSTONE_FEED_MAP } from 'packages/base/src/utils/constants';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from 'packages/base/src/types';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { RedstonePriceOracle, RedstonePriceOracle__factory } from 'packages/oracles/src/types';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('20000000000000000000'); // 20
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('PendlePtEEthApr2024IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtIsolationModeWrapperTraderV2;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumber;
  let vault: PendlePtIsolationModeTokenVaultV1;
  let priceOracle: PendlePtPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;
  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;
  let ptBal: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    ptMarket = core.pendleEcosystem!.weEthApr2024.ptWeEthMarket.connect(core.hhUser1);
    ptToken = core.pendleEcosystem!.weEthApr2024.ptWeEthToken.connect(core.hhUser1);
    underlyingToken = core.tokens.weEth!;

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    const oracle = (await createContractWithAbi<RedstonePriceOracle>(
      RedstonePriceOracle__factory.abi,
      RedstonePriceOracle__factory.bytecode,
      [
        [core.tokens.weth.address, underlyingToken.address],
        [core.chainlinkPriceOracle!.getAggregatorByToken(core.tokens.weth.address), WE_ETH_ETH_REDSTONE_FEED_MAP[Network.ArbitrumOne]],
        [18, 18],
        [ADDRESS_ZERO, core.tokens.weth.address],
        core.dolomiteMargin.address
      ]
    )).connect(core.governance);
    await setupTestMarket(core, core.tokens.weEth, false, oracle);

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      ptMarket,
      core.pendleEcosystem!.weEthApr2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      ptToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(oracle.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracle!.address,
    );
    await core.chainlinkPriceOracle!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      underlyingToken.address,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address],
      ADDRESS_ZERO,
    );
    priceOracle = await createPendlePtEEthPriceOracle(core, factory, pendleRegistry);
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    await setupWeEthBalance(core, core.hhUser1, amountWei, core.pendleEcosystem!.pendleRouter);
    await router.swapExactTokenForPt(
      ptMarket.address as any,
      underlyingToken.address as any,
      amountWei,
      ONE_TENTH_OF_ONE_BIPS_NUMBER
    );

    ptBal = await ptToken.balanceOf(core.hhUser1.address);
    await ptToken.connect(core.hhUser1).approve(vault.address, ptBal);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, ptBal);

    await setupNewGenericTraderProxy(core, marketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { tokenOutput, extraOrderData } = await encodeSwapExactPtForTokens(
        router,
        ptBal,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        ptMarket.address,
        underlyingToken.address,
      );

      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: vault.address,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: underlyingMarketId,
        inputMarket: marketId,
        minOutputAmount: tokenOutput.minTokenOut,
        inputAmount: ptBal,
        orderData: extraOrderData,
      });

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gt(tokenOutput.minTokenOut);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          underlyingToken.address,
          factory.address,
          ptBal,
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
          underlyingToken.address,
          core.tokens.weth.address,
          ptBal,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          ptBal,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
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
          underlyingToken.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
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

  describe('#UNDERLYING_TOKEN', () => {
    it('should work', async () => {
      expect(await unwrapper.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
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
        unwrapper.getExchangeCost(factory.address, underlyingToken.address, amountWei, BYTES_EMPTY),
        'PendlePtUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
