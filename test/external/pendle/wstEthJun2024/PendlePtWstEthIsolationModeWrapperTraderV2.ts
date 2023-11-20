import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
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
} from '../../../../src/types';
import { AccountInfoStruct } from '../../../../src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../../../utils';
import { expectThrow, expectWalletBalance } from '../../../utils/assertions';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeUnwrapperTraderV2,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtIsolationModeWrapperTraderV2,
  createPendlePtPriceOracle,
  createPendleRegistry,
} from '../../../utils/ecosystem-token-utils/pendle';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
  setupWstETHBalance,
} from '../../../utils/setup';
import { encodeSwapExactTokensForPt, ONE_TENTH_OF_ONE_BIPS_NUMBER } from '../pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // 200 units of underlying
const otherAmountWei = BigNumber.from('10000000'); // $10
const wstEthAmount = parseEther('500');
const usableAmount = parseEther('10');

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PendlePtWstEthJun2024IsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let ptToken: IPendlePtToken;
  let ptMarket: IPendlePtMarket;
  let marketId: BigNumber;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumberish;
  let pendleRegistry: PendleRegistry;
  let unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  let wrapper: PendlePtIsolationModeWrapperTraderV2;
  let factory: PendlePtIsolationModeVaultFactory;
  let vault: PendlePtIsolationModeTokenVaultV1;
  let vaultSigner: SignerWithAddress;
  let priceOracle: PendlePtPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  let solidUser: SignerWithAddress;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });
    ptMarket = core.pendleEcosystem!.wstEthJun2024.ptWstEthMarket;
    ptToken = core.pendleEcosystem!.wstEthJun2024.ptWstEthToken.connect(core.hhUser1);
    underlyingToken = core.tokens.wstEth!;
    underlyingMarketId = core.marketIds.wstEth!;

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      ptMarket,
      core.pendleEcosystem!.wstEthJun2024.ptOracle,
      core.pendleEcosystem!.syWstEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      ptToken,
      userVaultImplementation,
    );

    unwrapper = await createPendlePtIsolationModeUnwrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    wrapper = await createPendlePtIsolationModeWrapperTraderV2(core, pendleRegistry, underlyingToken, factory);
    priceOracle = await createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingMarketId);

    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(marketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendlePtIsolationModeTokenVaultV1>(
      vaultAddress,
      PendlePtIsolationModeTokenVaultV1__factory,
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
      ptMarket.address as any,
      underlyingToken.address as any,
      wstEthAmount.div(2),
      ONE_TENTH_OF_ONE_BIPS_NUMBER,
    );
    await ptToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await ptToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, marketId)).value).to.eq(amountWei);

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
        usableAmount,
        ONE_TENTH_OF_ONE_BIPS_NUMBER,
        ptMarket.address,
        underlyingToken.address,
      );

      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        marketId,
        underlyingMarketId,
        ZERO_BI,
        usableAmount,
        extraOrderData,
      );

      await underlyingToken.connect(core.hhUser1).transfer(core.dolomiteMargin.address, parseEther('10'));
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(approxParams.guessOffchain);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableAmount);

      await expectWalletBalance(wrapper.address, ptToken, ZERO_BI);
      await expectWalletBalance(wrapper.address, ptToken, ZERO_BI);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          ptToken.address,
          usableAmount,
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
          ptToken.address,
          usableAmount,
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
          usableAmount,
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
          underlyingToken.address,
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
          underlyingToken.address,
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

  describe('#UNDERLYING_TOKEN', () => {
    it('should work', async () => {
      expect(await wrapper.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should fail because it is not implemented', async () => {
      await expectThrow(
        wrapper.getExchangeCost(underlyingToken.address, factory.address, amountWei, BYTES_EMPTY),
        'PendlePtWrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
