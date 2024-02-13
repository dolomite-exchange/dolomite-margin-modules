import { expect } from 'chai';
import { TestDolomiteMarginVersionWrapperLib, TestDolomiteMarginVersionWrapperLib__factory } from '../../src/types';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { NO_EXPIRY, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { expectThrow } from '../utils/assertions';
import { parseEther } from 'ethers/lib/utils';

describe('DolomiteMarginVersionWrapperLib_Arbitrum', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let versionWrapper: TestDolomiteMarginVersionWrapperLib

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    versionWrapper = await createContractWithAbi<TestDolomiteMarginVersionWrapperLib>(
      TestDolomiteMarginVersionWrapperLib__factory.abi,
      TestDolomiteMarginVersionWrapperLib__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getVersionedLiquidationSpreadForPair', () => {
    it('should work normally', async () => {
      const spread = await versionWrapper.getVersionedLiquidationSpreadForPair(
        core.dolomiteMargin.address,
        Network.ArbitrumOne,
        { owner: core.hhUser1.address, number: ZERO_BI},
        core.marketIds.weth,
        core.marketIds.usdc
      );
      expect(spread.value).to.eq(parseEther('.05'));
    });

    it('should revert if passed ZkEvm chain id', async () => {
      await expectThrow(
        versionWrapper.getVersionedLiquidationSpreadForPair(
          core.dolomiteMargin.address,
          Network.PolygonZkEvm,
          { owner: core.hhUser1.address, number: ZERO_BI},
          core.marketIds.weth,
          core.marketIds.usdc
        ),
      );
    });
  });

  describe('#getVersionedSpreadAdjustedPrices', () => {
    it('should work normally', async () => {
      await versionWrapper.getVersionedSpreadAdjustedPrices(
        core.expiry.address,
        Network.ArbitrumOne,
        { owner: core.hhUser1.address, number: ZERO_BI},
        core.marketIds.weth,
        core.marketIds.usdc,
        NO_EXPIRY
      );
    });

    it('should revert if passed ZkEvm chain id', async () => {
      await expectThrow(
        versionWrapper.getVersionedSpreadAdjustedPrices(
          core.expiry.address,
          Network.PolygonZkEvm,
          { owner: core.hhUser1.address, number: ZERO_BI},
          core.marketIds.weth,
          core.marketIds.usdc,
          NO_EXPIRY
        ),
      );
    });
  });
});
