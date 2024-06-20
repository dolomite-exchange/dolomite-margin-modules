import { expect } from 'chai';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupNativeUSDCBalance, setupTestMarket, setupWETHBalance } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  GammaIsolationModeTokenVaultV1,
  GammaIsolationModeVaultFactory,
  GammaPoolPriceOracle,
  GammaRegistry,
  IDeltaSwapPair,
  IDeltaSwapPair__factory
} from '../src/types';
import {
  createGammaIsolationModeTokenVaultV1,
  createGammaIsolationModeVaultFactory,
  createGammaPoolPriceOracle,
  createGammaRegistry
} from './gamma-ecosystem-utils';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

describe('GammaPoolPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let gammaRegistry: GammaRegistry;
  let gammaFactory: GammaIsolationModeVaultFactory;
  let gammaOracle: GammaPoolPriceOracle;
  let deltaPair: IDeltaSwapPair;
  let vaultImplementation: GammaIsolationModeTokenVaultV1;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 213_888_292,
      network: Network.ArbitrumOne,
    });

    gammaRegistry = await createGammaRegistry(core);

    vaultImplementation = await createGammaIsolationModeTokenVaultV1();
    gammaFactory = await createGammaIsolationModeVaultFactory(
      gammaRegistry,
      core.gammaEcosystem.gammaPools.wethUsdc,
      vaultImplementation,
      core
    );
    deltaPair = IDeltaSwapPair__factory.connect(await core.gammaEcosystem.gammaPools.wethUsdc.cfmm(), core.hhUser1);
    console.log(deltaPair.address)
    console.log(await deltaPair.token0());
    console.log(await deltaPair.token1());

    gammaOracle = await createGammaPoolPriceOracle(core, gammaRegistry);
    await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, true);
    await setupTestMarket(core, gammaFactory, true, gammaOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should work normally', async () => {
      expect(await gammaOracle.REGISTRY()).to.equal(gammaRegistry.address);
    });
  });

  describe('#ownerSetGammaPool', () => {
    it('should work normally', async () => {
      await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, false);
      expect(await gammaOracle.gammaPools(gammaFactory.address)).to.be.false;
      await gammaOracle.connect(core.governance).ownerSetGammaPool(gammaFactory.address, true);
      expect(await gammaOracle.gammaPools(gammaFactory.address)).to.be.true;
    });

    it('should revert if not called by governance', async () => {
      await expectThrow(
        gammaOracle.connect(core.hhUser1).ownerSetGammaPool(OTHER_ADDRESS, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      expect((await gammaOracle.getPrice(gammaFactory.address)).value).to.equal(
        await getDeltaPairLPPriceNoFee(core, deltaPair, false)
      );
    });

    it('should work normally when fees are on', async () => {
      expect((await gammaOracle.getPrice(gammaFactory.address)).value).to.equal(
        await getDeltaPairLPPriceNoFee(core, deltaPair, false)
      );

      // Set feeSetter and check price is same
      const feeSetter = await impersonate(await core.gammaEcosystem.deltaSwapFactory.feeToSetter(), true);
      await core.gammaEcosystem.deltaSwapFactory.connect(feeSetter).setFeeTo(core.hhUser1.address);
      expect((await gammaOracle.getPrice(gammaFactory.address)).value).to.equal(
        await getDeltaPairLPPriceNoFee(core, deltaPair, false)
      );

      // Accrue fees for pool and check oracle price
      const usdcAmount = BigNumber.from('1000000000'); // $1000
      const wethAmount = parseEther('.25');

      await setupNativeUSDCBalance(core, core.hhUser1, usdcAmount.mul(3), deltaPair);
      await setupWETHBalance(core, core.hhUser1, wethAmount.mul(2), deltaPair);

      await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(deltaPair.address, usdcAmount);
      await core.tokens.weth.connect(core.hhUser1).transfer(deltaPair.address, wethAmount);
      await deltaPair.connect(core.hhUser1).mint(core.hhUser1.address);

      await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(deltaPair.address, usdcAmount);
      await deltaPair.connect(core.hhUser1).swap(parseEther('.2'), 0, core.hhUser1.address, '0x');
      expect((await gammaOracle.getPrice(gammaFactory.address)).value).to.equal(
        await getDeltaPairLPPriceNoFee(core, deltaPair, true)
      );

      // Mint again so kLast == k, and no fees are removed from price
      await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(deltaPair.address, usdcAmount);
      await core.tokens.weth.connect(core.hhUser1).transfer(deltaPair.address, wethAmount);
      await deltaPair.connect(core.hhUser1).mint(core.hhUser1.address);
      expect((await gammaOracle.getPrice(gammaFactory.address)).value).to.equal(
        await getDeltaPairLPPriceNoFee(core, deltaPair, false)
      );
    });
  });
});

async function getDeltaPairLPPriceNoFee(
  core: CoreProtocolArbitrumOne,
  deltaPair: IDeltaSwapPair,
  feeOn: boolean
): Promise<BigNumber> {
  const reserves = await deltaPair.getReserves();
  let supply = await deltaPair.totalSupply();
  if (feeOn) {
    const feeNum = await core.gammaEcosystem.deltaSwapFactory.feeNum();
    const rootKLast = sqrt(await deltaPair.kLast());
    const rootK = sqrt(reserves[0].mul(reserves[1]));
    if (rootK.gt(rootKLast)) {
      const numerator = supply.mul(rootK.sub(rootKLast));
      const denominator = rootK.mul(feeNum).div(1000).add(rootKLast);
      const liquidity = numerator.div(denominator);
      supply = supply.add(liquidity);
    }
  }

  const price0 = (await core.oracleAggregatorV2.getPrice(await deltaPair.token0())).value;
  const price1 = (await core.oracleAggregatorV2.getPrice(await deltaPair.token1())).value;
  const value0 = reserves[0].mul(price0).div(ONE_ETH_BI);
  const value1 = reserves[1].mul(price1).div(ONE_ETH_BI);
  return sqrt(value0.mul(value1)).mul(ONE_ETH_BI).mul(2).div(supply);
}

const ONE = BigNumber.from(1);
const TWO = BigNumber.from(2);

function sqrt(value: BigNumber): BigNumber {
  let z = value.add(ONE).div(TWO);
  let y = value;
  while (z.sub(y).isNegative()) {
    y = z;
    z = value.div(z).add(z).div(TWO);
  }
  return y;
}
