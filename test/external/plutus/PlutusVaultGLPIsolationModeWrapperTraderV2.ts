import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC4626,
  IGmxRegistryV1,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeWrapperTraderV2,
  PlutusVaultGLPPriceOracle,
  PlutusVaultRegistry,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../packages/base/src/utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../packages/base/src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';
import { expectThrow } from '../../../packages/base/test/utils/assertions';
import {
  createPlutusVaultGLPIsolationModeTokenVaultV1,
  createPlutusVaultGLPIsolationModeUnwrapperTraderV2,
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultGLPIsolationModeWrapperTraderV2,
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultRegistry,
} from '../../utils/ecosystem-token-utils/plutus';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../../packages/base/test/utils/setup';
import { createAndSetPlutusVaultWhitelist } from './plutus-utils';
import { setupNewGenericTraderProxy } from '../../../packages/base/test/utils/dolomite';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(16);
const usableUsdcAmount = usdcAmount.div(2);
const glpAmount = amountWei.mul(4);

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('PlutusVaultGLPIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV2;
  let wrapper: PlutusVaultGLPIsolationModeWrapperTraderV2;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let priceOracle: PlutusVaultGLPPriceOracle;
  let defaultAccount: AccountInfoStruct;

  let plvGlpExchangeRateNumerator: BigNumber;
  let plvGlpExchangeRateDenominator: BigNumber;
  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    plvGlpExchangeRateNumerator = await underlyingToken.totalAssets();
    plvGlpExchangeRateDenominator = await underlyingToken.totalSupply();

    const userVaultImplementation = await createPlutusVaultGLPIsolationModeTokenVaultV1(core);
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    );

    unwrapper = await createPlutusVaultGLPIsolationModeUnwrapperTraderV2(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPIsolationModeWrapperTraderV2(core, plutusVaultRegistry, factory);
    priceOracle = await createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PlutusVaultGLPIsolationModeTokenVaultV1>(
      vaultAddress,
      PlutusVaultGLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await createAndSetPlutusVaultWhitelist(
      core,
      core.plutusEcosystem!.plvGlpRouter,
      unwrapper,
      wrapper,
      factory,
      vault,
    );
    await createAndSetPlutusVaultWhitelist(
      core,
      core.plutusEcosystem!.plvGlpFarm,
      unwrapper,
      wrapper,
      factory,
      vault,
    );

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usableUsdcAmount, 0, 0);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
    await core.plutusEcosystem!.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await vault.underlyingBalanceOf()).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    await setupNewGenericTraderProxy(core, underlyingMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: ZERO_ADDRESS,
        primaryAccountNumber: defaultAccountNumber,
        otherAccountOwner: ZERO_ADDRESS,
        otherAccountNumber: defaultAccountNumber,
        outputMarket: underlyingMarketId,
        inputMarket: core.marketIds.usdc,
        minOutputAmount: ZERO_BI,
        inputAmount: usableUsdcAmount,
        orderData: BYTES_EMPTY,
      });

      const amountOut = await wrapper.getExchangeCost(
        core.tokens.usdc.address,
        factory.address,
        usableUsdcAmount,
        BYTES_EMPTY,
      );

      await core.tokens.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);

      const genericTrader = await impersonate(core.genericTraderProxy!, true);
      await core.dolomiteMargin.connect(genericTrader).operate(
        [defaultAccount],
        actions,
      );

      const expectedTotalBalance = amountWei.add(amountOut);
      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(expectedTotalBalance);
      expect(underlyingBalanceWei.sign).to.eq(true);
      expect(await vault.underlyingBalanceOf()).to.eq(expectedTotalBalance);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, core.marketIds.usdc);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(usableUsdcAmount);
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
          usableUsdcAmount,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if for invalid trade originator called by DolomiteMargin', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          usableUsdcAmount,
          BYTES_EMPTY,
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
          usableUsdcAmount,
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
          core.tokens.weth.address,
          core.tokens.usdc.address,
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
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.usdc.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(ZERO_BI),
        ),
        'IsolationModeWrapperTraderV2: Invalid input amount',
      );
    });
  });

  describe('#plutusVaultRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.PLUTUS_VAULT_REGISTRY()).to.eq(plutusVaultRegistry.address);
    });
  });

  describe('#gmxRegistry', () => {
    it('should work', async () => {
      expect(await wrapper.GMX_REGISTRY()).to.eq(gmxRegistry.address);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const inputAmount = usableUsdcAmount;
      const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .mintAndStakeGlp(
          core.tokens.usdc.address,
          inputAmount,
          1,
          1,
        );
      const expectedAmount = glpAmount.mul(plvGlpExchangeRateDenominator).div(plvGlpExchangeRateNumerator);
      expect(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, inputAmount, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = usableUsdcAmount.mul(randomNumber).div(101);
        const glpAmount = await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(
            core.tokens.usdc.address,
            weirdAmount,
            1,
            1,
          );
        const expectedAmount = glpAmount.mul(plvGlpExchangeRateDenominator).div(plvGlpExchangeRateNumerator);
        expect(await wrapper.getExchangeCost(core.tokens.usdc.address, factory.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });
  });
});
