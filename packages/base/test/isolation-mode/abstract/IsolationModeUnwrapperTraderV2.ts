import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import {
  CustomTestToken,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
} from '../../../src/types';
import { AccountInfoStruct } from '../../../src/utils';
import { createContractWithAbi, createContractWithLibrary, createTestToken } from '../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, MAX_UINT_256_BI, Network, ONE_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocolArbitrumOne } from '../../utils/core-protocol';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../../utils/dolomite';
import { createTestIsolationModeFactory } from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('IsolationModeUnwrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let unwrapper: TestIsolationModeUnwrapperTraderV2;
  let factory: TestIsolationModeFactory;
  let vault: TestIsolationModeTokenVaultV1;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    const userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1000000000000000000'); // $1.00
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherToken.address, '1000000000000000000'); // $1.00
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, true);

    unwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [otherToken.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await factory.connect(core.governance).ownerInitialize([unwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
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
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: vault.address,
        primaryAccountNumber: ZERO_BI,
        otherAccountOwner: vault.address,
        otherAccountNumber: ZERO_BI,
        outputMarket: otherMarketId,
        inputMarket: underlyingMarketId,
        minOutputAmount: ZERO_BI,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });

      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        otherToken.address,
        amountWei,
        BYTES_EMPTY,
      );

      const genericTrader = await impersonate(core.genericTraderProxy!.address, true);
      await core.dolomiteMargin.connect(genericTrader).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(ZERO_BI);
      expect(await vault.underlyingBalanceOf()).to.eq(ZERO_BI);

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, otherMarketId);
      expect(otherBalanceWei.sign).to.eq(true);
      expect(otherBalanceWei.value).to.eq(amountOut);
    });
  });

  describe('#callFunction', () => {
    it('should work if invoked properly', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginCaller).callFunction(
        core.genericTraderProxy!.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [amountWei, vault.address, ZERO_BI]),
      );
      const cursor = await factory.transferCursor();
      expect(cursor).to.eq(2);
      const transfer = await factory.getQueuedTransferByCursor(cursor);
      expect(transfer.from).to.eq(core.dolomiteMargin.address);
      expect(transfer.to).to.eq(unwrapper.address);
      expect(transfer.amount).to.eq(amountWei);
      expect(transfer.vault).to.eq(vault.address);
    });

    it('should work if invoked with max amount', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await unwrapper.connect(dolomiteMarginCaller).callFunction(
        core.genericTraderProxy!.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [MAX_UINT_256_BI, vault.address, ZERO_BI]),
      );
      const cursor = await factory.transferCursor();
      expect(cursor).to.eq(2);
      const transfer = await factory.getQueuedTransferByCursor(cursor);
      expect(transfer.from).to.eq(core.dolomiteMargin.address);
      expect(transfer.to).to.eq(unwrapper.address);
      expect(transfer.amount).to.eq(amountWei);
      expect(transfer.vault).to.eq(vault.address);
    });

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
        `IsolationModeTraderBaseV2: Caller is not authorized <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if vaultOwner param is not a vault', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [amountWei, core.hhUser1.address, ZERO_BI]),
        ),
        `IsolationModeUnwrapperTraderV2: Account owner is not a vault <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if transferAmount param is 0', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [ZERO_BI, vault.address, ZERO_BI]),
        ),
        'IsolationModeUnwrapperTraderV2: Invalid transfer amount',
      );
    });

    it('should fail if vault underlying balance is less than the transfer amount (ISF)', async () => {
      const dolomiteMarginCaller = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginCaller).callFunction(
          core.genericTraderProxy!.address,
          { owner: vault.address, number: defaultAccountNumber },
          defaultAbiCoder.encode(['uint256', 'address', 'uint256'], [amountWei.mul(111), vault.address, ZERO_BI]),
        ),
        `IsolationModeUnwrapperTraderV2: Insufficient balance <${amountWei.toString()}, ${amountWei.mul(111)
          .toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken.addBalance(unwrapper.address, amountWei);
      await unwrapper.connect(dolomiteMarginImpersonator).exchange(
        core.hhUser1.address,
        core.dolomiteMargin.address,
        otherToken.address,
        factory.address,
        amountWei,
        encodeExternalSellActionDataWithNoData(amountWei), // minOutputAmount
      );
    });

    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        unwrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          otherToken.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is zero', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await underlyingToken.addBalance(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          otherToken.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(amountWei), // minOutputAmount
        ),
        'IsolationModeUnwrapperTraderV2: Invalid input amount',
      );
    });

    it('should fail if input token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          factory.address,
          core.tokens.weth.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.tokens.weth.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if there is an insufficient input token balance', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          otherToken.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(amountWei), // minOutputAmount
        ),
        `IsolationModeUnwrapperTraderV2: Insufficient input token <0, ${amountWei.toString()}>`,
      );
    });

    it('should fail if there is an insufficient amount outputted', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      const unwrapperImpersonator = await impersonate(unwrapper.address, true);
      await factory.connect(unwrapperImpersonator).enqueueTransferFromDolomiteMargin(vault.address, amountWei);
      await factory.connect(dolomiteMarginImpersonator).transfer(unwrapper.address, amountWei);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          otherToken.address,
          factory.address,
          amountWei,
          encodeExternalSellActionDataWithNoData(amountWei.mul(2)), // minOutputAmount
        ),
        `IsolationModeUnwrapperTraderV2: Insufficient output amount <${amountWei.toString()}, ${amountWei.mul(2)
          .toString()}>`,
      );
    });
  });

  describe('#token', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
    });
  });

  describe('#isValidOutputToken', () => {
    it('should work as expected', async () => {
      expect(await unwrapper.isValidOutputToken(otherToken.address)).to.be.true;
      expect(await unwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.false;
      expect(await unwrapper.isValidOutputToken(core.tokens.usdc.address)).to.be.false;
    });
  });

  describe('#createActionsForUnwrappingForLiquidation', () => {
    it('should work for normal condition', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 1;
      const actions = await unwrapper.createActionsForUnwrapping({
        primaryAccountId: solidAccountId,
        otherAccountId: liquidAccountId,
        primaryAccountOwner: solidUser.address,
        primaryAccountNumber: ZERO_BI,
        otherAccountOwner: core.hhUser1.address,
        otherAccountNumber: ZERO_BI,
        outputMarket: otherMarketId,
        inputMarket: underlyingMarketId,
        minOutputAmount: otherAmountWei,
        inputAmount: amountWei,
        orderData: BYTES_EMPTY,
      });
      expect(actions.length).to.eq(2);

      // Inspect the call action
      expect(actions[0].actionType).to.eq(ActionType.Call);
      expect(actions[0].accountId).to.eq(solidAccountId);
      expect(actions[0].otherAddress).to.eq(unwrapper.address);
      expect(actions[0].data).to.eq(ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'address', 'uint256'],
        [amountWei, core.hhUser1.address, ZERO_BI],
      ));

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
      expect(actions[1].data).to.eq(encodeExternalSellActionDataWithNoData(otherAmountWei));
    });

    it('should fail if invalid input token is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ONE_BI,
          primaryAccountOwner: solidUser.address,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: core.hhUser1.address,
          otherAccountNumber: ZERO_BI,
          outputMarket: otherMarketId,
          inputMarket: core.marketIds.weth,
          minOutputAmount: otherAmountWei,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `IsolationModeUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
      );
    });

    it('should fail if invalid output token is passed', async () => {
      await expectThrow(
        unwrapper.createActionsForUnwrapping({
          primaryAccountId: ZERO_BI,
          otherAccountId: ONE_BI,
          primaryAccountOwner: solidUser.address,
          primaryAccountNumber: ZERO_BI,
          otherAccountOwner: core.hhUser1.address,
          otherAccountNumber: ZERO_BI,
          outputMarket: core.marketIds.weth,
          inputMarket: underlyingMarketId,
          minOutputAmount: otherAmountWei,
          inputAmount: amountWei,
          orderData: BYTES_EMPTY,
        }),
        `IsolationModeUnwrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`,
      );
    });
  });

  describe('#actionsLength', () => {
    it('should work', async () => {
      expect(await unwrapper.actionsLength()).to.eq(2);
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      const outputAmount = await unwrapper.getExchangeCost(
        factory.address,
        otherToken.address,
        amountWei,
        BYTES_EMPTY,
      );
      expect(outputAmount).to.eq(amountWei);
    });

    it('should fail when input token is invalid', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          core.tokens.dfsGlp!.address,
          core.tokens.usdc.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail when output token is invalid', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          factory.address,
          core.tokens.dfsGlp!.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `IsolationModeUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
      );
    });

    it('should fail when input amount is invalid', async () => {
      await expectThrow(
        unwrapper.getExchangeCost(
          factory.address,
          otherToken.address,
          ZERO_BI,
          BYTES_EMPTY,
        ),
        'IsolationModeUnwrapperTraderV2: Invalid desired input amount',
      );
    });
  });
});
