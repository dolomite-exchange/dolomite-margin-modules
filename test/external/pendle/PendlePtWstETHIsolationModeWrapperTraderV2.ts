import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
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
import { expectThrow, expectWalletBalance } from '../../utils/assertions';
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
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWstETHBalance,
} from '../../utils/setup';
import { ONE_TENTH_OF_ONE_BIPS_NUMBER, encodeSwapExactTokensForPt } from './pendle-utils';
import { parseEther } from 'ethers/lib/utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // 200 units of underlying
const otherAmountWei = BigNumber.from('10000000'); // $10
const wstEthAmount = parseEther('500');
const usableWstEthAmount = parseEther('10');
const FIVE_BIPS = 0.0005;

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtWstETHIsolationModeWrapperTraderV2', () => {
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
    underlyingToken = core.pendleEcosystem!.ptWstEth2024Token.connect(core.hhUser1);

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

    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
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

    await setupWstETHBalance(core, core.hhUser1, wstEthAmount, core.pendleEcosystem!.pendleRouter);

    await router.swapExactTokenForPt(
      core.pendleEcosystem!.ptWstEth2024Market.address as any,
      core.tokens.wstEth!.address as any,
      wstEthAmount.div(2),
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

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { extraOrderData, approxParams } = await encodeSwapExactTokensForPt(
        router,
        core,
        usableWstEthAmount,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        core.pendleEcosystem!.ptWstEth2024Market.address,
        core.tokens.wstEth!.address,
      );

      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        underlyingMarketId,
        core.marketIds.wstEth!,
        ZERO_BI,
        usableWstEthAmount,
        extraOrderData,
      );

      await core.tokens.wstEth!.connect(core.hhUser1).transfer(core.dolomiteMargin.address, parseEther('10'));
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.wstEth!);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableWstEthAmount);

      await expectWalletBalance(wrapper.address, core.tokens.wstEth!, ZERO_BI);
      await expectWalletBalance(wrapper.address, core.pendleEcosystem!.ptWstEth2024Token, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          usableWstEthAmount,
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
          usableWstEthAmount,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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
          usableWstEthAmount,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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
          OTHER_ADDRESS,
          core.tokens.wstEth!.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `IsolationModeWrapperTraderV2: Invalid output token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.wstEth!.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
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

  describe('#wstEth', () => {
    it('should work', async () => {
      expect(await wrapper.WST_ETH()).to.eq(core.tokens.wstEth!.address);
    });
  });

  describe('#wstEthMarketId', () => {
    it('should work', async () => {
      expect(await wrapper.WST_ETH_MARKET_ID()).to.eq(core.marketIds.wstEth);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.tokens.wstEth!.address, factory.address, amountWei, BYTES_EMPTY),
        'PendlePtWstETHWrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
