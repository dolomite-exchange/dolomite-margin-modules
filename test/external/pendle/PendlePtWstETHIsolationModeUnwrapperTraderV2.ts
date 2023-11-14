import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IGmxRegistryV1,
  IPendlePtToken,
  PendlePtWstETHIsolationModeTokenVaultV1,
  PendlePtWstETHIsolationModeTokenVaultV1__factory,
  PendlePtWstETHIsolationModeUnwrapperTraderV2,
  PendlePtWstETHIsolationModeVaultFactory,
  PendlePtWstETHIsolationModeWrapperTraderV2,
  PendlePtWstETHPriceOracle,
  PendleWstETHRegistry,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createPendlePtWstETHIsolationModeTokenVaultV1,
  createPendlePtWstETHIsolationModeUnwrapperTraderV2,
  createPendlePtWstETHIsolationModeVaultFactory,
  createPendlePtWstETHIsolationModeWrapperTraderV2,
  createPendleWstETHPriceOracle,
  createPendleWstETHRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWstETHBalance,
} from '../../utils/setup';
import { encodeSwapExactPtForTokens, ONE_TENTH_OF_ONE_BIPS_NUMBER } from './pendle-utils';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('PendlePtWstETHIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendlePtToken;
  let underlyingMarketId: BigNumber;
  let pendleRegistry: PendleWstETHRegistry;
  let unwrapper: PendlePtWstETHIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtWstETHIsolationModeWrapperTraderV2;
  let factory: PendlePtWstETHIsolationModeVaultFactory;
  let vault: PendlePtWstETHIsolationModeTokenVaultV1;
  let vaultSigner: SignerWithAddress;
  let priceOracle: PendlePtWstETHPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  let solidUser: SignerWithAddress;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.pendleEcosystem!.ptWstEth2024Token;
    const userVaultImplementation = await createPendlePtWstETHIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleWstETHRegistry(core);
    factory = await createPendlePtWstETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.ptWstEth2024Market,
      underlyingToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtWstETHIsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendlePtWstETHIsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendleWstETHPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtWstETHIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtWstETHIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    vaultSigner = await impersonate(vault.address, true);
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const wstEthAmount = parseEther('500');
    await setupWstETHBalance(core, core.hhUser1, wstEthAmount, core.pendleEcosystem!.pendleRouter);

    await router.swapExactTokenForPt(
      core.pendleEcosystem!.ptWstEth2024Market.address as any,
      core.tokens.wstEth!.address as any,
      wstEthAmount,
      ONE_TENTH_OF_ONE_BIPS_NUMBER,
    );
    await core.pendleEcosystem!.ptWstEth2024Token.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

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
        core,
        amountWei,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        core.pendleEcosystem!.ptWstEth2024Market.address,
        core.tokens.wstEth!.address,
      );

      const actions = await unwrapper.createActionsForUnwrapping(
        solidAccountId,
        liquidAccountId,
        vault.address,
        vault.address,
        core.marketIds.wstEth!,
        underlyingMarketId,
        tokenOutput.minTokenOut,
        amountWei,
        extraOrderData,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.wstEth!);
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
          core.tokens.usdc.address,
          factory.address,
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
          vault.address,
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
      await core.pendleEcosystem!.ptWstEth2024Token.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.pendleEcosystem!.ptWstEth2024Token.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.wstEth!.address,
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

  describe('#wstETH', () => {
    it('should work', async () => {
      expect(await unwrapper.WST_ETH()).to.eq(core.tokens.wstEth!.address);
    });
  });

  describe('#wstEThMarketId', async () => {
    it('should work', async () => {
      expect(await unwrapper.WST_ETH_MARKET_ID()).to.eq(core.marketIds.wstEth);
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
        unwrapper.getExchangeCost(factory.address, core.tokens.wstEth!.address, amountWei, BYTES_EMPTY),
        'PendlePtWstETHUnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
