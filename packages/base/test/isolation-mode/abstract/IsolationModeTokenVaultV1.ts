import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  CustomTestToken,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV2,
  TestIsolationModeUnwrapperTraderV2__factory,
  TestIsolationModeVaultFactory,
  TestIsolationModeWrapperTraderV2,
  TestIsolationModeWrapperTraderV2__factory,
} from '../../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createContractWithName,
  createTestToken,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '../../../src/utils/SignerWithAddressWithSafety';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from '../../utils/assertions';

import { CoreProtocolArbitrumOne } from '../../utils/core-protocols/core-protocol-arbitrum-one';
import {
  createAndUpgradeDolomiteRegistry,
  createEventEmitter,
  createIsolationModeTokenVaultV1ActionsImpl,
} from '../../utils/dolomite';
import { createTestIsolationModeVaultFactory } from '../../utils/ecosystem-utils/testers';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
  setupUserVaultProxy,
} from '../../utils/setup';
import { getSimpleZapParams, getUnwrapZapParams, getWrapZapParams } from '../../utils/zap-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const bigOtherAmountWei = BigNumber.from('100000000000'); // $100,000
const usdcAmount = BigNumber.from('100000000'); // $100

describe('IsolationModeTokenVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let isolationModeMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV2;
  let tokenWrapper: TestIsolationModeWrapperTraderV2;
  let factory: TestIsolationModeVaultFactory;
  let userVaultImplementation: TestIsolationModeTokenVaultV1;
  let userVault: TestIsolationModeTokenVaultV1;

  let solidUser: SignerWithAddressWithSafety;
  let otherToken1: CustomTestToken;
  let otherToken2: CustomTestToken;
  let otherMarketId1: BigNumber;
  let otherMarketId2: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 326_681_400,
      network: Network.ArbitrumOne,
    });
    await createAndUpgradeDolomiteRegistry(core);

    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const genericTraderProxy = await createContractWithLibrary(
      'GenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary('TestIsolationModeTokenVaultV1', { ...libraries }, []);
    factory = await createTestIsolationModeVaultFactory(core, underlyingToken, userVaultImplementation);
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    const eventEmitter = await createEventEmitter(core);
    await core.dolomiteRegistry.connect(core.governance).ownerSetEventEmitter(eventEmitter.address);

    isolationModeMarketId = await core.dolomiteMargin.getNumMarkets();
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

    tokenUnwrapper = await createContractWithAbi(
      TestIsolationModeUnwrapperTraderV2__factory.abi,
      TestIsolationModeUnwrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    tokenWrapper = await createContractWithAbi(
      TestIsolationModeWrapperTraderV2__factory.abi,
      TestIsolationModeWrapperTraderV2__factory.bytecode,
      [otherToken1.address, factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize(
      [tokenUnwrapper.address, tokenWrapper.address, core.depositWithdrawalRouter.address]
    );

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
      vaultAddress,
      TestIsolationModeTokenVaultV1__factory,
      core.hhUser1,
    );

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

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

    await createAndUpgradeDolomiteRegistry(core);
    const selectors = [...(await userVaultImplementation.testGetFunctionSelectors())];
    await core.dolomiteRegistry.ownerSetIsolationModeMulticallFunctions(selectors.sort());

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('basic read functions', () => {
    it('should work', async () => {
      expect(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
      expect(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(factory.address);
      expect(await userVault.marketId()).to.eq(isolationModeMarketId);

      expect(await userVault.underlyingBalanceOf()).to.eq(ZERO_BI);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      expect(await userVault.underlyingBalanceOf()).to.eq(amountWei);
    });
  });

  describe('#nonReentrant', () => {
    it('should work when no reentrancy happens', async () => {
      await userVault.testReentrancy(false);
    });

    it('should fail when reentrancy happens', async () => {
      await expectThrow(userVault.testReentrancy(true), 'IsolationModeTokenVaultV1: Reentrant call');
    });
  });

  describe('#initialize', () => {
    it('should fail when already initialized', async () => {
      await expectThrow(userVault.initialize(), 'IsolationModeTokenVaultV1: Already initialized');
    });
  });

  describe('#multicall', () => {
    it('should work normally with one deposit into vault', async () => {
      const calldata = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work normally with multiple deposits into vault', async () => {
      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei.mul(2));
      const calldata = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!, calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei.mul(2));

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei.mul(2));
      await expectWalletBalance(userVault, underlyingToken, amountWei.mul(2));

      await expectTotalSupply(factory, amountWei.mul(2));
    });

    it('should fail if calldata is less than 4 bytes', async () => {
      await expectThrow(
        userVault.multicall(['0x1234']),
        'IsolationModeVaultV1ActionsImpl: Invalid calldata length'
      );
    });

    it('should fail if calldata contains a disallowed function', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const calldata = await userVault.populateTransaction.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(
        userVault.multicall([calldata.data!]),
        'IsolationModeVaultV1ActionsImpl: Disallowed multicall function',
      );
    });

    it('should revert with correct message if one multicall fails', async () => {
      const calldata = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(userVault.multicall([calldata.data!, calldata.data!]), 'Token: transferFrom failed');
    });

    it('should fail if not called by owner', async () => {
      const calldata = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(
        userVault.connect(core.hhUser2).multicall([calldata.data!]),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#validateDepositIntoVaultAfterTransfer', () => {
    it('should work normally when depositing isolation mode asset', async () => {
      await underlyingToken.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, amountWei);
      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        0
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);
    });

    it('should work normally when depositing other asset', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, otherAmountWei);

      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        0
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when depositing other asset into account number 0', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, otherAmountWei);

      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
          isolationModeMarketId,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          0
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>'
      );
    });

    it('should fail if not valid collateral asset', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, otherAmountWei);
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);

      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
          isolationModeMarketId,
          borrowAccountNumber,
          otherMarketId1,
          otherAmountWei,
          0
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId1.toString()}>`
      );
    });
  });

  describe('#validateWithdrawalFromVaultAfterTransfer', () => {
    it('should work normally for isolation mode asset', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        0
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);
    });

    it('should work normally when withdrawing other asset from borrow account', async () => {
      await otherToken1.connect(core.hhUser1).addBalance(core.hhUser1.address, otherAmountWei);
      await otherToken1.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, otherAmountWei);

      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        0
      );

      await core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
        isolationModeMarketId,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when withdrawing other asset from default account', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
          isolationModeMarketId,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.None
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>'
      );
    });

    it('should fail if balance is negative and not a valid debt market', async () => {
      await factory.setAllowableDebtMarketIds([otherMarketId1]);
      await underlyingToken.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, amountWei);
      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        isolationModeMarketId,
        borrowAccountNumber,
        isolationModeMarketId,
        amountWei,
        0
      );

      await expectThrow(
        core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
          isolationModeMarketId,
          borrowAccountNumber,
          otherMarketId2,
          ONE_BI,
          BalanceCheckFlag.None
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId2.toString()}>`
      );
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work normally with router', async () => {
      await underlyingToken.connect(core.hhUser1).approve(core.depositWithdrawalRouter.address, amountWei);
      await core.depositWithdrawalRouter.connect(core.hhUser1).depositWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        0
      );
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work with multicall', async () => {
      const calldata = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(factory, amountWei);
    });

    it('should work when interacted with via factory', async () => {
      const factorySigner = await impersonate(factory.address, true);
      await userVault.connect(factorySigner).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, factory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      await expectTotalSupply(factory, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should work normally with router', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await core.depositWithdrawalRouter.connect(core.hhUser1).withdrawWei(
        isolationModeMarketId,
        defaultAccountNumber,
        isolationModeMarketId,
        amountWei,
        0
      );
      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should work with multicall', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.withdrawFromVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, factory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(factory, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.withdrawFromVaultForDolomiteMargin(
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin('1', amountWei),
        'IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should work with multicall', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.openBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when msg.value is not 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei, { value: 1 }),
        'IsolationModeTokenVaultV1: Cannot send ETH',
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#openMarginPosition', () => {
    const borrowMarketId = 2;

    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openMarginPosition(defaultAccountNumber, borrowAccountNumber, borrowMarketId, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should work with multicall', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.openMarginPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        borrowMarketId,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.openMarginPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        borrowMarketId,
        amountWei,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .openMarginPosition(defaultAccountNumber, borrowAccountNumber, borrowMarketId, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when msg.value is not 0', async () => {
      await expectThrow(
        userVault.openMarginPosition(defaultAccountNumber, borrowAccountNumber, borrowMarketId, amountWei, {
          value: 1,
        }),
        'IsolationModeTokenVaultV1: Cannot send ETH',
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openMarginPosition(borrowAccountNumber, defaultAccountNumber, borrowMarketId, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openMarginPosition(defaultAccountNumber, defaultAccountNumber, borrowMarketId, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.closeBorrowPositionWithUnderlyingVaultToken(
        borrowAccountNumber,
        defaultAccountNumber,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, borrowAccountNumber),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.closeBorrowPositionWithOtherTokens(
        borrowAccountNumber,
        defaultAccountNumber,
        [otherMarketId1],
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when underlying is requested to be withdrawn', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [
          isolationModeMarketId,
        ]),
        `IsolationModeVaultV1ActionsImpl: Cannot withdraw market to wallet <${isolationModeMarketId.toString()}>`,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .closeBorrowPositionWithOtherTokens(borrowAccountNumber, defaultAccountNumber, [otherMarketId1]),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithOtherTokens(defaultAccountNumber, borrowAccountNumber, [otherMarketId1]),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should work with multicall', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.transferIntoPositionWithUnderlyingToken(
        defaultAccountNumber,
        borrowAccountNumber,
        amountWei,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when borrowAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should work with multicall', async () => {
      const calldata = await userVault.populateTransaction.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should work normally when collateral market is allowed', async () => {
      await factory.setAllowableCollateralMarketIds([otherMarketId1]);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should work normally for disallowed collateral asset that goes negative (debt market)', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );

      // the default account had $10, then added another $10, then lost $5, so it should have $15
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, BigNumber.from('15000000'));
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei.div(-2));
    });

    it('should work when non-allowable debt market is transferred in', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      // attempt to transfer another market ID in
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .transferIntoPositionWithOtherToken(
            defaultAccountNumber,
            borrowAccountNumber,
            otherMarketId1,
            otherAmountWei,
            BalanceCheckFlag.Both,
          ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrow account number is 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          defaultAccountNumber,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when underlying token is used as transfer token', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${isolationModeMarketId.toString()}>`,
      );
    });

    it('should fail when transferring in an unsupported collateral token', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await expectThrow(
        userVault.transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId1.toString()}>`,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should work with multicall', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.transferFromPositionWithUnderlyingToken(
        borrowAccountNumber,
        defaultAccountNumber,
        amountWei,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.transferFromPositionWithUnderlyingToken(
        borrowAccountNumber,
        defaultAccountNumber,
        amountWei,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, borrowAccountNumber, amountWei),
        `IsolationModeVaultV1ActionsImpl: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work when no allowable debt market is set (all are allowed then)', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
    });

    it('should work with multicall', async () => {
      await factory.setAllowableDebtMarketIds([]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      const calldata = await userVault.populateTransaction.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await userVault.multicall([calldata.data!]);
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([otherMarketId1]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable collateral market is set', async () => {
      await factory.setAllowableCollateralMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
    });

    it('should work when 1 allowable debt market is set', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.None,
      );
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.None,
      );
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .transferFromPositionWithOtherToken(
            borrowAccountNumber,
            defaultAccountNumber,
            otherMarketId1,
            otherAmountWei,
            BalanceCheckFlag.Both,
          ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber is 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          defaultAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>',
      );
    });

    it('should fail when not underlying market is used', async () => {
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          isolationModeMarketId,
          amountWei,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${isolationModeMarketId.toString()}>`,
      );
    });

    it('should fail when an invalid debt market is used', async () => {
      await factory.setAllowableDebtMarketIds([core.marketIds.weth]);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId1,
          otherAmountWei,
          BalanceCheckFlag.To,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId1}>`,
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.div(2),
        BalanceCheckFlag.To,
      );
      await userVault.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const tx = await userVault.populateTransaction.repayAllForBorrowPosition(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        BalanceCheckFlag.Both,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .repayAllForBorrowPosition(defaultAccountNumber, borrowAccountNumber, otherMarketId1, BalanceCheckFlag.Both),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          defaultAccountNumber,
          isolationModeMarketId,
          BalanceCheckFlag.Both,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid borrowAccountNumber <0>',
      );
    });

    it('should fail when underlying market is repaid', async () => {
      await expectThrow(
        userVault.repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          isolationModeMarketId,
          BalanceCheckFlag.Both,
        ),
        `IsolationModeVaultV1ActionsImpl: Invalid marketId <${isolationModeMarketId.toString()}>`,
      );
    });
  });

  describe('#addCollateralAndSwapExactInputForOutput', () => {
    it('should work for other token when balance is 0', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work for other token when balance is positive', async () => {
      const inputAmount = otherAmountWei.div(2);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        inputAmount,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work when input amount is set to ALL', async () => {
      const inputAmount = otherAmountWei.div(2);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        inputAmount,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        MAX_UINT_256_BI,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, inputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, outputAmount);
    });

    it('should work when tradeAccountNumber is 0 when marketIds are correct', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams1 = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          defaultAccountNumber,
          zapParams1.marketIdsPath,
          zapParams1.inputAmountWei,
          zapParams1.minOutputAmountWei,
          zapParams1.tradersPath,
          zapParams1.makerAccounts,
          zapParams1.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid marketId for swap/add',
      );

      const zapParams2 = await getWrapZapParams(
        otherMarketId1,
        otherAmountWei,
        isolationModeMarketId,
        outputAmount,
        tokenWrapper,
        core,
      );
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        defaultAccountNumber,
        zapParams2.marketIdsPath,
        zapParams2.inputAmountWei,
        zapParams2.minOutputAmountWei,
        zapParams2.tradersPath,
        zapParams2.makerAccounts,
        zapParams2.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, outputAmount);
    });

    it('should work normally for isolation unwrapper', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        outputAmount,
        tokenUnwrapper,
        core,
      );
      await userVault.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, outputAmount);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should fail if transfer all is for non-positive balance', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(
        core.marketIds.weth,
        otherAmountWei,
        otherMarketId2,
        outputAmount,
        core,
      );
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          MAX_UINT_256_BI,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid balance for transfer all',
      );
    });

    it('should fail when reentrancy is triggered', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const tx = await userVault.populateTransaction.addCollateralAndSwapExactInputForOutput(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .addCollateralAndSwapExactInputForOutput(
            defaultAccountNumber,
            borrowAccountNumber,
            zapParams.marketIdsPath,
            zapParams.inputAmountWei,
            zapParams.minOutputAmountWei,
            zapParams.tradersPath,
            zapParams.makerAccounts,
            zapParams.userConfig,
          ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when msg.value is not 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
          { value: 1 },
        ),
        'IsolationModeTokenVaultV1: Cannot send ETH',
      );
    });

    it('should fail if transferred asset (from input) is negative', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.To,
      );
      await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, otherMarketId1, MAX_UINT_256_BI);

      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        otherAmountWei.div(4),
        otherMarketId2,
        otherAmountWei,
        core,
      );
      await expectThrow(
        userVault.addCollateralAndSwapExactInputForOutput(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `AccountBalanceLib: account cannot go negative <${core.hhUser1.address.toLowerCase()}, ${defaultAccountNumber}, ${zapParams.marketIdsPath[0].toString()}>`,
      );
    });
  });

  describe('#swapExactInputForOutputAndRemoveCollateral', () => {
    it('should work for other output token when balance before is zero', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
    });

    it('should work for other output token when balance before is positive', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, outputAmount);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
    });

    it('should work for isolation output token when balance before is positive', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const zapParams = await getWrapZapParams(
        otherMarketId1,
        otherAmountWei,
        isolationModeMarketId,
        amountWei,
        tokenWrapper,
        core,
      );
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);
    });

    it('should work when transferred asset (from output) is negative', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      const borrowAmount = otherAmountWei.div(2);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(borrowAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, borrowAmount.mul(-1));

      const inputAmount = otherAmountWei.div(4);
      const outputAmount = otherAmountWei.div(8);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei.sub(inputAmount),
      );
      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId2,
        otherAmountWei.add(borrowAmount).add(outputAmount),
      );
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, borrowAmount.mul(-1));
    });

    it('should work when tradeAccountNumber is 0 when marketIds are correct', async () => {
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, otherAmountWei);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);

      await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, amountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams1 = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          defaultAccountNumber,
          zapParams1.marketIdsPath,
          zapParams1.inputAmountWei,
          zapParams1.minOutputAmountWei,
          zapParams1.tradersPath,
          zapParams1.makerAccounts,
          zapParams1.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid marketId for swap/remove',
      );

      const zapParams2 = await getUnwrapZapParams(
        isolationModeMarketId,
        amountWei,
        otherMarketId1,
        amountWei.div(1e12),
        tokenUnwrapper,
        core,
      );
      await userVault.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        defaultAccountNumber,
        zapParams2.marketIdsPath,
        zapParams2.inputAmountWei,
        zapParams2.minOutputAmountWei,
        zapParams2.tradersPath,
        zapParams2.makerAccounts,
        zapParams2.userConfig,
      );

      await expectProtocolBalance(
        core,
        core.hhUser1,
        defaultAccountNumber,
        otherMarketId1,
        otherAmountWei.add(zapParams2.minOutputAmountWei),
      );
      await expectProtocolBalance(core, userVault, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, isolationModeMarketId, ZERO_BI);
    });

    it('should fail when reentrancy is triggered', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const tx = await userVault.populateTransaction.swapExactInputForOutputAndRemoveCollateral(
        defaultAccountNumber,
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .swapExactInputForOutputAndRemoveCollateral(
            defaultAccountNumber,
            borrowAccountNumber,
            zapParams.marketIdsPath,
            zapParams.inputAmountWei,
            zapParams.minOutputAmountWei,
            zapParams.tradersPath,
            zapParams.makerAccounts,
            zapParams.userConfig,
          ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when not msg.value is not zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutputAndRemoveCollateral(
          defaultAccountNumber,
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
          { value: 1 },
        ),
        'IsolationModeTokenVaultV1: Cannot send ETH',
      );
    });
  });

  describe('#swapExactInputForOutput', () => {
    it('should work normally', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should work normally with multicall', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const calldata = await userVault.populateTransaction.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await userVault.multicall([calldata.data!]);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should work if input amount is set to ALL', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await userVault.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        MAX_UINT_256_BI,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should work normally if converter calls', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, otherAmountWei);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId2, otherAmountWei);

      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await factory.connect(core.governance).ownerSetIsTokenConverterTrusted(core.hhUser5.address, true);
      await userVault
        .connect(core.hhUser5)
        .swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        );

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, otherMarketId1, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, otherMarketId2, ZERO_BI);
      await expectProtocolBalance(
        core,
        userVault,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei.add(outputAmount),
      );
    });

    it('should fail if transfer all is for non-positive balance', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          MAX_UINT_256_BI,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid balance for transfer all',
      );
    });

    it('should fail when reentrancy is triggered', async () => {
      const outputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, outputAmount, core);
      const tx = await userVault.populateTransaction.swapExactInputForOutput(
        borrowAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectThrow(userVault.testReentrancyOnOtherFunction(tx.data!), 'IsolationModeTokenVaultV1: Reentrant call');
    });

    it('should fail when not called by vault owner or converter', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault
          .connect(core.hhUser2)
          .swapExactInputForOutput(
            borrowAccountNumber,
            zapParams.marketIdsPath,
            zapParams.inputAmountWei,
            zapParams.minOutputAmountWei,
            zapParams.tradersPath,
            zapParams.makerAccounts,
            zapParams.userConfig,
          ),
        `IsolationModeTokenVaultV1: Only owner or converter can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when msg.value is not zero', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
          { value: 1 },
        ),
        'IsolationModeTokenVaultV1: Cannot send ETH',
      );
    });

    it('should fail if tradeAccountNumber is 0', async () => {
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          defaultAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        'IsolationModeVaultV1ActionsImpl: Invalid tradeAccountNumber <0>',
      );
    });

    it('should fail if inputMarketId is not allowed collateral', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableCollateralMarketIds([otherMarketId2]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail if inputMarketId is not allowed debt', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId2,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableDebtMarketIds([otherMarketId2]);
      const inputAmount = otherAmountWei.div(2);
      const zapParams = await getSimpleZapParams(otherMarketId1, inputAmount, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId1.toString()}>`,
      );
    });

    it('should fail if outputMarketId is not allowed collateral', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      await factory.setAllowableCollateralMarketIds([otherMarketId1]);
      const zapParams = await getSimpleZapParams(otherMarketId1, otherAmountWei, otherMarketId2, otherAmountWei, core);
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as collateral <${otherMarketId2.toString()}>`,
      );
    });

    it('should fail if outputMarketId is not allowed debt', async () => {
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        borrowAccountNumber,
        otherMarketId1,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
      const borrowAmount = otherAmountWei.div(2);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId2,
        borrowAmount,
        BalanceCheckFlag.To,
      );
      await factory.setAllowableDebtMarketIds([otherMarketId1]);
      const zapParams = await getSimpleZapParams(
        otherMarketId1,
        borrowAmount,
        otherMarketId2,
        borrowAmount.div(2),
        core,
      );
      await expectThrow(
        userVault.swapExactInputForOutput(
          borrowAccountNumber,
          zapParams.marketIdsPath,
          zapParams.inputAmountWei,
          zapParams.minOutputAmountWei,
          zapParams.tradersPath,
          zapParams.makerAccounts,
          zapParams.userConfig,
        ),
        `IsolationModeVaultV1ActionsImpl: Market not allowed as debt <${otherMarketId2.toString()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeDepositIntoVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `IsolationModeTokenVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#requireNotLiquidatable', () => {
    it('should pass if not liquidatable', async () => {
      await expect(userVault.connect(core.hhUser1).testRequireNotLiquidatable(ZERO_BI)).to.not.be.reverted;
    });

    it('should fail if liquidatable', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        core.marketIds.usdc,
        usdcAmount,
        BalanceCheckFlag.None,
      );

      await core.testEcosystem!.testPriceOracle.setPrice(factory.address, '10');
      await expectThrow(
        userVault.connect(core.hhUser1).testRequireNotLiquidatable(borrowAccountNumber),
        'IsolationModeVaultV1ActionsImpl: Account liquidatable',
      );
    });
  });

  describe('#requireOnlyConverter', () => {
    it('should pass if token converter', async () => {
      const wrapperImpersonator = await impersonate(tokenWrapper.address, true);
      await expect(userVault.connect(wrapperImpersonator).testRequireOnlyConverter()).to.not.be.reverted;
    });

    it('should fail if not token converter', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).testRequireOnlyConverter(),
        `IsolationModeTokenVaultV1: Only converter can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#testGetMarketInfos', () => {
    it('should work normally', async () => {
      await userVault.testGetMarketInfos([], [0, 0]);
    });
  });

  describe('#testBinarySearch', () => {
    it('should fail if len is 0', async () => {
      await expectThrow(userVault.testBinarySearch([], 0, 0, 0), 'BaseLiquidatorProxy: Market not found');
    });

    it('should fail if len is 1 and marketIds are not equal', async () => {
      await expectThrow(userVault.testBinarySearch([0], 0, 1, 3), 'BaseLiquidatorProxy: Market not found');
    });
  });

  describe('#testSelectorBinarySearch', () => {
    it('should return false if no selectors are provided', async () => {
      expect(await userVault.testSelectorBinarySearch([], '0x12345678')).to.equal(false);
    });

    it('should return false if selector is lower or greater than provided selectors', async () => {
      expect(await userVault.testSelectorBinarySearch(['0x22222222', '0x88888888'], '0x11111111')).to.equal(false);
      expect(await userVault.testSelectorBinarySearch(['0x22222222', '0x88888888'], '0x99999999')).to.equal(false);
    });
  });

  describe('#testGetAccountValuesWithAdjustMarginPremium', async () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      const values = await userVault.testGetAccountValuesWithAdjustMarginPremium(defaultAccountNumber);
      expect(values.supplyValue.value).to.equal(amountWei.mul(ONE_ETH_BI));
    });
  });
});
