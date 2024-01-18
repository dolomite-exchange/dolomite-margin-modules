import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CustomTestToken, IERC4626, MagicGLPPriceOracle, MagicGLPPriceOracle__factory } from '../../../src/types';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { createMagicGLPPriceOracle } from '../../utils/ecosystem-token-utils/abracadabra';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

const GLP_PRICE = BigNumber.from('1004371801993868870'); // $1.004371801993868870

describe('MagicGLPPriceOracle', () => {
  let snapshotId: string;

  let magicGlpPriceOracle: MagicGLPPriceOracle;
  let magicGlpPriceOracleWithNoTotalSupply: MagicGLPPriceOracle;
  let magicGlp: IERC4626;
  let magicGlpWithNoTotalSupply: CustomTestToken;
  let core: CoreProtocol;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    magicGlp = core.abraEcosystem!.magicGlp;
    magicGlpWithNoTotalSupply = await createTestToken();

    magicGlpPriceOracle = await createMagicGLPPriceOracle(core);
    magicGlpPriceOracleWithNoTotalSupply = await createContractWithAbi<MagicGLPPriceOracle>(
      MagicGLPPriceOracle__factory.abi,
      MagicGLPPriceOracle__factory.bytecode,
      [core.dolomiteMargin.address, magicGlpWithNoTotalSupply.address, core.marketIds.dfsGlp!],
    );

    await setupTestMarket(core, magicGlpWithNoTotalSupply, true, magicGlpPriceOracleWithNoTotalSupply);

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
      expect(await magicGlpPriceOracle.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp!);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for magicGLP', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);

      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();
      expect((await magicGlpPriceOracle.getPrice(magicGlp.address)).value)
        .to
        .eq(glpPrice.value.mul(balance).div(totalSupply));
    });

    it('returns the correct value when magicGLP total supply is 0', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);
      const totalSupply = await magicGlpWithNoTotalSupply.totalSupply();
      expect(totalSupply).to.eq(0);
      expect((await magicGlpPriceOracleWithNoTotalSupply.getPrice(magicGlpWithNoTotalSupply.address)).value)
        .to
        .eq(glpPrice.value);
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
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.marketIds.magicGlp!, false);
      await expectThrow(
        magicGlpPriceOracle.getPrice(magicGlp.address),
        'MagicGLPPriceOracle: magicGLP cannot be borrowable',
      );
    });
  });
});
