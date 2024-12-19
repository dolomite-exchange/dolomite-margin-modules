import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ZERO_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupUSDCBalance,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CoreProtocolArbitrumOne } from '../../base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GmxRegistryV1,
  TestGLPManager,
  TestGLPManager__factory,
  TestGLPMathLib,
  TestGLPMathLib__factory,
} from '../src/types';
import { createGmxRegistry } from './glp-ecosystem-utils';

const amountWei = BigNumber.from('200000000000000000000'); // $200
const usdcAmount = BigNumber.from('10000000'); // $10
const glpAmount = BigNumber.from('5000000000000000000'); // 5 GLP

describe('GLPMathLib', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let lib: TestGLPMathLib;
  let registry: GmxRegistryV1;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    registry = await createGmxRegistry(core);
    lib = await createContractWithAbi(
      TestGLPMathLib__factory.abi,
      TestGLPMathLib__factory.bytecode,
      [registry.address],
    );

    const usdcBigAmount = amountWei.div(1e12).mul(4);
    await setupUSDCBalance(core, core.hhUser1, usdcBigAmount, core.gmxEcosystem.glpManager);
    await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
      .mintAndStakeGlp(core.tokens.usdc.address, usdcAmount, 0, 0);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getUsdgAmountForBuy && #getGlpMintAmount', () => {
    it('should work when AUM is greater than 0', async () => {
      for (let i = 0; i < 10; i++) {
        // generate a random number between 1 and 99
        const random = Math.floor(Math.random() * 99) + 1;
        const weirdAmountUsdc = usdcAmount.mul(random).div(101);
        const usdgAmount = await lib.GLPMathLibGetUsdgAmountForBuy(core.tokens.usdc.address, weirdAmountUsdc);

        const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .mintAndStakeGlp(core.tokens.usdc.address, weirdAmountUsdc, 0, 0);
        expect(await lib.GLPMathLibGetGlpMintAmount(usdgAmount)).to.eq(expectedAmount);
      }
    });

    it('should work when AUM is 0', async () => {
      const testGLPManager = await createContractWithAbi<TestGLPManager>(
        TestGLPManager__factory.abi,
        TestGLPManager__factory.bytecode,
        [],
      );
      await registry.connect(core.governance).ownerSetGlpManager(testGLPManager.address);
      await testGLPManager.setAumInUsdg(0);

      for (let i = 0; i < 10; i++) {
        const random = Math.floor(Math.random() * 99) + 1;
        const weirdAmountUsdg = usdcAmount.mul(random).div(101);
        expect(await lib.GLPMathLibGetGlpMintAmount(weirdAmountUsdg)).to.eq(weirdAmountUsdg);
      }
    });

    it('should work when total supply is 0', async () => {
      const glp = await createTestToken();
      await registry.connect(core.governance).ownerSetGlp(glp.address);

      expect(await glp.totalSupply()).to.eq(ZERO_BI);

      for (let i = 0; i < 10; i++) {
        const random = Math.floor(Math.random() * 99) + 1;
        const weirdAmountUsdg = usdcAmount.mul(random).div(101);
        expect(await lib.GLPMathLibGetGlpMintAmount(weirdAmountUsdg)).to.eq(weirdAmountUsdg);
      }
    });

    it('should fail when input amount is 0', async () => {
      await expectThrow(
        lib.GLPMathLibGetUsdgAmountForBuy(core.tokens.usdc.address, ZERO_BI),
        'GLPMathLib: Input amount must be gt than 0',
      );
    });
  });

  describe('#getUsdgAmountForSell && #getGlpRedemptionAmount', () => {
    it('should work when AUM is greater than 0', async () => {
      for (let i = 0; i < 10; i++) {
        // generate a random number between 1 and 99
        const random = Math.floor(Math.random() * 99) + 1;
        const weirdAmountGlp = glpAmount.mul(random).div(101);
        const usdgAmount = await lib.GLPMathLibGetUsdgAmountForSell(weirdAmountGlp);

        const expectedAmount = await core.gmxEcosystem.glpRewardsRouter.connect(core.hhUser1)
          .callStatic
          .unstakeAndRedeemGlp(core.tokens.usdc.address, weirdAmountGlp, 0, core.hhUser1.address);
        expect(await lib.GLPMathLibGetGlpRedemptionAmount(core.tokens.usdc.address, usdgAmount)).to.eq(expectedAmount);
      }
    });
  });

  describe('#basisPointsDivisor', () => {
    it('should apply fees to an amount', async () => {
      expect(await lib.GLPMathLibBasisPointsDivisor()).to.eq(10000);
    });
  });

  describe('#pricePrecision', () => {
    it('should apply fees to an amount', async () => {
      expect(await lib.GLPMathLibPricePrecision()).to.eq('1000000000000000000000000000000');
    });
  });

  describe('#applyFeesToAmount', () => {
    it('should apply fees to an amount', async () => {
      const amount = 1000;
      const fee = 10;
      const expected = 999;

      expect(await lib.GLPMathLibApplyFeesToAmount(amount, fee)).to.eq(expected);
    });
  });
});
