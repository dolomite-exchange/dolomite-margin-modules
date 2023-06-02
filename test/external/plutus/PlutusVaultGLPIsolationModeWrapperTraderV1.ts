import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import {
  IERC4626,
  IGmxRegistryV1,
  PlutusVaultGLPIsolationModeTokenVaultV1,
  PlutusVaultGLPIsolationModeTokenVaultV1__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeWrapperTraderV1,
  PlutusVaultGLPPriceOracle,
  PlutusVaultRegistry,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createPlutusVaultGLPIsolationModeTokenVaultV1,
  createPlutusVaultGLPIsolationModeUnwrapperTraderV1,
  createPlutusVaultGLPIsolationModeVaultFactory,
  createPlutusVaultGLPIsolationModeWrapperTraderV1,
  createPlutusVaultGLPPriceOracle,
  createPlutusVaultRegistry,
} from '../../utils/ecosystem-token-utils/plutus';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createAndSetPlutusVaultWhitelist } from './plutus-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.div(1e12).mul(8);
const usableUsdcAmount = usdcAmount.div(2);
const glpAmount = amountWei.mul(3);

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

const abiCoder = ethers.utils.defaultAbiCoder;

describe('PlutusVaultGLPIsolationModeWrapperTraderV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC4626;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let unwrapper: PlutusVaultGLPIsolationModeUnwrapperTraderV1;
  let wrapper: PlutusVaultGLPIsolationModeWrapperTraderV1;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let vault: PlutusVaultGLPIsolationModeTokenVaultV1;
  let priceOracle: PlutusVaultGLPPriceOracle;
  let defaultAccount: Account.InfoStruct;

  let plvGlpExchangeRateNumerator: BigNumber;
  let plvGlpExchangeRateDenominator: BigNumber;
  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    underlyingToken = core.plutusEcosystem!.plvGlp.connect(core.hhUser1);
    plvGlpExchangeRateNumerator = await underlyingToken.totalAssets();
    plvGlpExchangeRateDenominator = await underlyingToken.totalSupply();

    const userVaultImplementation = await createPlutusVaultGLPIsolationModeTokenVaultV1();
    gmxRegistry = core.gmxRegistry!;
    plutusVaultRegistry = await createPlutusVaultRegistry(core);
    factory = await createPlutusVaultGLPIsolationModeVaultFactory(
      core,
      plutusVaultRegistry,
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    );

    unwrapper = await createPlutusVaultGLPIsolationModeUnwrapperTraderV1(core, plutusVaultRegistry, factory);
    wrapper = await createPlutusVaultGLPIsolationModeWrapperTraderV1(core, plutusVaultRegistry, factory);
    priceOracle = await createPlutusVaultGLPPriceOracle(core, plutusVaultRegistry, factory, unwrapper);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await createAndSetPlutusVaultWhitelist(
      core,
      core.plutusEcosystem!.plvGlpRouter,
      unwrapper,
      wrapper,
      factory,
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<PlutusVaultGLPIsolationModeTokenVaultV1>(
      vaultAddress,
      PlutusVaultGLPIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.gmxEcosystem!.glpManager);
    await core.gmxEcosystem!.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.usdc.address, usableUsdcAmount, 0, 0);
    await core.plutusEcosystem!.sGlp.connect(core.hhUser1)
      .approve(core.plutusEcosystem!.plvGlpRouter.address, glpAmount);
    await core.plutusEcosystem!.plvGlpRouter.connect(core.hhUser1).deposit(glpAmount);
    await core.plutusEcosystem!.plvGlp.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
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
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        underlyingMarketId,
        core.marketIds.usdc,
        ZERO_BI,
        usableUsdcAmount,
      );

      const amountOut = await wrapper.getExchangeCost(
        core.usdc.address,
        factory.address,
        usableUsdcAmount,
        BYTES_EMPTY,
      );

      await core.usdc.connect(core.hhUser1).transfer(core.dolomiteMargin.address, usableUsdcAmount);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate(
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
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.usdc.address,
          usableUsdcAmount,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input token is not whitelisted', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          OTHER_ADDRESS,
          usableUsdcAmount,
          abiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        `PlutusVaultGLPIsolationModeWrapperTraderV1: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.weth.address,
          core.usdc.address,
          amountWei,
          abiCoder.encode(['uint256'], [otherAmountWei]),
        ),
        `IsolationModeWrapperTraderV1: Invalid output token <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.usdc.address,
          ZERO_BI,
          abiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'IsolationModeWrapperTraderV1: Invalid input amount',
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
          core.usdc.address,
          inputAmount,
          1,
          1,
        );
      const expectedAmount = glpAmount.mul(plvGlpExchangeRateDenominator).div(plvGlpExchangeRateNumerator);
      expect(await wrapper.getExchangeCost(core.usdc.address, factory.address, inputAmount, BYTES_EMPTY))
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
            core.usdc.address,
            weirdAmount,
            1,
            1,
          );
        const expectedAmount = glpAmount.mul(plvGlpExchangeRateDenominator).div(plvGlpExchangeRateNumerator);
        expect(await wrapper.getExchangeCost(core.usdc.address, factory.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });

    it('should fail if the input token is not whitelisted', async () => {
      await expectThrow(
        wrapper.getExchangeCost(OTHER_ADDRESS, factory.address, usableUsdcAmount, BYTES_EMPTY),
        `PlutusVaultGLPIsolationModeWrapperTraderV1: Invalid input token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if the output token is not dplvGLP', async () => {
      await expectThrow(
        wrapper.getExchangeCost(core.usdc.address, OTHER_ADDRESS, usableUsdcAmount, BYTES_EMPTY),
        `PlutusVaultGLPIsolationModeWrapperTraderV1: Invalid output token <${OTHER_ADDRESS.toLowerCase()}>`,
      );
    });

    it('should fail if the input amount is 0', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).getExchangeCost(
          core.usdc.address,
          factory.address,
          ZERO_BI,
          abiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'PlutusVaultGLPIsolationModeWrapperTraderV1: Invalid desired input amount',
      );
    });
  });
});
