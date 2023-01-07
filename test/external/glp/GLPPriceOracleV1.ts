import BigNumber from 'bignumber.js';
import { getDolomiteMargin } from '../helpers/DolomiteMargin';
import { TestDolomiteMargin } from '../modules/TestDolomiteMargin';
import { fastForward, resetEVM, snapshot } from '../helpers/EVM';
import { ADDRESSES } from '../../src';
import { expectThrow } from '../helpers/Expect';

let dolomiteMargin: TestDolomiteMargin;
const GLP_PRICE = new BigNumber('915068283196857954'); // 18 decimals; $0.915068

describe('GLPPriceOracleV1', () => {
  let snapshotId: string;

  before(async () => {
    const r = await getDolomiteMargin();
    dolomiteMargin = r.dolomiteMargin;

    await resetEVM();
    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    await resetEVM(snapshotId);
  });

  describe('#updateOraclePrice', () => {
    it('updates the price of the oracle normally', async () => {
      const oraclePriceUpdateTimestampFirst = await dolomiteMargin.glpPriceOracle.lastOraclePriceUpdateTimestamp();
      const result = await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      expect(Object.keys(result.events).length).to.eql(1);
      const event = dolomiteMargin.logs.parseEventLogWithContract(dolomiteMargin.contracts.glpPriceOracleV1, result.events['OraclePriceUpdated']);
      expect(event.name).to.eql('OraclePriceUpdated');
      expect(event.args['oraclePrice']).to.eql(GLP_PRICE);

      const oraclePriceUpdateTimestampLast = await dolomiteMargin.glpPriceOracle.lastOraclePriceUpdateTimestamp();
      const timeElapsed = oraclePriceUpdateTimestampLast.minus(oraclePriceUpdateTimestampFirst);
      expect(event.args['cumulativePrice']).to.eql(GLP_PRICE.times(timeElapsed));
    });

    it('fails if the price has not expired yet', async () => {
      await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      await expectThrow(
        dolomiteMargin.glpPriceOracle.updateOraclePrice(),
        'GLPPriceOracleV1: update not allowed yet',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under the correct conditions for GLP', async () => {
      await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      const glp = await dolomiteMargin.glpPriceOracle.glp();
      const price = await dolomiteMargin.glpPriceOracle.getPrice(glp);
      expect(price).to.eql(GLP_PRICE);
    });

    it('returns the correct value under the correct conditions for fGLP', async () => {
      await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      const fGLP = await dolomiteMargin.glpPriceOracle.fGlp();
      const price = await dolomiteMargin.glpPriceOracle.getPrice(fGLP);
      expect(price).to.eql(GLP_PRICE);
    });

    it('fails when price is not set yet', async () => {
      const glp = await dolomiteMargin.glpPriceOracle.glp();
      await expectThrow(
        dolomiteMargin.glpPriceOracle.getPrice(glp),
        'GLPPriceOracleV1: oracle price not set',
      );
    });

    it('fails when token sent is not GLP', async () => {
      await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      await expectThrow(
        dolomiteMargin.glpPriceOracle.getPrice(ADDRESSES.ZERO),
        'GLPPriceOracleV1: invalid token',
      );
      await expectThrow(
        dolomiteMargin.glpPriceOracle.getPrice(ADDRESSES.TEST_UNISWAP),
        'GLPPriceOracleV1: invalid token',
      );
    });

    it('fails when price is expired', async () => {
      await dolomiteMargin.glpPriceOracle.updateOraclePrice();
      const glp = await dolomiteMargin.glpPriceOracle.glp();
      await fastForward((12 * 3600) + 1); // 12 hours
      await expectThrow(
        dolomiteMargin.glpPriceOracle.getPrice(glp),
        'GLPPriceOracleV1: oracle price expired',
      );
    });
  });
});
