import { expect } from 'chai';
import { BaseContract, BigNumber, ContractTransaction } from 'ethers';
import {
  IERC20,
  CustomTestToken__factory,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultV1__factory,
} from '../../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  DOLOMITE_MARGIN,
} from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { snapshot, revertToSnapshotAndCapture } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

describe('WrappedTokenUserVaultFactory', () => {
  let snapshotId: string;

  let coreProtocol: CoreProtocol;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let wrappedTokenFactory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let initializeResult: ContractTransaction;

  before(async () => {
    coreProtocol = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = await createContractWithAbi<IERC20>(
      CustomTestToken__factory.abi,
      CustomTestToken__factory.bytecode,
      ['Test Token', 'TEST', 18],
    );
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    wrappedTokenFactory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
      TestWrappedTokenUserVaultFactory__factory.abi,
      TestWrappedTokenUserVaultFactory__factory.bytecode,
      [
        underlyingToken.address,
        BORROW_POSITION_PROXY_V2.address,
        userVaultImplementation.address,
        DOLOMITE_MARGIN.address,
      ],
    );
    await coreProtocol.testPriceOracle.setPrice(
      wrappedTokenFactory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await coreProtocol.dolomiteMargin.getNumMarkets();
    await coreProtocol.dolomiteMargin.connect(coreProtocol.governance).ownerAddMarket(
      wrappedTokenFactory.address,
      coreProtocol.testPriceOracle.address,
      coreProtocol.testInterestSetter.address,
      { value: 0 },
      { value: 0 },
      0,
      true,
      false,
    );
    initializeResult = await wrappedTokenFactory.initialize([]);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work when deployed normally', async () => {
      await expectEvent(wrappedTokenFactory, initializeResult, 'Initialized', {});
      expect(await wrappedTokenFactory.marketId()).to.eq(underlyingMarketId);
      expect(await wrappedTokenFactory.isInitialized()).to.eq(true);
    });

    it('should fail when already initialized', async () => {
      await expectThrow(
        wrappedTokenFactory.initialize([]),
        'WrappedTokenUserVaultFactory: Already initialized',
      );
    });

    it('should fail when market allows borrowing', async () => {
      const badFactory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
        TestWrappedTokenUserVaultFactory__factory.abi,
        TestWrappedTokenUserVaultFactory__factory.bytecode,
        [
          underlyingToken.address,
          BORROW_POSITION_PROXY_V2.address,
          userVaultImplementation.address,
          DOLOMITE_MARGIN.address,
        ],
      );
      await coreProtocol.testPriceOracle.setPrice(
        badFactory.address,
        '1000000000000000000', // $1.00
      );
      await coreProtocol.dolomiteMargin.connect(coreProtocol.governance).ownerAddMarket(
        badFactory.address,
        coreProtocol.testPriceOracle.address,
        coreProtocol.testInterestSetter.address,
        { value: 0 },
        { value: 0 },
        0,
        false,
        false,
      );

      await expectThrow(
        badFactory.initialize([]),
        'WrappedTokenUserVaultFactory: Market cannot allow borrowing',
      );
    });
  });
});
