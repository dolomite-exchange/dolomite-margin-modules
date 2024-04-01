import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  SimpleIsolationModeUnwrapperTraderV2,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeVaultFactory,
  SimpleIsolationModeWrapperTraderV2,
  SimpleIsolationModeWrapperTraderV2__factory,
  TestIsolationModeTokenVaultV1,
  TestIsolationModeTokenVaultV1__factory,
  TestSimpleIsolationModeVaultFactory,
  TestSimpleIsolationModeVaultFactory__factory,
} from '../../src/types';
import {
  createContractWithAbi,
  createContractWithLibrary,
  createTestToken,
  depositIntoDolomiteMargin,
} from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../utils/setup';
import { getWrapZapParams } from '../utils/zap-utils';

const defaultAccountNumber = 0;
const otherAccountNumber = 123;
const amountWei = ONE_ETH_BI;

describe('SimpleIsolationModeWrapperTraderV2', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let factoryMarketId: BigNumber;
  let tokenUnwrapper: SimpleIsolationModeUnwrapperTraderV2;
  let tokenWrapper: SimpleIsolationModeWrapperTraderV2;
  let factory: SimpleIsolationModeVaultFactory;
  let userVaultImplementation: BaseContract;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    const libraries = await createIsolationModeTokenVaultV1ActionsImpl();
    userVaultImplementation = await createContractWithLibrary<TestIsolationModeTokenVaultV1>(
      'TestIsolationModeTokenVaultV1',
      libraries,
      [],
    );
    const initialAllowableDebtMarketIds = [0, 1];
    const initialAllowableCollateralMarketIds = [2, 3];
    factory = await createContractWithAbi<TestSimpleIsolationModeVaultFactory>(
      TestSimpleIsolationModeVaultFactory__factory.abi,
      TestSimpleIsolationModeVaultFactory__factory.bytecode,
      [
        core.dolomiteRegistry.address,
        initialAllowableDebtMarketIds,
        initialAllowableCollateralMarketIds,
        underlyingToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      underlyingToken.address,
      '1000000000000000000', // $1.00
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      factory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, underlyingToken, false);

    factoryMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await factory.connect(core.governance).ownerSetAllowableCollateralMarketIds([underlyingMarketId, factoryMarketId]);
    await factory.connect(core.governance).ownerSetAllowableDebtMarketIds([underlyingMarketId]);
    tokenUnwrapper = await createContractWithAbi<SimpleIsolationModeUnwrapperTraderV2>(
      SimpleIsolationModeUnwrapperTraderV2__factory.abi,
      SimpleIsolationModeUnwrapperTraderV2__factory.bytecode,
      [
        factory.address,
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
      ],
    );
    tokenWrapper = await createContractWithAbi<SimpleIsolationModeWrapperTraderV2>(
      SimpleIsolationModeWrapperTraderV2__factory.abi,
      SimpleIsolationModeWrapperTraderV2__factory.bytecode,
      [factory.address, core.dolomiteMargin.address, core.dolomiteRegistry.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenUnwrapper.address, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance)
      .ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#isValidInputToken', () => {
    it('should return true if underlying token', async () => {
      expect(await tokenWrapper.isValidInputToken(underlyingToken.address)).to.be.true;
    });

    it('should return false if not underlying token', async () => {
      expect(await tokenWrapper.isValidInputToken(core.tokens.weth.address)).to.be.false;
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await tokenWrapper.getExchangeCost(
        underlyingToken.address,
        factory.address,
        amountWei,
        BYTES_EMPTY,
      )).to.eq(amountWei);
    });
  });

  describe('#exchange', () => {
    it('should work normally', async () => {
      await factory.createVault(core.hhUser1.address);
      const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
      const userVault = setupUserVaultProxy<TestIsolationModeTokenVaultV1>(
        vaultAddress,
        TestIsolationModeTokenVaultV1__factory,
        core.hhUser1,
      );

      await underlyingToken.addBalance(core.hhUser1.address, amountWei);
      await underlyingToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);
      await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, underlyingMarketId, amountWei);
      await userVault.transferIntoPositionWithOtherToken(
        defaultAccountNumber,
        otherAccountNumber,
        underlyingMarketId,
        amountWei,
        BalanceCheckFlag.Both,
      );
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, underlyingMarketId, amountWei);

      const zapParams = await getWrapZapParams(
        underlyingMarketId,
        amountWei,
        factoryMarketId,
        amountWei,
        tokenWrapper,
        core,
      );
      await userVault.swapExactInputForOutput(
        otherAccountNumber,
        zapParams.marketIdsPath,
        zapParams.inputAmountWei,
        zapParams.minOutputAmountWei,
        zapParams.tradersPath,
        zapParams.makerAccounts,
        zapParams.userConfig,
      );
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, factoryMarketId, amountWei);
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, underlyingMarketId, ZERO_BI);
    });
  });
});
