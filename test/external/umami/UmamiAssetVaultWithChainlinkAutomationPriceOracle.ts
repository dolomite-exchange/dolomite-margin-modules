import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC20,
  IUmamiAssetVault,
  IWETH,
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultRegistry,
  UmamiAssetVaultWithChainlinkAutomationPriceOracle,
} from '../../../src/types';
import { createTestVaultToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { getBlockTimestamp, impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultRegistry,
  createUmamiAssetVaultWithChainlinkPriceOracle,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import { ethers } from 'hardhat';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { CHAINLINK_REGISTRY_MAP } from 'src/utils/constants';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';

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

describe('UmamiAssetVaultWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let userVaultImplementation: UmamiAssetVaultIsolationModeTokenVaultV1;
  let umamiAssetVaultWithChainlinkPriceOracles: UmamiAssetVaultWithChainlinkAutomationPriceOracle[];
  let factories: UmamiAssetVaultIsolationModeVaultFactory[];
  let marketIds: BigNumberish[];
  let deploymentTimestamps: BigNumberish[];
  let underlyingAssets: (IERC20 | IWETH)[];
  let umamiAssets: IUmamiAssetVault[];
  let chainlinkRegistry: SignerWithAddress;
  let zeroAddress: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_MAP[Network.ArbitrumOne]!, true);
    zeroAddress = await impersonate(ZERO_ADDRESS);

    deploymentTimestamps = [];
    umamiAssetVaultWithChainlinkPriceOracles = [];

    const umamiEcosystem = core.umamiEcosystem!;
    umamiAssets = [umamiEcosystem.glpLink, umamiEcosystem.glpUsdc, umamiEcosystem.glpWbtc, umamiEcosystem.glpWeth];
    underlyingAssets = [core.tokens.link, core.tokens.usdc, core.tokens.wbtc, core.tokens.weth];

    factories = await Promise.all(
      umamiAssets.map((asset) =>
        createUmamiAssetVaultIsolationModeVaultFactory(core, umamiRegistry, asset, userVaultImplementation)
      )
    );

    for (let i = 0; i < factories.length; i++) {
      umamiAssetVaultWithChainlinkPriceOracles[i] = await createUmamiAssetVaultWithChainlinkPriceOracle(
        core,
        umamiRegistry,
        factories[i]
      );
      deploymentTimestamps[i] = await getBlockTimestamp(await ethers.provider.getBlockNumber());
    }

    const firstMarketId = await core.dolomiteMargin.getNumMarkets();
    marketIds = Array.from({ length: umamiAssets.length }, (_, i) => firstMarketId.add(i));

    for (let i = 0; i < factories.length; i++) {
      await setupTestMarket(core, factories[i], true, umamiAssetVaultWithChainlinkPriceOracles[i]);
    }

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#UMAMI_ASSET_VAULT_REGISTRY', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].UMAMI_ASSET_VAULT_REGISTRY()).to.eq(
          umamiRegistry.address
        );
      }
    });
  });

  describe('#ISOLATION_MODE_TOKEN', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].ISOLATION_MODE_TOKEN()).to.eq(factories[i].address);
      }
    });
  });

  describe('#UNDERLYING_MARKET_ID', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].UNDERLYING_MARKET_ID()).to.eq(
          await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingAssets[i].address)
        );
      }
    });
  });

  describe('#lastUpdateTimestamp', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].lastUpdateTimestamp()).to.eq(deploymentTimestamps[i]);
      }
    });
  });

  describe('#exchangeRateNumerator', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssets.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].exchangeRateNumerator()).to.eq(
          await umamiAssets[i].totalAssets()
        );
      }
    });
  });

  describe('#exchangeRateDenominator', () => {
    it('returns the correct value', async () => {
      for (let i = 0; i < umamiAssets.length; i++) {
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].exchangeRateDenominator()).to.eq(
          await umamiAssets[i].totalSupply()
        );
      }
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for all assets', async () => {
      for (let i = 0; i < factories.length; i++) {
        const price = await umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(factories[i].address);
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
          testToken as any as IUmamiAssetVault,
          userVaultImplementation
        );
        const umamiAssetVaultPriceOracle = await createUmamiAssetVaultWithChainlinkPriceOracle(
          core,
          umamiRegistry,
          newFactory
        );
        await setupTestMarket(core, newFactory, true, umamiAssetVaultPriceOracle);
        const price = await umamiAssetVaultPriceOracle.getPrice(newFactory.address);
        const withdrawalFee = prices[i].mul(75).div(10000); // withdrawal fee is 75 bps
        expect(price.value).to.eq(prices[i].sub(withdrawalFee));
      }
    });

    it('fails when token sent is not the valid Umami Asset', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(ADDRESSES.ZERO),
          `UmamiAssetWithChainlinkOracle: Invalid token <${ADDRESSES.ZERO}>`
        );
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(core.gmxEcosystem!.fsGlp.address),
          `UmamiAssetWithChainlinkOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`
        );
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(core.tokens.dfsGlp!.address),
          `UmamiAssetWithChainlinkOracle: Invalid token <${core.tokens.dfsGlp!.address.toLowerCase()}>`
        );
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(core.gmxEcosystem!.glp.address),
          `UmamiAssetWithChainlinkOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`
        );
      }
    });

    it('fails when assets are borrowable', async () => {
      for (let i = 0; i < marketIds.length; i++) {
        await core.dolomiteMargin.ownerSetIsClosing(marketIds[i], false);
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(factories[i].address),
          'UmamiAssetWithChainlinkOracle: Umami Asset cannot be borrowable'
        );
      }
    });

    it('fails when price has expired', async () => {
      await increase(30 * 3600);
      for (let i = 0; i < marketIds.length; i++) {
        await expectThrow(
          umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(factories[i].address),
          'ChainlinkAutomationPriceOracle: Price is expired'
        );
      }
    });
  });

  describe('#checkUpkeep', async () => {
    it('works normally', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        expect((await umamiAssetVaultWithChainlinkPriceOracles[i].connect(zeroAddress)
            .callStatic.checkUpkeep('0x')).upkeepNeeded).to.eq(false);
      }
    });
  });

  describe('#performUpkeep', async () => {
    it('works normally', async () => {
      for (let i = 0; i < umamiAssetVaultWithChainlinkPriceOracles.length; i++) {
        await increase(7 * 24 * 3600);
        await umamiAssetVaultWithChainlinkPriceOracles[i].connect(chainlinkRegistry).performUpkeep('0x');
        const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
        expect(await umamiAssetVaultWithChainlinkPriceOracles[i].lastUpdateTimestamp()).to.eq(upkeepTimestamp);

        const underlyingPrice = (await core.dolomiteMargin.getMarketPrice(
          await core.dolomiteMargin.getMarketIdByTokenAddress(underlyingAssets[i].address)
        )).value;
        const totalAssets = await umamiAssets[i].totalAssets();
        const totalSupply = await umamiAssets[i].totalSupply();
        expect((await umamiAssetVaultWithChainlinkPriceOracles[i].getPrice(factories[i].address)).value).to.eq(
          getUmamiPrice(underlyingPrice, totalAssets, totalSupply)
        );
      }
    });
  });
});

function getUmamiPrice(underlyingPrice: BigNumber, totalAssets: BigNumber, totalSupply: BigNumber): BigNumber {
  const price = underlyingPrice.mul(totalAssets).div(totalSupply);
  const withdrawalFee = price.mul(75).div(10000); // withdrawal fee is 75 bps
  return price.sub(withdrawalFee);
}
