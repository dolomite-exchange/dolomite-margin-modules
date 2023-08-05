import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumber, ContractTransaction } from 'ethers';
import {
  CustomTestToken,
  SimpleIsolationModeVaultFactory,
  TestIsolationModeTokenVaultV1__factory,
  TestIsolationModeUnwrapperTraderV1,
  TestIsolationModeUnwrapperTraderV1__factory,
  TestIsolationModeWrapperTraderV1,
  TestIsolationModeWrapperTraderV1__factory,
  TestSimpleIsolationModeVaultFactory,
  TestSimpleIsolationModeVaultFactory__factory,
} from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectArrayEq, expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

describe('SimpleIsolationModeVaultFactory', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let rewardToken: CustomTestToken;
  let rewardMarketId: BigNumber;
  let tokenUnwrapper: TestIsolationModeUnwrapperTraderV1;
  let tokenWrapper: TestIsolationModeWrapperTraderV1;
  let factory: SimpleIsolationModeVaultFactory;
  let userVaultImplementation: BaseContract;
  let initializeResult: ContractTransaction;

  let solidAccount: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestIsolationModeTokenVaultV1__factory.abi,
      TestIsolationModeTokenVaultV1__factory.bytecode,
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
      factory.address,
      '1000000000000000000', // $1.00
    );
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    rewardToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      rewardToken.address,
      '1000000000000000000', // $1.00
    );
    rewardMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, rewardToken, false);

    tokenUnwrapper = await createContractWithAbi<TestIsolationModeUnwrapperTraderV1>(
      TestIsolationModeUnwrapperTraderV1__factory.abi,
      TestIsolationModeUnwrapperTraderV1__factory.bytecode,
      [
        otherToken.address,
        factory.address,
        core.dolomiteMargin.address,
      ],
    );
    tokenWrapper = await createContractWithAbi<TestIsolationModeWrapperTraderV1>(
      TestIsolationModeWrapperTraderV1__factory.abi,
      TestIsolationModeWrapperTraderV1__factory.bytecode,
      [factory.address, core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(tokenWrapper.address, true);
    initializeResult = await factory.connect(core.governance)
      .ownerInitialize([tokenUnwrapper.address, tokenWrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidAccount = core.hhUser5;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetAllowableDebtMarketIds', () => {
    it('should work normally', async () => {
      const newAllowableDebtMarketIds = [BigNumber.from(4), BigNumber.from(5)];
      const result = await factory.connect(core.governance).ownerSetAllowableDebtMarketIds(newAllowableDebtMarketIds);
      await expectEvent(factory, result, 'AllowableDebtMarketIdsSet', {
        newAllowableDebtMarketIds,
      });
      expectArrayEq(await factory.allowableDebtMarketIds(), newAllowableDebtMarketIds);
    });

    it('should not work when not called by owner', async () => {
      await expectThrow(
        factory.connect(solidAccount).ownerSetAllowableDebtMarketIds([4, 5]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${solidAccount.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetAllowableCollateralMarketIds', () => {
    it('should work normally', async () => {
      const newAllowableCollateralMarketIds = [BigNumber.from(4), BigNumber.from(5)];
      const result = await factory.connect(core.governance)
        .ownerSetAllowableCollateralMarketIds(newAllowableCollateralMarketIds);
      await expectEvent(factory, result, 'AllowableCollateralMarketIdsSet', {
        newAllowableCollateralMarketIds,
      });
      expectArrayEq(await factory.allowableCollateralMarketIds(), newAllowableCollateralMarketIds);
    });

    it('should not work when not called by owner', async () => {
      await expectThrow(
        factory.connect(solidAccount).ownerSetAllowableCollateralMarketIds([4, 5]),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${solidAccount.address.toLowerCase()}>`,
      );
    });
  });

  describe('#allowableDebtMarketIds', () => {
    it('should work normally after construction', async () => {
      expectArrayEq(await factory.allowableDebtMarketIds(), [0, 1]);
    });
  });

  describe('#allowableCollateralMarketIds', () => {
    it('should work normally after construction', async () => {
      expectArrayEq(await factory.allowableCollateralMarketIds(), [2, 3]);
    });
  });
});
