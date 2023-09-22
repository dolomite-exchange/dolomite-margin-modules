import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IGmxRegistryV1,
  IUmamiAssetVault,
  TestUmamiWithdrawalQueuer__factory,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeTokenVaultV1__factory,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultIsolationModeWrapperTraderV2,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { BYTES_EMPTY, Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { encodeExternalSellActionDataWithNoData, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultIsolationModeWrapperTraderV2,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import {
  CoreProtocol,
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUSDCBalance,
  setupUserVaultProxy,
} from '../../utils/setup';
import { setupWhitelistAndAggregateVault } from './umami-utils';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { defaultAbiCoder } from '@ethersproject/abi';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const usdcAmount = amountWei.mul(8);
const usableUsdcAmount = usdcAmount.div(2);

const withdrawalFeeNumerator = BigNumber.from('750000000000000000');
const withdrawalFeeDenominator = BigNumber.from('100000000000000000000');
const DUMMY_KEY = '0x9e2ef28b28a4b61d21c05647c2c54527def0400f13c327446d11c777f5eabcde';

describe('UmamiAssetVaultIsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: IUmamiAssetVault;
  let underlyingMarketId: BigNumber;
  let gmxRegistry: IGmxRegistryV1;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let unwrapper: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let wrapper: UmamiAssetVaultIsolationModeWrapperTraderV2;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let vault: UmamiAssetVaultIsolationModeTokenVaultV1;
  let priceOracle: UmamiAssetVaultPriceOracle;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = core.umamiEcosystem!.glpUsdc;
    const userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    gmxRegistry = core.gmxEcosystem!.live.gmxRegistry!;
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      underlyingToken,
      userVaultImplementation,
    );

    unwrapper = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    wrapper = await createUmamiAssetVaultIsolationModeWrapperTraderV2(core, umamiRegistry, factory);
    priceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, factory);

    const TestUmamiWithdrawalQueuer = await createContractWithAbi(
      TestUmamiWithdrawalQueuer__factory.abi,
      TestUmamiWithdrawalQueuer__factory.bytecode,
      []
    );
    await umamiRegistry.connect(core.governance).ownerSetWithdrawalQueuer(TestUmamiWithdrawalQueuer.address);
    await umamiRegistry.connect(core.governance).ownerSetUmamiUnwrapperTrader(unwrapper.address);
    await unwrapper.connect(core.governance).ownerSetIsHandler(core.hhUser2.address, true);

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, priceOracle);
    await core.dolomiteMargin.ownerSetPriceOracle(underlyingMarketId, priceOracle.address);

    await factory.connect(core.governance).ownerInitialize([unwrapper.address, wrapper.address]);
    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds(
      [underlyingMarketId, core.marketIds.usdc]
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await disableInterestAccrual(core, core.marketIds.usdc);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<UmamiAssetVaultIsolationModeTokenVaultV1>(
      vaultAddress,
      UmamiAssetVaultIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await setupWhitelistAndAggregateVault(core, umamiRegistry);

    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.umamiEcosystem!.glpUsdc);
    await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).deposit(usableUsdcAmount, core.hhUser1.address);
    await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).approve(vault.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initializer', () => {
    it('should work normally', async () => {
      expect(await unwrapper.VAULT_FACTORY()).to.eq(factory.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        unwrapper.initialize(
          factory.address,
          core.dolomiteMargin.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#afterWithdrawalExecution', () => {
    it('should work normally', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.usdc.address,
        ONE_BI
      );

      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      expect(await vault.isVaultFrozen()).to.be.true;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, underlyingMarketId, amountWei);

      const impersonatedUnwrapper = await impersonate(unwrapper.address, true);
      await setupUSDCBalance(core, impersonatedUnwrapper, 100e6, core.hhUser5);
      await unwrapper.connect(core.hhUser2).afterWithdrawalExecution(withdrawalKey, 100e6);

      expect(await vault.isVaultFrozen()).to.be.false;
      expect(await underlyingToken.balanceOf(vault.address)).to.eq(ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      expectProtocolBalance(core, vault.address, borrowAccountNumber, core.marketIds.usdc, 100e6);
    });

    it('should fail if given an invalid key', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser2).afterWithdrawalExecution(DUMMY_KEY, 100e6),
        'UmamiAssetVaultUnwrapperV2: Invalid withdrawal key',
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).afterWithdrawalExecution(DUMMY_KEY, 100e6),
        `UmamiAssetVaultUnwrapperV2: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#callFunction', () => {
    it('should fail if account owner is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: core.hhUser2.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'bytes32'], [amountWei, DUMMY_KEY]),
        ),
        `UmamiAssetVaultUnwrapperV2: Account owner is not a vault <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail if invalid account owner (withdrawal does not exist)', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'bytes32'], [ZERO_BI, DUMMY_KEY]),
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid account owner',
      );
    });

    it('should fail if transfer amount is zero', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.usdc.address,
        ONE_BI
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'bytes32'], [ZERO_BI, withdrawalKey]),
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid transfer amount',
      );
    });

    it('should fail if virtual underlying balance is insufficient', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.usdc.address,
        ONE_BI
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.hhUser5.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'bytes32'], [amountWei.mul(2), withdrawalKey]),
        ),
        `UmamiAssetVaultUnwrapperV2: Insufficient balance <${amountWei.toString()}, ${amountWei.mul(2).toString()}>`,
      );
    });
  });

  describe('#vaultSetWithdrawalInfo', () => {
    it('should fail if not called by vault', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).vaultSetWithdrawalInfo(
          DUMMY_KEY,
          defaultAccountNumber,
          amountWei,
          core.tokens.weth.address,
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid vault',
      );
    });
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      const result = await unwrapper.connect(core.governance).ownerSetIsHandler(
        core.hhUser4.address,
        true,
      );
      await expectEvent(unwrapper, result, 'OwnerSetIsHandler', {
        handler: core.hhUser4.address,
        isTrusted: true,
      });

      expect(await unwrapper.isHandler(core.hhUser4.address)).to.eq(true);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).ownerSetIsHandler(core.hhUser4.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
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
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `UmamiAssetVaultUnwrapperV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.dfsGlp!.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        `UmamiAssetVaultUnwrapperV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.umamiEcosystem!.glpUsdc.connect(core.hhUser1).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(otherAmountWei),
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid input amount',
      );
    });

    it('should fail if input amount is more than withdrawal input amount', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        ONE_BI,
        core.tokens.usdc.address,
        ONE_BI
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          amountWei,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, defaultAbiCoder.encode(['bytes32'], [withdrawalKey])]),
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid input amount',
      );
    });

    it('should fail if withdrawal output token does not match output token', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.weth.address,
        ONE_BI
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          core.tokens.usdc.address,
          factory.address,
          amountWei,
          defaultAbiCoder.encode(['uint256', 'bytes'], [ONE_BI, defaultAbiCoder.encode(['bytes32'], [withdrawalKey])]),
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid output token',
      );
    });
  });

  describe('#createActionsForUnwrapping', () => {
    it('should fail if invalid input token is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          0,
          0,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.usdc,
          core.marketIds.weth,
          otherAmountWei,
          amountWei,
          BYTES_EMPTY,
        ),
        `UmamiAssetVaultUnwrapperV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should fail if invalid output token is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          0,
          0,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.weth,
          underlyingMarketId,
          otherAmountWei,
          amountWei,
          BYTES_EMPTY,
        ),
        `UmamiAssetVaultUnwrapperV2: Invalid output market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should fail if invalid withdrawal key is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          0,
          0,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.usdc,
          underlyingMarketId,
          otherAmountWei,
          amountWei,
          DUMMY_KEY,
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid withdrawal',
      );
    });

    it('should fail if invalid input amount is passed', async () => {
      await vault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await vault.connect(core.hhUser1).initiateUnwrapping(
        borrowAccountNumber,
        amountWei,
        core.tokens.usdc.address,
        ONE_BI
      );
      const filter = unwrapper.filters.WithdrawalCreated();
      const withdrawalKey = (await unwrapper.queryFilter(filter))[0].args.key;

      await expectThrow(
        unwrapper.createActionsForUnwrapping(
          0,
          0,
          solidUser.address,
          core.hhUser1.address,
          core.marketIds.usdc,
          underlyingMarketId,
          otherAmountWei,
          amountWei.mul(2),
          withdrawalKey,
        ),
        'UmamiAssetVaultUnwrapperV2: Invalid input amount',
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work', async () => {

    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const exchangeRateNumerator = await underlyingToken.totalAssets();
      const exchangeRateDenominator = await underlyingToken.totalSupply();

      const amountBeforeWithdrawalFee = amountWei
        .mul(exchangeRateNumerator)
        .div(exchangeRateDenominator);

      const withdrawalFee = amountBeforeWithdrawalFee.mul(withdrawalFeeNumerator).div(withdrawalFeeDenominator);
      expect(await core.umamiEcosystem!.glpUsdc.previewWithdrawalFee(amountBeforeWithdrawalFee)).to.eq(withdrawalFee);

      const expectedAmount = amountBeforeWithdrawalFee.sub(withdrawalFee);

      expect(
        await unwrapper.getExchangeCost(
          factory.address,
          core.tokens.usdc.address,
          amountWei,
          BYTES_EMPTY,
        ),
      ).to.eq(expectedAmount.add(1)); // rounding issue with going from shares to assets
    });

    it('should work for 10 random numbers, as long as balance is sufficient', async () => {
      const exchangeRateNumerator = await underlyingToken.totalAssets();
      const exchangeRateDenominator = await underlyingToken.totalSupply();

      for (let i = 0; i < 10; i++) {
        // create a random number from 1 to 99 and divide by 101 (making the number, at-most, slightly smaller)
        const randomNumber = BigNumber.from(Math.floor(Math.random() * 99) + 1);
        const weirdAmount = amountWei.mul(randomNumber).div(101);
        const amountBeforeWithdrawalFee = weirdAmount
          .mul(exchangeRateNumerator)
          .div(exchangeRateDenominator);

        const expectedAmount = amountBeforeWithdrawalFee
          .sub(amountBeforeWithdrawalFee.mul(withdrawalFeeNumerator).div(withdrawalFeeDenominator));

        expect(await unwrapper.getExchangeCost(factory.address, core.tokens.usdc.address, weirdAmount, BYTES_EMPTY))
          .to
          .eq(expectedAmount);
      }
    });
  });
});
