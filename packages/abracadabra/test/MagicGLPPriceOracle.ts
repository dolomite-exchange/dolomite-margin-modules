import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { MagicGLPPriceOracle, MagicGLPPriceOracle__factory } from '../src/types';
import { CustomTestToken, IERC4626 } from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createMagicGLPPriceOracle } from './abracadabra-ecosystem-utils';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket
} from '@dolomite-exchange/modules-base/test/utils/setup';

const GLP_PRICE = BigNumber.from('1157958974643177588'); // $1.157958974643177588

describe('MagicGLPPriceOracle', () => {
  let snapshotId: string;

  let magicGlpPriceOracle: MagicGLPPriceOracle;
  let magicGlpPriceOracleWithNoTotalSupply: MagicGLPPriceOracle;
  let magicGlp: IERC4626;
  let magicGlpWithNoTotalSupply: CustomTestToken;
  let core: CoreProtocolArbitrumOne;

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
