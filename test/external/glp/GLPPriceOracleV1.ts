import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { GLPPriceOracleV1, GLPPriceOracleV1__factory, GmxRegistryV1 } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { setupCoreProtocol } from '../../utils/setup';
import { createGmxRegistry } from '../../utils/wrapped-token-utils';

const GLP_PRICE = BigNumber.from('913711474561791281'); // $0.913711

describe('GLPPriceOracleV1', () => {
  let snapshotId: string;

  let glpPriceOracle: GLPPriceOracleV1;
  let gmxRegistry: GmxRegistryV1;

  before(async () => {
    const core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    gmxRegistry = await createGmxRegistry(core);
    glpPriceOracle = await createContractWithAbi<GLPPriceOracleV1>(
      GLPPriceOracleV1__factory.abi,
      GLPPriceOracleV1__factory.bytecode,
      [gmxRegistry.address, core.gmxEcosystem!.fsGlp.address], // technically should be DFS_GLP
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under the correct conditions for dsGLP', async () => {
      const dfsGlp = await glpPriceOracle.DFS_GLP();
      const price = await glpPriceOracle.getPrice(dfsGlp);
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
        glpPriceOracle.getPrice(await gmxRegistry.glp()),
        'GLPPriceOracleV1: invalid token',
      );
    });
  });
});
