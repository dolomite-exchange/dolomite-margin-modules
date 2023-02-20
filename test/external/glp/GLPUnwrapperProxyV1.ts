import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import {
  GLPPriceOracleV1,
  GLPPriceOracleV1__factory,
  GLPUnwrapperProxyV1,
  GLPWrappedTokenUserVaultFactory,
  GLPWrappedTokenUserVaultFactory__factory,
  GLPWrappedTokenUserVaultV1,
  GLPWrappedTokenUserVaultV1__factory,
  GLPWrapperProxyV1,
  GmxRegistryV1,
  IERC20,
} from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { BORROW_POSITION_PROXY_V2, DOLOMITE_MARGIN } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupGmxRegistry,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { createGlpUnwrapperProxy, createGlpWrapperProxy } from '../../utils/wrapped-token-utils';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

const abiCoder = ethers.utils.defaultAbiCoder;

describe('GLPUnwrapperProxyV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: GmxRegistryV1;
  let unwrapper: GLPUnwrapperProxyV1;
  let wrapper: GLPWrapperProxyV1;
  let factory: GLPWrappedTokenUserVaultFactory;
  let vault: GLPWrappedTokenUserVaultV1;
  let priceOracle: GLPPriceOracleV1;
  let defaultAccount: Account.InfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = core.gmxEcosystem.fsGlp;
    const userVaultImplementation = await createContractWithAbi(
      GLPWrappedTokenUserVaultV1__factory.abi,
      GLPWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    gmxRegistry = await setupGmxRegistry(core);
    factory = await createContractWithAbi<GLPWrappedTokenUserVaultFactory>(
      GLPWrappedTokenUserVaultFactory__factory.abi,
      GLPWrappedTokenUserVaultFactory__factory.bytecode,
      [
        core.weth.address,
        core.marketIds.weth,
        gmxRegistry.address,
        underlyingToken.address,
        BORROW_POSITION_PROXY_V2.address,
        userVaultImplementation.address,
        DOLOMITE_MARGIN.address,
      ],
    );
    priceOracle = await createContractWithAbi<GLPPriceOracleV1>(
      GLPPriceOracleV1__factory.abi,
      GLPPriceOracleV1__factory.bytecode,
      [gmxRegistry.address, factory.address],
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    unwrapper = await createGlpUnwrapperProxy(factory, gmxRegistry);
    wrapper = await createGlpWrapperProxy(factory, gmxRegistry);
    await factory.initialize([unwrapper.address, wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<GLPWrappedTokenUserVaultV1>(
      vaultAddress,
      GLPWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    const usdcAmount = amountWei.div(1e12).mul(4);
    await setupUSDCBalance(core.hhUser1, usdcAmount, core.gmxEcosystem.glpManager);
    await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1).mintAndStakeGlp(core.usdc.address, usdcAmount, 0, 0);
    await core.gmxEcosystem.sGlp.connect(core.hhUser1).approve(vault.address, amountWei);
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
      const actions = await unwrapper.createActionsForUnwrappingForLiquidation(
        solidAccountId,
        liquidAccountId,
        vault.address,
        vault.address,
        core.marketIds.usdc,
        underlyingMarketId,
        ZERO_BI,
        amountWei,
      );

      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        core.usdc.address,
        amountWei,
        BYTES_EMPTY,
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
      expect(otherBalanceWei.value).to.eq(amountOut);
    });
  });

  describe('#callFunction', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).callFunction(
          core.hhUser1.address,
          defaultAccount,
          defaultAbiCoder.encode(['uint256'], [amountWei]),
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if sender param is not a global operator', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser1.address,
          defaultAccount,
          defaultAbiCoder.encode(['uint256'], [amountWei]),
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if account.owner param is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser1.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256'], [amountWei]),
        ),
        `GLPUnwrapperProxyV1: Account owner is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if transferAmount param is 0', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256'], [ZERO_BI]),
        ),
        'GLPUnwrapperProxyV1: Invalid transfer amount',
      );
    });

    it('should fail if vault underlying balance is less than the transfer amount (ISF)', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256'], [amountWei.mul(111)]),
        ),
        `GLPUnwrapperProxyV1: Insufficient balance <${amountWei.toString()}, ${amountWei.mul(111).toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.usdc.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if taker token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.usdc.address,
          core.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `GLPUnwrapperProxyV1: Taker token must be dfsGLP <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if maker token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.weth.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `GLPUnwrapperProxyV1: Maker token must be USDC <${core.weth.address.toLowerCase()}>`,
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#outputMarketId', () => {
    it('should work', async () => {
      expect(await unwrapper.outputMarketId()).to.eq(core.marketIds.usdc);
    });
  });

  describe('#createActionsForUnwrappingForLiquidation', () => {
    it('should work for normal condition', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 1;
      const otherMarketId = core.marketIds.usdc;
      const actions = await unwrapper.createActionsForUnwrappingForLiquidation(
        solidAccountId,
        liquidAccountId,
        solidUser.address,
        core.hhUser1.address,
        otherMarketId,
        underlyingMarketId,
        otherAmountWei,
        amountWei,
      );
      expect(actions.length).to.eq(2);

      // Inspect the call action
      expect(actions[0].actionType).to.eq(ActionType.Call);
      expect(actions[0].accountId).to.eq(liquidAccountId);
      expect(actions[0].otherAddress).to.eq(unwrapper.address);
      expect(actions[0].data).to.eq(abiCoder.encode(['uint256'], [amountWei]));

      // Inspect the sell action
      expect(actions[1].actionType).to.eq(ActionType.Sell);
      expect(actions[1].accountId).to.eq(solidAccountId);
      expect(actions[1].amount.sign).to.eq(false);
      expect(actions[1].amount.denomination).to.eq(AmountDenomination.Wei);
      expect(actions[1].amount.ref).to.eq(AmountReference.Delta);
      expect(actions[1].amount.value).to.eq(amountWei);
      expect(actions[1].primaryMarketId).to.eq(underlyingMarketId);
      expect(actions[1].secondaryMarketId).to.eq(otherMarketId);
      expect(actions[1].otherAddress).to.eq(unwrapper.address);
      expect(actions[1].otherAccountId).to.eq(ZERO_BI);
      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        core.usdc.address,
        amountWei,
        BYTES_EMPTY,
      );
      expect(actions[1].data).to.eq(abiCoder.encode(['uint', 'bytes'], [amountOut, BYTES_EMPTY]));
    });

    it('should work when invalid held market is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrappingForLiquidation(
          0,
          1,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.usdc,
          core.marketIds.weth,
          otherAmountWei,
          amountWei,
        ),
        `GLPUnwrapperProxyV1: Maker token must be dfsGLP <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should work when invalid owed market is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrappingForLiquidation(
          0,
          1,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.weth,
          underlyingMarketId,
          otherAmountWei,
          amountWei,
        ),
        `GLPUnwrapperProxyV1: Taker token must be USDC <${core.weth.address.toLowerCase()}>`,
      );
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

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
        .callStatic
        .unstakeAndRedeemGlp(
          core.usdc.address,
          amountWei,
          1,
          core.hhUser1.address,
        );
      expect(await unwrapper.getExchangeCost(factory.address, core.usdc.address, amountWei, BYTES_EMPTY))
        .to
        .eq(expectedAmount);
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = amountWei.mul(randomNumber).div(101);
        const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .unstakeAndRedeemGlp(
            core.usdc.address,
            weirdAmount,
            1,
            core.hhUser1.address,
          );
        expect(await unwrapper.getExchangeCost(factory.address, core.usdc.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });

    it('should fail if the maker token is not dsfGLP', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(core.weth.address, core.usdc.address, amountWei, BYTES_EMPTY),
        `GLPUnwrapperProxyV1: Maker token must be dfsGLP <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the taker token is not USDC', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(factory.address, core.weth.address, amountWei, BYTES_EMPTY),
        `GLPUnwrapperProxyV1: Taker token must be USDC <${core.weth.address.toLowerCase()}>`,
      );
    });
  });
});
