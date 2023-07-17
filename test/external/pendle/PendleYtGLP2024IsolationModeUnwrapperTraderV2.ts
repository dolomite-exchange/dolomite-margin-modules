import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseRouter, Router } from '@pendle/sdk-v2';
import { CHAIN_ID_MAPPING } from '@pendle/sdk-v2/dist/common/ChainId';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import {
  IGmxRegistryV1,
  IPendleYtToken,
  PendleYtGLP2024IsolationModeTokenVaultV1,
  PendleYtGLP2024IsolationModeTokenVaultV1__factory,
  PendleYtGLP2024IsolationModeUnwrapperTraderV2,
  PendleYtGLP2024IsolationModeVaultFactory,
  PendleYtGLP2024IsolationModeWrapperTraderV2,
  PendleGLPRegistry,
  PendleYtGLPPriceOracle,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createPendleYtGLP2024IsolationModeTokenVaultV1,
  createPendleYtGLP2024IsolationModeUnwrapperTraderV2,
  createPendleYtGLP2024IsolationModeVaultFactory,
  createPendleYtGLP2024IsolationModeWrapperTraderV2,
  createPendleGLPRegistry,
  createPendleYtGLPPriceOracle,
} from '../../utils/ecosystem-token-utils/pendle';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { encodeSwapExactYtForTokens, ONE_TENTH_OF_ONE_BIPS_NUMBER } from './pendle-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

const initialAllowableDebtMarketIds = [0, 1];
const initialAllowableCollateralMarketIds = [2, 3];

describe('PendleYtGLP2024IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IPendleYtToken;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let pendleRegistry: PendleGLPRegistry;
  let unwrapper: PendleYtGLP2024IsolationModeUnwrapperTraderV2;
  let wrapper: PendleYtGLP2024IsolationModeWrapperTraderV2;
  let factory: PendleYtGLP2024IsolationModeVaultFactory;
  let vault: PendleYtGLP2024IsolationModeTokenVaultV1;
  let vaultSigner: SignerWithAddress;
  let priceOracle: PendleYtGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;
  let router: BaseRouter;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.pendleEcosystem!.ytGlpToken;
    const userVaultImplementation = await createPendleYtGLP2024IsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    pendleRegistry = await createPendleGLPRegistry(core);
    factory = await createPendleYtGLP2024IsolationModeVaultFactory(
      pendleRegistry,
      initialAllowableDebtMarketIds,
      initialAllowableCollateralMarketIds,
      core,
      core.pendleEcosystem!.ytGlpToken,
      userVaultImplementation,
    );

    unwrapper = await createPendleYtGLP2024IsolationModeUnwrapperTraderV2(core, factory, pendleRegistry);
    wrapper = await createPendleYtGLP2024IsolationModeWrapperTraderV2(core, factory, pendleRegistry);
    priceOracle = await createPendleYtGLPPriceOracle(core, factory, pendleRegistry);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PendleYtGLP2024IsolationModeTokenVaultV1>(
      vaultAddress,
      PendleYtGLP2024IsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    vaultSigner = await impersonate(vault.address, true);
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    router = Router.getRouter({
      chainId: CHAIN_ID_MAPPING.ARBITRUM,
      provider: core.hhUser1.provider,
      signer: core.hhUser1,
    });

    const usdcAmount = amountWei.div(1e12).mul(8);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);
    const glpAmount = amountWei.mul(4);
    await core.gmxEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.pendleEcosystem!.pendleRouter.address, glpAmount);

    await router.swapExactTokenForYt(
      core.pendleEcosystem!.ptGlpMarket.address as any,
      core.gmxEcosystem!.sGlp.address as any,
      glpAmount,
      ONE_TENTH_OF_ONE_BIPS_NUMBER,
    );
    await core.pendleEcosystem!.ytGlpToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.connect(core.hhUser1).balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Actions.Call and Actions.Sell for non-liquidation', () => {
    //@follow-up Understand this test
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;

      const { tokenOutput, extraOrderData } = await encodeSwapExactYtForTokens(router, core, amountWei);
      const amountOut = await core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1!.connect(core.hhUser5)
        .getExchangeCost(
          core.tokens.dfsGlp!.address,
          core.tokens.usdc.address,
          tokenOutput.minTokenOut,
          BYTES_EMPTY,
        );

      const actions = await unwrapper.createActionsForUnwrapping(
        solidAccountId,
        liquidAccountId,
        vault.address,
        vault.address,
        core.marketIds.usdc,
        underlyingMarketId,
        amountOut,
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

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.be.gt(amountOut);
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
      await underlyingToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.dfsGlp!.address,
          factory.address,
          amountWei,
          ethers.utils.defaultAbiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
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

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await unwrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
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
        unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, amountWei, BYTES_EMPTY),
        'PendleYtGLP2024UnwrapperV2: getExchangeCost is not implemented',
      );
    });
  });
});
