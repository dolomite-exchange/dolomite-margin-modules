import { BigNumber, BigNumberish } from 'ethers';
import {
  CoreProtocol,
  setupCoreProtocol,
  setupUSDCBalance
} from '../../utils/setup';
import {
  IERC4626,
  IJonesWhitelistController,
  IJonesWhitelistController__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCWithChainlinkAutomationPriceOracle,
  JonesUSDCRegistry,
  JonesUSDCRegistry__factory,
  JonesUSDCWithChainlinkAutomationPriceOracle__factory,
  CustomTestVaultToken
} from '../../../src/types';
import deployments from '../../../scripts/deployments.json';
import { Network } from '../../../src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot
} from '../../utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createContractWithAbi, createTestVaultToken } from '../../../src/utils/dolomite-utils';
import { createJonesUSDCWithChainlinkAutomationPriceOracle } from '../../utils/ecosystem-token-utils/jones';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expectThrow } from '../../utils/assertions';
import { ADDRESSES } from '@dolomite-margin/dist/src';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { CHAINLINK_REGISTRY_MAP } from '../../../src/utils/constants';

const USDC_PRICE = BigNumber.from('999986050000000000000000000000'); // $0.99998605
const USDC_SCALE_DIFF = BigNumber.from('10').pow(12);

describe('JonesUSDCWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let jonesController: IJonesWhitelistController;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let jonesUSDCWithChainlinkAutomationPriceOracle: JonesUSDCWithChainlinkAutomationPriceOracle;
  let jUSDC: IERC4626;
  let jUSDCNoSupply: CustomTestVaultToken;
  let chainlinkRegistry: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;
  let retentionFee: BigNumber;
  let retentionFeeBase: BigNumber;
  let zeroAddress: SignerWithAddress;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({ blockNumber, network });
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_MAP[network], true);
    zeroAddress = await impersonate(ZERO_ADDRESS);

    jonesUSDCRegistry = JonesUSDCRegistry__factory.connect(
      deployments.JonesUSDCRegistryProxy[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    factory = JonesUSDCIsolationModeVaultFactory__factory.connect(
      deployments.JonesUSDCIsolationModeVaultFactory[Network.ArbitrumOne].address,
      core.hhUser1
    );

    jonesController = IJonesWhitelistController__factory.connect(
      await jonesUSDCRegistry.whitelistController(),
      core.hhUser1
    );
    const role = await jonesController.getUserRole(await jonesUSDCRegistry.unwrapperTraderForLiquidation());
    retentionFee = (await jonesController.getRoleInfo(role)).jUSDC_RETENTION;
    retentionFeeBase = await jonesController.BASIS_POINTS();

    jUSDC = core.jonesEcosystem!.jUSDC;
    jUSDCNoSupply = await createTestVaultToken(core.tokens.usdc!);
    await setupUSDCBalance(core, core.hhUser1, 1000e6, core.dolomiteMargin);
    await core.tokens.usdc!.connect(core.hhUser1).transfer(jUSDCNoSupply.address, 100e6);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, USDC_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc!, core.testEcosystem!.testPriceOracle.address);

    jonesUSDCWithChainlinkAutomationPriceOracle = await createJonesUSDCWithChainlinkAutomationPriceOracle(
      core,
      chainlinkRegistry.address,
      jonesUSDCRegistry,
      factory,
    );
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#JONES_USDC_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.JONES_USDC_REGISTRY()).to.eq(jonesUSDCRegistry.address);
    });
  });

  describe('#USDC_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.USDC_MARKET_ID()).to.eq(core.marketIds.usdc);
    });
  });

  describe('#DJUSDC', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.DJUSDC()).to.eq(factory.address);
    });
  });

  describe('#lastUpdateTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.lastUpdateTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#exchangeRateNumerator', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.exchangeRateNumerator())
        .to.eq(await jUSDC.totalAssets());
    });
  });

  describe('#exchangeRateDenominator', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.exchangeRateDenominator())
        .to.eq(await jUSDC.totalSupply());
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value', async () => {
      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();

      const price = getjUSDCPrice(USDC_PRICE, totalAssets, totalSupply);
      expect((await jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address)).value).to.eq(price);
    });

    it('returns the correct value when jUSDC total supply is 0', async () => {
      await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDC(jUSDCNoSupply.address);
      expect(await jUSDCNoSupply.totalSupply()).to.eq(0);

      const jonesUSDCWithChainlinkAutomationPriceOracleNoSupply =
        await createContractWithAbi<JonesUSDCWithChainlinkAutomationPriceOracle>(
          JonesUSDCWithChainlinkAutomationPriceOracle__factory.abi,
          JonesUSDCWithChainlinkAutomationPriceOracle__factory.bytecode,
          [
            core.dolomiteMargin.address,
            chainlinkRegistry.address,
            jonesUSDCRegistry.address,
            core.marketIds.usdc,
            factory.address
          ],
        );
      const price = getjUSDCPrice(USDC_PRICE, BigNumber.from('0'), BigNumber.from('0'));
      expect((await jonesUSDCWithChainlinkAutomationPriceOracleNoSupply.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('fails when token sent is not djUSDC', async () => {
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(ADDRESSES.ZERO),
        `jUSDCWithChainlinkPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `jUSDCWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(core.tokens.dfsGlp!.address),
        `jUSDCWithChainlinkPriceOracle: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `jUSDCWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when jUSDC is not borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.djUSDC!, false);
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address),
        'jUSDCWithChainlinkPriceOracle: jUSDC cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address);

      await increase(3600);
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address),
        'ChainlinkAutomationPriceOracle: Price is expired',
      );
    });
  });

  describe('#checkUpkeep', async () => {
    it('works normally', async () => {
      expect((await jonesUSDCWithChainlinkAutomationPriceOracle.connect(zeroAddress).callStatic
        .checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });
  });

  describe('#performUpkeep', async () => {
    it('works normally', async () => {
      await increase(11 * 3600);
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x'),
        'ChainlinkAutomationPriceOracle: checkUpkeep conditions not met'
      );

      await increase(3600);
      await jonesUSDCWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.lastUpdateTimestamp()).to.eq(upkeepTimestamp);

      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();
      const price = getjUSDCPrice(USDC_PRICE, totalAssets, totalSupply);
      expect((await jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address)).value)
        .to.eq(price);
    });
  });

  function getjUSDCPrice(usdcPrice: BigNumber, totalAssets: BigNumber, totalSupply: BigNumber): BigNumber {
    if (totalSupply.eq(0)) {
      const scaledPrice = usdcPrice.div(USDC_SCALE_DIFF);
      return scaledPrice.sub(scaledPrice.mul(retentionFee).div(retentionFeeBase));
    }

    const price = usdcPrice.div(USDC_SCALE_DIFF).mul(totalAssets).div(totalSupply);
    return price.sub(price.mul(retentionFee).div(retentionFeeBase));
  }
});
