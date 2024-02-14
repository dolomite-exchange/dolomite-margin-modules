import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { GLPPriceOracleV1, GmxRegistryV1 } from '../src/types';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  createGLPIsolationModeTokenVaultV1,
  createGLPIsolationModeVaultFactory,
  createGLPPriceOracleV1,
  createGmxRegistry,
} from './glp-ecosystem-utils';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';

const GLP_PRICE = BigNumber.from('1157958974643177588'); // $1.157958974643177588

describe('GLPPriceOracleV1', () => {
  let snapshotId: string;

  let glpPriceOracle: GLPPriceOracleV1;
  let gmxRegistry: GmxRegistryV1;

  before(async () => {
    const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    gmxRegistry = await createGmxRegistry(core);
    const userVaultImplementation = await createGLPIsolationModeTokenVaultV1();
    const factory = await createGLPIsolationModeVaultFactory(core, gmxRegistry, userVaultImplementation);
    glpPriceOracle = await createGLPPriceOracleV1(factory, gmxRegistry);

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
