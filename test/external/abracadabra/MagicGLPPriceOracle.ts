import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { MagicGLPPriceOracle, MagicGLPPriceOracle__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const GLP_PRICE = BigNumber.from('913711474561791281'); // $0.913711

describe('MagicGLPPriceOracle', () => {
  let snapshotId: string;

  let magicGlpPriceOracle: MagicGLPPriceOracle;
  let core: CoreProtocol;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 81874000,
      network: Network.ArbitrumOne,
    });
    magicGlpPriceOracle = await createContractWithAbi<MagicGLPPriceOracle>(
      MagicGLPPriceOracle__factory.abi,
      MagicGLPPriceOracle__factory.bytecode,
      [core.dolomiteMargin.address, core.abraEcosystem!.magicGlp, core.marketIds.dfsGlp!],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#DOLOMITE_MARGIN', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#MAGIC_GLP', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracle.MAGIC_GLP()).to.eq(core.abraEcosystem!.magicGlp);
    });
  });

  describe('#MAGIC_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracle.MAGIC_GLP_MARKET_ID()).to.eq(core.marketIds.magicGlp!);
    });
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp!);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under the correct conditions for magicGLP', async () => {
      const price = await magicGlpPriceOracle.getPrice(core.abraEcosystem!.magicGlp.address);
      expect(price.value).to.eq(GLP_PRICE);
      // TODO check exchange rate and calculate it against the GLP price
    });

    it('fails when token sent is not magicGLP', async () => {
      await expectThrow(
        magicGlpPriceOracle.getPrice(ADDRESSES.ZERO),
        `MagicGLPPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        magicGlpPriceOracle.getPrice(ADDRESSES.TEST_UNISWAP),
        `MagicGLPPriceOracle: invalid token <${ADDRESSES.TEST_UNISWAP.toLowerCase()}>`,
      );
      await expectThrow(
        magicGlpPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `MagicGLPPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when magicGLP is borrowable', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.abraEcosystem!.magicGlp.address, false);
      await expectThrow(
        magicGlpPriceOracle.getPrice(core.abraEcosystem!.magicGlp.address),
        'MagicGLPPriceOracle: magicGLP cannot be borrowable',
      );
    });
  });
});
