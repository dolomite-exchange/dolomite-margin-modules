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
import { createContractWithAbi, createContractWithLibrary, createContractWithName, createTestToken } from '../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance } from '../utils/assertions';
import { createAndUpgradeDolomiteRegistry, createIsolationModeTokenVaultV1ActionsImpl } from '../utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket, setupUserVaultProxy, } from '../utils/setup';
import { getUnwrapZapParams } from '../utils/zap-utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';

const defaultAccountNumber = 0;
const otherAccountNumber = 123;
const amountWei = ONE_ETH_BI;

describe('SimpleIsolationModeUnwrapperTraderV2', () => {
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
    await createAndUpgradeDolomiteRegistry(core);
    const genericTraderLib = await createContractWithName('GenericTraderProxyV2Lib', []);
    const genericTraderProxy = await createContractWithLibrary(
      'GenericTraderProxyV2',
      { GenericTraderProxyV2Lib: genericTraderLib.address },
      [Network.ArbitrumOne, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    await core.dolomiteRegistry.ownerSetGenericTraderProxy(genericTraderProxy.address);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(genericTraderProxy.address, true);

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
        initialAllowableDebtMarketIds,
        initialAllowableCollateralMarketIds,
        underlyingToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteRegistry.address,
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

  describe('#isValidOutputToken', () => {
    it('should return true if underlying token', async () => {
      expect(await tokenUnwrapper.isValidOutputToken(underlyingToken.address)).to.be.true;
    });

    it('should return false if not underlying token', async () => {
      expect(await tokenUnwrapper.isValidOutputToken(core.tokens.weth.address)).to.be.false;
    });
  });

  describe('#getExchangeCost', () => {
    it('should work normally', async () => {
      expect(await tokenUnwrapper.getExchangeCost(
        factory.address,
        underlyingToken.address,
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
      await underlyingToken.connect(core.hhUser1).approve(userVault.address, amountWei);
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, otherAccountNumber, amountWei);
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, factoryMarketId, amountWei);

      const zapParams = await getUnwrapZapParams(
        factoryMarketId,
        amountWei,
        underlyingMarketId,
        amountWei,
        tokenUnwrapper,
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
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, factoryMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault.address, otherAccountNumber, underlyingMarketId, amountWei);
    });
  });
});
