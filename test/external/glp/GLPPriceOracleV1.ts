import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { GLPPriceOracleV1, GLPPriceOracleV1__factory } from '../../../src/types';
import { GLP, GLP_MANAGER, GMX_VAULT, S_GLP } from '../../../src/utils/constants';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { snapshot, revertToSnapshotAndCapture } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { setupCoreProtocol } from '../../utils/setup';

const GLP_PRICE = BigNumber.from('911464299405961697'); // $0.911464

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
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under the correct conditions for dsGLP', async () => {
      const gsGlp = await glpPriceOracle.DS_GLP();
      const price = await glpPriceOracle.getPrice(gsGlp);
      expect(price.value).to.eq(GLP_PRICE);
    });

    it('fails when token sent is not dsGLP', async () => {
      await expectThrow(
        glpPriceOracle.getPrice(ADDRESSES.ZERO),
        'GLPPriceOracleV1: invalid token',
      );
      await expectThrow(
        glpPriceOracle.getPrice(ADDRESSES.TEST_UNISWAP),
        'GLPPriceOracleV1: invalid token',
      );
      await expectThrow(
        glpPriceOracle.getPrice(await glpPriceOracle.GLP()),
        'GLPPriceOracleV1: invalid token',
      );
    });
  });
});
