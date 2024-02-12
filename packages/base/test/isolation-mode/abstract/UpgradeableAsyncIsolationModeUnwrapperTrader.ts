import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  CustomTestToken,
  EventEmitterRegistry,
  IERC20,
  TestAsyncProtocol,
  TestAsyncProtocolIsolationModeTokenVault,
  TestAsyncProtocolIsolationModeTokenVault__factory,
  TestAsyncProtocolIsolationModeVaultFactory,
  TestAsyncProtocol__factory,
  TestHandlerRegistry,
  TestUpgradeableAsyncIsolationModeUnwrapperTrader,
  TestUpgradeableAsyncIsolationModeWrapperTrader,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import {
  BYTES_EMPTY,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '../../utils/assertions';
import { CoreProtocolArbitrumOne } from '../../utils/core-protocol';
import { createDolomiteRegistryImplementation, createEventEmitter, createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import {
  createTestAsyncProtocolIsolationModeVaultFactory,
  createTestHandlerRegistry,
  createTestUpgradeableAsyncIsolationModeUnwrapperTrader,
  createTestUpgradeableAsyncIsolationModeWrapperTrader,
} from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { ethers } from 'hardhat';
import { GenericTraderType } from '@dolomite-exchange/zap-sdk';
import { GenericEventEmissionType } from '@dolomite-exchange/dolomite-margin/dist/src/modules/GenericTraderProxyV1';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const DEFAULT_KEY = '0xc21063033242d57fdb2c58fff1edd24024c38411467eff5c9f245c83c36a47a4';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000
const gasLimit = process.env.COVERAGE !== 'true' ? 10_000_000 : 100_000_000;
const DEFAULT_ORDER_DATA = ethers.utils.defaultAbiCoder.encode(
  ['uint256', 'bytes'],
  [ONE_BI,  ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes'], [0, '0x'])]
);

enum FreezeType {
  Deposit = 0,
  Withdrawal = 1,
}

const PLUS_ONE_BI = {
  sign: true,
  value: ONE_BI,
};

const EXECUTION_FEE = ONE_ETH_BI.div(4);

describe('UpgradeableAsyncIsolationModeUnwrapperTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let eventEmitter: EventEmitterRegistry;
  let tokenUnwrapper: TestUpgradeableAsyncIsolationModeUnwrapperTrader;
  let tokenWrapper: TestUpgradeableAsyncIsolationModeWrapperTrader;
  let factory: TestAsyncProtocolIsolationModeVaultFactory;
  let userVaultImplementation: TestAsyncProtocolIsolationModeTokenVault;
  let userVault: TestAsyncProtocolIsolationModeTokenVault;
  let impersonatedVault: SignerWithAddress;
  let doloMarginImpersonator: SignerWithAddress;
  let registry: TestHandlerRegistry;
  let asyncProtocol: TestAsyncProtocol;

  let solidUser: SignerWithAddress;
  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    asyncProtocol = await createContractWithAbi<TestAsyncProtocol>(
      TestAsyncProtocol__factory.abi,
      TestAsyncProtocol__factory.bytecode,
      []
    );
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestAsyncProtocolIsolationModeTokenVault>(
      'TestAsyncProtocolIsolationModeTokenVault',
      libraries,
      [asyncProtocol.address, core.tokens.weth.address],
    );
    registry = await createTestHandlerRegistry(core);
    underlyingToken = asyncProtocol;
    factory = await createTestAsyncProtocolIsolationModeVaultFactory(
      EXECUTION_FEE,
      registry,
      core,
      asyncProtocol,
      userVaultImplementation,
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    solidUser = core.hhUser5;

    otherToken1 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken1.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId1 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken1, false);

    otherToken2 = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken2.address,
      '1000000000000000000000000000000', // $1.00 in USDC
    );
    otherMarketId2 = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken2, false);

    tokenUnwrapper = await createTestUpgradeableAsyncIsolationModeUnwrapperTrader(core, registry, factory, asyncProtocol);
    tokenWrapper = await createTestUpgradeableAsyncIsolationModeWrapperTrader(core, registry, factory, asyncProtocol);
    await factory.connect(core.governance).ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await registry.connect(core.governance).ownerSetIsHandler(asyncProtocol.address, true);
    await registry.connect(core.governance).ownerSetIsHandler(core.dolomiteMargin.address, true);
    await registry.connect(core.governance).ownerSetWrapperByToken(factory.address, tokenWrapper.address);
    await registry.connect(core.governance).ownerSetUnwrapperByToken(factory.address, tokenUnwrapper.address);

    eventEmitter = await createEventEmitter(core);
    const newRegistry = await createDolomiteRegistryImplementation();

    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(newRegistry.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);
    await core.genericTraderProxy.ownerSetEventEmitterRegistry(eventEmitter.address);

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestAsyncProtocolIsolationModeTokenVault>(
      vaultAddress,
      TestAsyncProtocolIsolationModeTokenVault__factory,
      core.hhUser1,
    );

    await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken1.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);

    await otherToken1.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken1.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId1, bigOtherAmountWei);

    await otherToken2.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
    await otherToken2.connect(core.hhUser1).approve(core.dolomiteMargin.address, otherAmountWei);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);

    await otherToken2.connect(solidUser).addBalance(solidUser.address, bigOtherAmountWei);
    await otherToken2.connect(solidUser).approve(core.dolomiteMargin.address, bigOtherAmountWei);
    await depositIntoDolomiteMargin(core, solidUser, defaultAccountNumber, otherMarketId2, bigOtherAmountWei);

    impersonatedVault = await impersonate(userVault.address, true);
    doloMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work', async () => {
      expect(await tokenUnwrapper.VAULT_FACTORY()).to.eq(factory.address);
      expect(await tokenUnwrapper.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await tokenUnwrapper.HANDLER_REGISTRY()).to.eq(registry.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        tokenUnwrapper.initialize(factory.address, registry.address, core.dolomiteMargin.address),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#callFunction', () => {
    it('should fail if not called by dolomite margin', async () => {
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser1).callFunction(
          core.hhUser5.address,
          { owner: userVault.address, number: defaultAccountNumber },
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if sender is not a global operator', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).callFunction(
          core.hhUser1.address,
          { owner: userVault.address, number: defaultAccountNumber },
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#exchange', () => {
    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          core.tokens.weth.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenUnwrapper.connect(doloMarginImpersonator).exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          ZERO_BI,
          DEFAULT_ORDER_DATA,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input amount`
      );
    });

    it('should fail if not called by dolomite margin', async () => {
      await expectThrow(
        tokenUnwrapper.exchange(
          userVault.address,
          userVault.address,
          otherToken1.address,
          factory.address,
          amountWei,
          DEFAULT_ORDER_DATA,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await tokenUnwrapper.getExchangeCost(
        factory.address,
        otherToken1.address,
        ONE_BI,
        BYTES_EMPTY,
      )).to.eq(ONE_BI);
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(
          core.tokens.weth.address,
          otherToken1.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid output token', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(
          factory.address,
          core.tokens.weth.address,
          ONE_BI,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`
      );
    });

    it('should fail if invalid input amount', async () => {
      await expectThrow(
        tokenUnwrapper.getExchangeCost(
          factory.address,
          otherToken1.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid desired input amount`
      );
    });
  });

  describe('#executeWithdrawal', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei
      );

      await userVault.initiateUnwrapping(borrowAccountNumber, amountWei, otherToken1.address, amountWei, DEFAULT_ORDER_DATA);
      await asyncProtocol.executeWithdrawal(DEFAULT_KEY, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should work normally if reverts with message', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei
      );

      await userVault.initiateUnwrapping(borrowAccountNumber, amountWei, otherToken1.address, amountWei, DEFAULT_ORDER_DATA);
      await userVault.setRevertFlag(1);
      await asyncProtocol.executeWithdrawal(DEFAULT_KEY, amountWei);
    });

    it('should work normally if reverts with no message', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei
      );

      await userVault.initiateUnwrapping(borrowAccountNumber, amountWei, otherToken1.address, amountWei, DEFAULT_ORDER_DATA);
      await userVault.setRevertFlag(2);
      await asyncProtocol.executeWithdrawal(DEFAULT_KEY, amountWei);
    });
  });

  describe('#executeWithdrawalForRetry', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei
      );

      await userVault.initiateUnwrapping(borrowAccountNumber, amountWei, otherToken1.address, amountWei, DEFAULT_ORDER_DATA);
      await userVault.setRevertFlag(2);
      await asyncProtocol.executeWithdrawal(DEFAULT_KEY, amountWei);
      await userVault.setRevertFlag(0);
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await tokenUnwrapper.connect(core.hhUser5).executeWithdrawalForRetry(DEFAULT_KEY, { gasLimit });
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, amountWei);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, ZERO_BI);
    });

    it('should fail if withdrawal does not exist', async () => {
      await registry.connect(core.governance).ownerSetIsHandler(core.hhUser5.address, true);
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser5).executeWithdrawalForRetry(
          DEFAULT_KEY,
        ),
        'UpgradeableUnwrapperTraderV2: Invalid withdrawal key'
      );
    });

    it('should fail if not called by handler', async () => {
      await expectThrow(
        tokenUnwrapper.connect(core.hhUser1).executeWithdrawalForRetry(
          DEFAULT_KEY,
        ),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`
      );
    });

    it('should fail if reentered', async () => {

    });
  });

  describe('#cancelWithdrawal', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(core.hhUser1.address, amountWei);
      await otherToken1.addBalance(asyncProtocol.address, amountWei);
      await asyncProtocol.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei
      );

      await userVault.initiateUnwrapping(borrowAccountNumber, amountWei, otherToken1.address, amountWei, DEFAULT_ORDER_DATA);
      await userVault.cancelWithdrawal(DEFAULT_KEY);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, borrowAccountNumber, underlyingMarketId, amountWei);
    });
  });
  
  describe('#token', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.token()).to.eq(factory.address);
    })
  });

  describe('#actionsLength', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.actionsLength()).to.eq(1);
    });
  });

  describe('#createActionsForUnwrapping', () => {

  });

  describe('#getWrapperTrader', () => {
    it('should work normally', async () => {
      expect(await tokenUnwrapper.getWrapperTrader()).to.eq(tokenWrapper.address);
    });
  });

  describe('#validateVaultExists', () => {
    it('should work normally', async () => {
      await expect(tokenUnwrapper.testValidateVaultExists(factory.address, userVault.address)).to.not.be.reverted;
    });

    it('should fail if vault does not exist', async () => {
      await expectThrow(
        tokenUnwrapper.testValidateVaultExists(factory.address, core.hhUser1.address),
        `UpgradeableUnwrapperTraderV2: Invalid vault <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#validateIsBalanceSufficient', () => {
    it('should work normally', async () => {
      await asyncProtocol.addBalance(tokenUnwrapper.address, amountWei);
      await expect(await tokenUnwrapper.testValidateIsBalanceSufficient(212)).to.not.be.reverted;
    });

    it('should fail if balance is not sufficient', async () => {
      await expectThrow(
        tokenUnwrapper.testValidateIsBalanceSufficient(212),
        'UpgradeableUnwrapperTraderV2: Insufficient input token <0, 212>'
      );
    });
  });

  function getInitiateWrappingParams(
    accountNumber: BigNumberish,
    marketId1: BigNumberish,
    amountIn: BigNumberish,
    marketId2: BigNumberish,
    minAmountOut: BigNumberish,
    wrapper: TestUpgradeableAsyncIsolationModeWrapperTrader,
    executionFee: BigNumberish,
  ): any {
    return {
      accountNumber,
      amountIn,
      minAmountOut,
      marketPath: [marketId1, marketId2],
      traderParams: [
        {
          trader: wrapper.address,
          traderType: GenericTraderType.IsolationModeWrapper,
          tradeData: ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [accountNumber, executionFee]),
          makerAccountIndex: 0,
        },
      ],
      makerAccounts: [],
      userConfig: {
        deadline: '123123123123123',
        balanceCheckFlag: BalanceCheckFlag.None,
        eventType: GenericEventEmissionType.None,
      },
    };
  }
});
