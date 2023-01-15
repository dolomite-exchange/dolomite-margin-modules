import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { GLPPriceOracleV1, GLPPriceOracleV1__factory } from '../../../src/types';
import { BYTES_EMPTY, GLP, GLP_MANAGER, GMX_VAULT, S_GLP } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { snapshot, revertToSnapshotAndCapture, waitHours } from '../../utils';
import { expectEvent, expectThrow } from '../../utils/assertions';
import { setupCoreProtocol } from '../../utils/setup';

const GLP_PRICE = BigNumber.from(1);

describe('GLPPriceOracleV1', () => {
  let snapshotId: string;

  let glpPriceOracle: GLPPriceOracleV1;

  before(async () => {
    await setupCoreProtocol({
      blockNumber: 53107700,
    });
    glpPriceOracle = await createContractWithAbi<GLPPriceOracleV1>(
      GLPPriceOracleV1__factory.abi,
      GLPPriceOracleV1__factory.bytecode,
      [GLP_MANAGER.address, GMX_VAULT.address, GLP.address, S_GLP.address], // technically should be DS_GLP
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#updateOraclePrice', () => {
    it('updates the price of the oracle normally', async () => {
      const oraclePriceUpdateTimestampFirst = await glpPriceOracle.lastOraclePriceUpdateTimestamp();
      const result = await glpPriceOracle.performUpkeep(BYTES_EMPTY);
      const oraclePriceUpdateTimestampLast = await glpPriceOracle.lastOraclePriceUpdateTimestamp();
      const timeElapsed = oraclePriceUpdateTimestampLast.sub(oraclePriceUpdateTimestampFirst);

      await expectEvent(glpPriceOracle, result, 'OraclePriceUpdated', {
        oraclePrice: GLP_PRICE,
        cumulativePrice: GLP_PRICE.mul(timeElapsed),
      });
    });

    it('fails if the price has not expired yet', async () => {
      await glpPriceOracle.performUpkeep('0x0');
      await expectThrow(
        glpPriceOracle.performUpkeep(BYTES_EMPTY),
        'GLPPriceOracleV1: update not allowed yet',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under the correct conditions for dsGLP', async () => {
      await glpPriceOracle.performUpkeep(BYTES_EMPTY);
      const gsGlp = await glpPriceOracle.dsGlp();
      const price = await glpPriceOracle.getPrice(gsGlp);
      expect(price).to.eql(GLP_PRICE);
    });

    it('fails when price is not set yet', async () => {
      const glp = await glpPriceOracle.glp();
      await expectThrow(
        glpPriceOracle.getPrice(glp),
        'GLPPriceOracleV1: oracle price not set',
      );
    });

    it('fails when token sent is not dsGLP', async () => {
      await glpPriceOracle.performUpkeep(BYTES_EMPTY);
      await expectThrow(
        glpPriceOracle.getPrice(ADDRESSES.ZERO),
        'GLPPriceOracleV1: invalid token',
      );
      await expectThrow(
        glpPriceOracle.getPrice(ADDRESSES.TEST_UNISWAP),
        'GLPPriceOracleV1: invalid token',
      );
      await expectThrow(
        glpPriceOracle.getPrice(await glpPriceOracle.glp()),
        'GLPPriceOracleV1: invalid token',
      );
    });

    it('fails when price is expired', async () => {
      await glpPriceOracle.performUpkeep(BYTES_EMPTY);
      const glp = await glpPriceOracle.glp();
      await waitHours(13);
      await expectThrow(
        glpPriceOracle.getPrice(glp),
        'GLPPriceOracleV1: oracle price expired',
      );
    });
  });
});
