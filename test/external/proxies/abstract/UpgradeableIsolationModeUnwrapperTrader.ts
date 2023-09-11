import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import {
  CustomTestToken,
  IsolationModeTraderProxy,
  IsolationModeTraderProxy__factory,
  TestIsolationModeFactory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestUpgradeableIsolationModeUnwrapperTrader,
  TestUpgradeableIsolationModeUnwrapperTrader__factory,
  TestUpgradeableIsolationModeWrapperTrader__factory,
} from '../../../../src/types';
import { AccountInfoStruct } from '../../../../src/utils';
import { createContractWithAbi, createTestToken } from '../../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import {
  encodeExternalSellActionDataWithNoData,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../../../utils';
import { expectThrow } from '../../../utils/assertions';
import { createTestIsolationModeFactory } from '../../../utils/ecosystem-token-utils/testers';
import {
  CoreProtocol,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../../utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('UpgradeableIsolationModeUnwrapperTrader', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let unwrapper: TestUpgradeableIsolationModeUnwrapperTrader;
  let factory: TestIsolationModeFactory;
  let vault: TestIsolationModeTokenVaultV1;
  let defaultAccount: AccountInfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    const userVaultImplementation = await createContractWithAbi<TestIsolationModeTokenVaultV1>(
      TestIsolationModeTokenVaultV1__factory.abi,
      TestIsolationModeTokenVaultV1__factory.bytecode,
      [],
    );
    factory = await createTestIsolationModeFactory(core, underlyingToken, userVaultImplementation);

    await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '1000000000000000000'); // $1.00
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.testEcosystem!.testPriceOracle.setPrice(otherToken.address, '1000000000000000000'); // $1.00
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, true);

    const unwrapperImplementation = await createContractWithAbi(
      TestUpgradeableIsolationModeUnwrapperTrader__factory.abi,
      TestUpgradeableIsolationModeUnwrapperTrader__factory.bytecode,
      [],
    );
    const calldata = await unwrapperImplementation.populateTransaction.initialize(
        otherToken.address,
        factory.address,
        core.dolomiteMargin.address
    );
    const unwrapperProxy = await createContractWithAbi<IsolationModeTraderProxy>(
        IsolationModeTraderProxy__factory.abi,
        IsolationModeTraderProxy__factory.bytecode,
        [
            unwrapperImplementation.address,
            core.dolomiteMargin.address,
            calldata.data!,
        ],
    );
    unwrapper = TestUpgradeableIsolationModeUnwrapperTrader__factory.connect(unwrapperProxy.address, core.hhUser1);

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

  describe('#initializer', () => {
    it('should work', async () => {
      expect(await unwrapper.token()).to.eq(factory.address);
      expect(await unwrapper.VAULT_FACTORY()).to.eq(factory.address);
      expect(await unwrapper.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should fail when called again', async () => {
      await expectThrow(
        unwrapper.initialize(otherToken.address, factory.address, core.dolomiteMargin.address),
        'Initializable: contract is already initialized',
      );

      await expectThrow(
        unwrapper.initializeUnwrapperTrader(factory.address, core.dolomiteMargin.address),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await unwrapper.createActionsForUnwrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        otherMarketId,
        underlyingMarketId,
        ZERO_BI,
        amountWei,
        BYTES_EMPTY,
      );

      const amountOut = await unwrapper.getExchangeCost(
        factory.address,
        otherToken.address,
        amountWei,
        BYTES_EMPTY,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);

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
      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await unwrapper.connect(dolomiteMarginCaller).callFunction(
        core.hhUser5.address,
        { owner: vault.address, number: defaultAccountNumber },
        defaultAbiCoder.encode(['uint256'], [amountWei]),
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
        `UpgradeableUnwrapperTraderV2: Account owner is not a vault <${core.hhUser1.address.toLowerCase()}>`,
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
        'UpgradeableUnwrapperTraderV2: Invalid transfer amount',
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
        `UpgradeableUnwrapperTraderV2: Insufficient balance <${amountWei.toString()}, ${amountWei.mul(111)
          .toString()}>`,
      );
    });
  });

  describe('#exchange', () => {
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
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.weth.address.toLowerCase()}>`,
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
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if input amount is zero', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        unwrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          otherToken.address,
          factory.address,
          ZERO_BI,
          encodeExternalSellActionDataWithNoData(amountWei), // minOutputAmount
        ),
        'UpgradeableUnwrapperTraderV2: Invalid input amount',
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
        `UpgradeableUnwrapperTraderV2: Insufficient input token <0, ${amountWei.toString()}>`,
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
        `UpgradeableUnwrapperTraderV2: Insufficient output amount <${amountWei.toString()}, ${amountWei.mul(2)
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
      const actions = await unwrapper.createActionsForUnwrapping(
        solidAccountId,
        liquidAccountId,
        solidUser.address,
        core.hhUser1.address,
        otherMarketId,
        underlyingMarketId,
        otherAmountWei,
        amountWei,
        BYTES_EMPTY,
      );
      expect(actions.length).to.eq(2);

      // Inspect the call action
      expect(actions[0].actionType).to.eq(ActionType.Call);
      expect(actions[0].accountId).to.eq(liquidAccountId);
      expect(actions[0].otherAddress).to.eq(unwrapper.address);
      expect(actions[0].data).to.eq(ethers.utils.defaultAbiCoder.encode(['uint256'], [amountWei]));

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
        unwrapper.createActionsForUnwrapping(
          0,
          0,
          solidUser.address,
          core.hhUser1.address,
          otherMarketId,
          core.marketIds.weth,
          otherAmountWei,
          amountWei,
          BYTES_EMPTY,
        ),
        `UpgradeableUnwrapperTraderV2: Invalid input market <${core.marketIds.weth.toString()}>`,
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
        `UpgradeableUnwrapperTraderV2: Invalid output market <${core.marketIds.weth.toString()}>`,
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
        `UpgradeableUnwrapperTraderV2: Invalid input token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
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
        `UpgradeableUnwrapperTraderV2: Invalid output token <${core.tokens.dfsGlp!.address.toLowerCase()}>`,
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
        'UpgradeableUnwrapperTraderV2: Invalid desired input amount',
      );
    });
  });
});
