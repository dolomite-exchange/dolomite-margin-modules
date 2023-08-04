import { BigNumber, BigNumberish } from 'ethers';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../../utils/setup';
import {
  CustomTestToken,
  IERC4626, IJonesWhitelistController, IJonesWhitelistController__factory,
  JonesUSDCIsolationModeVaultFactory, JonesUSDCIsolationModeVaultFactory__factory,
  JonesUSDCPriceOracleChainlink, JonesUSDCPriceOracleChainlink__factory,
  JonesUSDCRegistry, JonesUSDCRegistry__factory
} from '../../../../src/types';
import deployments from '../../../../scripts/deployments.json';
import { Network } from '../../../../src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot
} from '../../../utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { createContractWithAbi, createTestToken } from '../../../../src/utils/dolomite-utils';
import { createJonesUSDCPriceOracleChainlink } from '../../../utils/ecosystem-token-utils/jones';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expectThrow } from '../../../utils/assertions';
import { ADDRESSES } from '@dolomite-margin/dist/src';

const USDC_PRICE = BigNumber.from('999986050000000000000000000000'); // $0.99998605
const CHAINLINK_REGISTRY_ADDRESS = '0x75c0530885F385721fddA23C539AF3701d6183D4';
const USDC_SCALE_DIFF = BigNumber.from('10').pow(12);
describe('JonesUSDCPriceOracleChainlink', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let jonesController: IJonesWhitelistController;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let jonesUSDCPriceOracleChainlink: JonesUSDCPriceOracleChainlink;
  let jonesUSDCPriceOracleChainlinkWithNoTotalSupply: JonesUSDCPriceOracleChainlink;
  let jUSDC: IERC4626;
  let jUSDCWithNoTotalSupply: CustomTestToken;
  let chainlinkRegistry: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;
  let retentionFee: BigNumber;
  let retentionFeeBase: BigNumber;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({ blockNumber, network });
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
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_ADDRESS, true);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, USDC_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.usdc!, core.testEcosystem!.testPriceOracle.address);

    jonesUSDCPriceOracleChainlink = await createJonesUSDCPriceOracleChainlink(
      core,
      jonesUSDCRegistry,
      factory,
      chainlinkRegistry
    );
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#DOLOMITE_MARGIN', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#JONES_USDC_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.JONES_USDC_REGISTRY()).to.eq(jonesUSDCRegistry.address);
    });
  });

  describe('#USDC_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.USDC_MARKET_ID()).to.eq(core.marketIds.usdc);
    });
  });

  describe('#DJUSDC', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.DJUSDC()).to.eq(factory.address);
    });
  });

  describe('#HEARTBEAT', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.HEARTBEAT()).to.eq(12 * 3600);
    });
  });

  describe('#CHAINLINK_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.CHAINLINK_REGISTRY()).to.eq(chainlinkRegistry.address);
    });
  });

  describe('#latestTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await jonesUSDCPriceOracleChainlink.latestTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value', async () => {
      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();

      const price = getjUSDCPrice(USDC_PRICE, totalAssets, totalSupply);
      expect((await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value).to.eq(price);
    });

    it('returns the correct value when jUSDC total supply is 0', async () => {
      const testToken = await createTestToken();
      await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDC(testToken.address);
      await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');

      const usdcPrice = USDC_PRICE.div(USDC_SCALE_DIFF);
      expect((await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(usdcPrice.sub(usdcPrice.mul(retentionFee).div(retentionFeeBase)));
    });

    it('fails when token sent is not djUSDC', async () => {
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(ADDRESSES.ZERO),
        `JonesUSDCPriceOracleChainlink: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(core.gmxEcosystem!.fsGlp.address),
        `JonesUSDCPriceOracleChainlink: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(core.tokens.dfsGlp!.address),
        `JonesUSDCPriceOracleChainlink: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(core.gmxEcosystem!.glp.address),
        `JonesUSDCPriceOracleChainlink: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when jUSDC is not borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.djUSDC!, false);
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(factory.address),
        'JonesUSDCPriceOracleChainlink: jUSDC cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await expectThrow(
        jonesUSDCPriceOracleChainlink.getPrice(factory.address),
        'JonesUSDCPriceOracleChainlink: price expired',
      );
    });
  });

  describe('#checkUpkeep', async () => {
    it('works normally', async () => {
      expect((await jonesUSDCPriceOracleChainlink.checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });

    xit('fails when called by address other than zero address', async () => {
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: static rpc calls only'
      );
    });

    it('returns false when deviation is less than 0.25% and lastTimestamp is less than heartbeat', async () => {
      expect((await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);
    });

    it('returns true when deviation is greater than .25% and lastTimestamp is less than heartbeat', async () => {
      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();

      const currentExchangeRate = (await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        retentionFee,
        retentionFeeBase
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, upper.add(BigNumber.from('100000000000000000'))); // .1 eth
      expect((await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, lower.sub(BigNumber.from('100000000000000000'))); // .1 eth
      expect((await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });

    it('returns true when deviation is less than 0.25% and lastTimestamp is more than heartbeat', async () => {
      await increase(11 * 3600);
      expect((await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);

      await increase(3600);
      expect((await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });
  });

  describe('#performUpkeep', async () => {
    it('works if greater than heartbeat period', async () => {
      await increase(11 * 3600);
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'JonesUSDCPriceOracleChainlink: checkUpkeep conditions not met'
      );

      await increase(3600);
      const NEW_USDC_PRICE = BigNumber.from('100000000000000000000000000000'); // $0.99998605
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, NEW_USDC_PRICE);

      await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await jonesUSDCPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();
      const price = getjUSDCPrice(NEW_USDC_PRICE, totalAssets, totalSupply);
      expect((await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('works if greater than deviation upperEdge', async () => {
      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();

      const currentExchangeRate = (await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        retentionFee,
        retentionFeeBase
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, upper);
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'JonesUSDCPriceOracleChainlink: checkUpkeep conditions not met',
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, upper.add(BigNumber.from('100000000000000000'))); // .1 eth
      await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await jonesUSDCPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const price = getjUSDCPrice(upper.add(BigNumber.from('100000000000000000')), totalAssets, totalSupply);
      expect((await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('works if less than deviation lowerEdge', async () => {
      const totalAssets = await jUSDC.totalAssets();
      const totalSupply = await jUSDC.totalSupply();

      const currentExchangeRate = (await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        retentionFee,
        retentionFeeBase
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, lower.add(BigNumber.from('100000000000000000')));
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'JonesUSDCPriceOracleChainlink: checkUpkeep conditions not met',
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.usdc!.address, lower.sub(BigNumber.from('100000000000000000'))); // .1 eth
      await jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await jonesUSDCPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const price = getjUSDCPrice(lower.sub(BigNumber.from('100000000000000000')), totalAssets, totalSupply);
      expect((await jonesUSDCPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('fails when not called by Chainlink', async () => {
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(core.hhUser1).performUpkeep('0x'),
        'JonesUSDCPriceOracleChainlink: caller is not Chainlink'
      );
    });

    it('fails when before heartbeat and within deviation range', async () => {
      await expectThrow(
        jonesUSDCPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'JonesUSDCPriceOracleChainlink: checkUpkeep conditions not met'
      );
    });
  });

  function getjUSDCPrice(usdcPrice: BigNumber, assets: BigNumber, totalSupply: BigNumber): BigNumber {
    const price = usdcPrice.div(USDC_SCALE_DIFF).mul(assets).div(totalSupply);
    return price.sub(price.mul(retentionFee).div(retentionFeeBase));
  }

  function calculateDeviationRange(
    exchangeRate: BigNumber,
    assets: BigNumber,
    totalSupply: BigNumber,
    retentionFee: BigNumber,
    retentionFeeBase: BigNumber
  ): BigNumber[] {
    const lowerExchangeRate = exchangeRate.mul(9975).div(10000);
    const upperExchangeRate = exchangeRate.mul(10025).div(10000);

    let lowerEdge = lowerExchangeRate.mul(retentionFeeBase).div(retentionFeeBase.sub(retentionFee));
    lowerEdge = lowerEdge.mul(totalSupply).div(assets);
    lowerEdge = lowerEdge.mul(USDC_SCALE_DIFF);

    let upperEdge = upperExchangeRate.mul(retentionFeeBase).div(retentionFeeBase.sub(retentionFee));
    upperEdge = upperEdge.mul(totalSupply).div(assets);
    upperEdge = upperEdge.mul(USDC_SCALE_DIFF);

    return [lowerEdge, upperEdge];
  }
});
