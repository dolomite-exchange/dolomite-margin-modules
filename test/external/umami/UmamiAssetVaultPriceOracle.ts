import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC20,
  IUmamiAssetVault,
  IWETH,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { createTestVaultToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

const LINK_PRICE = BigNumber.from('6615143750000000000'); // $6.61514375
const USDC_PRICE = BigNumber.from('1000000000000000000000000000000'); // $1.00
const WBTC_PRICE = BigNumber.from('310005100000000000000000000000000'); // $31,000.51
const WETH_PRICE = BigNumber.from('1964129009030000000000'); // $1964.12900903
const prices = [LINK_PRICE, USDC_PRICE, WBTC_PRICE, WETH_PRICE];

const UMAMI_LINK_PRICE = BigNumber.from('6627676807866578059');
const UMAMI_USDC_PRICE = BigNumber.from('1013685904999300592616624183877'); // $1.0131...
const UMAMI_WBTC_PRICE = BigNumber.from('315162914422051769717547981804418');
const UMAMI_WETH_PRICE = BigNumber.from('1990936356560813328593');
const umamiPrices = [UMAMI_LINK_PRICE, UMAMI_USDC_PRICE, UMAMI_WBTC_PRICE, UMAMI_WETH_PRICE];

describe('UmamiAssetVaultPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
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
      umamiAssets.map((asset, i) =>
        createUmamiAssetVaultIsolationModeVaultFactory(
          core,
          umamiRegistry,
          asset,
          underlyingAssets[i],
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
        )
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
        await core.testPriceOracle!.setPrice(testToken.address, prices[i]);
        await setupTestMarket(core, testToken, false, core.testPriceOracle);
        const newFactory = await createUmamiAssetVaultIsolationModeVaultFactory(
          core,
          umamiRegistry,
          testToken,
          underlyingAssets[i],
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
