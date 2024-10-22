import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { IERC20, IWETH } from '@dolomite-exchange/modules-base/src/types';
import { createTestVaultToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  IUmamiAssetVault,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../src/types';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from './umami-ecosystem-utils';

const LINK_PRICE = BigNumber.from('8016000000000000000'); // $8.016000000000000000
const USDC_PRICE = BigNumber.from('999937000000000000000000000000'); // $0.999937000000000000000000000000
const WBTC_PRICE = BigNumber.from('299800328339800000000000000000000'); // $29,980.0328339800000000000000000000
const WETH_PRICE = BigNumber.from('1883923360000000000000'); // $1,883.923360000000000000
const prices = [LINK_PRICE, USDC_PRICE, WBTC_PRICE, WETH_PRICE];

const UMAMI_LINK_PRICE = BigNumber.from('8048853434815944130'); // $8.048853434815944130
const UMAMI_USDC_PRICE = BigNumber.from('1019414900314579339431231208430'); // $1.019414900314579339431231208430
const UMAMI_WBTC_PRICE = BigNumber.from('307139022998118107170717850904972'); // $30,713.9022998118107170717850904972
const UMAMI_WETH_PRICE = BigNumber.from('1925872651061968202362'); // $1,925.872651061968202362
const umamiPrices = [UMAMI_LINK_PRICE, UMAMI_USDC_PRICE, UMAMI_WBTC_PRICE, UMAMI_WETH_PRICE];

describe('UmamiAssetVaultPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let userVaultImplementation: UmamiAssetVaultIsolationModeTokenVaultV1;
  let umamiAssetVaultPriceOracles: UmamiAssetVaultPriceOracle[];
  let factories: UmamiAssetVaultIsolationModeVaultFactory[];
  let marketIds: BigNumberish[];
  let underlyingAssets: (IERC20 | IWETH)[];
  let umamiAssets: IUmamiAssetVault[];

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();

    const umamiEcosystem = core.umamiEcosystem!;
    umamiAssets = [umamiEcosystem.glpLink, umamiEcosystem.glpUsdc, umamiEcosystem.glpWbtc, umamiEcosystem.glpWeth];
    underlyingAssets = [core.tokens.link, core.tokens.usdc, core.tokens.wbtc, core.tokens.weth];

    factories = await Promise.all(
      umamiAssets.map(asset =>
        createUmamiAssetVaultIsolationModeVaultFactory(
          core,
          umamiRegistry,
          asset,
          userVaultImplementation,
        ),
      ),
    );
    umamiAssetVaultPriceOracles = await Promise.all(
      factories.map((factory) =>
        createUmamiAssetVaultPriceOracle(
          core,
          umamiRegistry,
          factory,
        ),
      ),
    );

    const firstMarketId = await core.dolomiteMargin.getNumMarkets();
    marketIds = Array.from({ length: umamiAssets.length }, (_, i) => firstMarketId.add(i));

    for (let i = 0; i < factories.length; i++) {
      await setupTestMarket(core, factories[i], true, umamiAssetVaultPriceOracles[i]);
    }

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for all assets', async () => {
      for (let i = 0; i < factories.length; i++) {
        const price = await umamiAssetVaultPriceOracles[i].getPrice(factories[i].address);
        expect(price.value).to.eq(umamiPrices[i], `Incorrect price for ${await umamiAssets[i].symbol()}`);
      }
    });

    it('returns the correct value when total supply is 0', async () => {
      for (let i = 0; i < underlyingAssets.length; i++) {
        const testToken = await createTestVaultToken(underlyingAssets[i]);
        await core.testEcosystem!.testPriceOracle.setPrice(testToken.address, prices[i]);
        await setupTestMarket(core, testToken, false, core.testEcosystem!.testPriceOracle);
        const newFactory = await createUmamiAssetVaultIsolationModeVaultFactory(
          core,
          umamiRegistry,
          (testToken as any) as IUmamiAssetVault,
          userVaultImplementation,
        );
        const umamiAssetVaultPriceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, newFactory);
        await setupTestMarket(core, newFactory, true, umamiAssetVaultPriceOracle);
        const price = await umamiAssetVaultPriceOracle.getPrice(newFactory.address);
        const withdrawalFee = prices[i].mul(75).div(10000); // withdrawal fee is 75 bps
        expect(price.value).to.eq(prices[i].sub(withdrawalFee));
      }
    });

    it('fails when token sent is not the valid Umami Asset', async () => {
      for (let i = 0; i < umamiAssetVaultPriceOracles.length; i++) {
        await expectThrow(
          umamiAssetVaultPriceOracles[i].getPrice(ADDRESSES.ZERO),
          `UmamiAssetVaultPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
        );
        await expectThrow(
          umamiAssetVaultPriceOracles[i].getPrice(core.gmxEcosystem!.fsGlp.address),
          `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
        );
        await expectThrow(
          umamiAssetVaultPriceOracles[i].getPrice(core.tokens.dfsGlp!.address),
          `UmamiAssetVaultPriceOracle: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
        );
        await expectThrow(
          umamiAssetVaultPriceOracles[i].getPrice(core.gmxEcosystem!.glp.address),
          `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
        );
      }
    });

    it('fails when assets are borrowable', async () => {
      for (let i = 0; i < marketIds.length; i++) {
        await core.dolomiteMargin.ownerSetIsClosing(marketIds[i], false);
        await expectThrow(
          umamiAssetVaultPriceOracles[i].getPrice(factories[i].address),
          'UmamiAssetVaultPriceOracle: Umami Asset cannot be borrowable',
        );
      }
    });
  });
});
