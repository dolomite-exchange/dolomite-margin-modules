import {
  CustomTestVaultToken,
  IERC4626,
  MagicGLPWithChainlinkAutomationPriceOracle,
  MagicGLPWithChainlinkAutomationPriceOracle__factory, TestPriceOracle
} from '../../../src/types';
import { expect } from 'chai';
import { Network } from '../../../src/utils/no-deps-constants';
import { createContractWithAbi, createTestVaultToken } from '../../../src/utils/dolomite-utils';
import { getBlockTimestamp, impersonate, increaseToTimestamp, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import { createMagicGLPWithChainlinkAutomationPriceOracle } from '../../utils/ecosystem-token-utils/abracadabra';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { expectThrow } from '../../utils/assertions';
import { ADDRESSES } from '@dolomite-margin/dist/src';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { parseEther } from 'ethers/lib/utils';

const GLP_PRICE = BigNumber.from('1004682394802947459'); // $1.004682394802947459
const CHAINLINK_REGISTRY_ADDRESS = '0x75c0530885F385721fddA23C539AF3701d6183D4';
describe('MagicGLPWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let magicGLPWithChainlinkAutomationPriceOracle: MagicGLPWithChainlinkAutomationPriceOracle;
  let magicGLPWithChainlinkAutomationPriceOracleNoSupply: MagicGLPWithChainlinkAutomationPriceOracle;
  let magicGlp: IERC4626;
  let magicGlpWithNoTotalSupply: CustomTestVaultToken;
  let core: CoreProtocol;
  let chainlinkRegistry: SignerWithAddress;
  let zeroAddress: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    magicGlp = core.abraEcosystem!.magicGlp;
    magicGlpWithNoTotalSupply = await createTestVaultToken(core.tokens.usdc!);
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_ADDRESS, true);
    zeroAddress = await impersonate(ZERO_ADDRESS);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, GLP_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dfsGlp!, core.testEcosystem!.testPriceOracle!.address);

    magicGLPWithChainlinkAutomationPriceOracle = await createMagicGLPWithChainlinkAutomationPriceOracle(
      core,
      chainlinkRegistry
    );
    magicGLPWithChainlinkAutomationPriceOracleNoSupply =
      await createContractWithAbi<MagicGLPWithChainlinkAutomationPriceOracle>(
        MagicGLPWithChainlinkAutomationPriceOracle__factory.abi,
        MagicGLPWithChainlinkAutomationPriceOracle__factory.bytecode,
        [
          core.dolomiteMargin.address,
          chainlinkRegistry.address,
          magicGlpWithNoTotalSupply.address,
          core.marketIds.dfsGlp!,
        ],
      );

    await setupTestMarket(core, magicGlpWithNoTotalSupply, true, magicGLPWithChainlinkAutomationPriceOracleNoSupply);
    await increase(12 * 3600);
    await magicGLPWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x');
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#MAGIC_GLP', () => {
    it('returns the correct value', async () => {
      expect(await magicGLPWithChainlinkAutomationPriceOracle.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await magicGLPWithChainlinkAutomationPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp!);
    });
  });

  describe('#latestTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await magicGLPWithChainlinkAutomationPriceOracle.latestTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#exchangeRateNumerator', () => {
    it('returns the correct value', async () => {
      expect(await magicGLPWithChainlinkAutomationPriceOracle.exchangeRateNumerator())
        .to.eq(await magicGlp.totalAssets());
    });
  });

  describe('#exchangeRateDenominator', () => {
    it('returns the correct value', async () => {
      expect(await magicGLPWithChainlinkAutomationPriceOracle.exchangeRateDenominator())
        .to.eq(await magicGlp.totalSupply());
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for magicGLP', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);

      const totalAssets = await magicGlp.totalAssets();
      const totalSupply = await magicGlp.totalSupply();
      expect((await magicGLPWithChainlinkAutomationPriceOracle.getPrice(magicGlp.address)).value)
        .to.eq(glpPrice.value.mul(totalAssets).div(totalSupply));
    });

    it('returns the correct value when magicGLP total supply is 0', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);
      const totalSupply = await magicGlpWithNoTotalSupply.totalSupply();
      expect(totalSupply).to.eq(0);
      expect((await magicGLPWithChainlinkAutomationPriceOracleNoSupply
        .getPrice(magicGlpWithNoTotalSupply.address)).value).to.eq(glpPrice.value);
    });

    it('fails when token sent is not magicGLP', async () => {
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.getPrice(ADDRESSES.ZERO),
        `MagicGLPWithChainlinkPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.getPrice(ADDRESSES.TEST_UNISWAP),
        `MagicGLPWithChainlinkPriceOracle: invalid token <${ADDRESSES.TEST_UNISWAP.toLowerCase()}>`,
      );
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `MagicGLPWithChainlinkPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when magicGLP is borrowable', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.marketIds.magicGlp!, false);
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.getPrice(magicGlp.address),
        'MagicGLPWithChainlinkPriceOracle: magicGLP cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await magicGLPWithChainlinkAutomationPriceOracle.getPrice(magicGlp.address);

      await increase(3600);
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.getPrice(magicGlp.address),
        'MagicGLPWithChainlinkPriceOracle: price expired',
      );
    });
  });

  describe('#checkUpkeep', () => {
    it('works normally', async () => {
      expect((await magicGLPWithChainlinkAutomationPriceOracle.connect(zeroAddress).callStatic
        .checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });
  });

  describe('#performUpkeep', () => {
    it('works normally', async () => {
      await increase(11 * 3600);
      await expectThrow(
        magicGLPWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x'),
        'ChainlinkAutomationPriceOracle: checkUpkeep conditions not met'
      );

      await increase(3600);
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, parseEther('1'));

      await magicGLPWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await magicGLPWithChainlinkAutomationPriceOracle.latestTimestamp()).to.eq(upkeepTimestamp);

      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();
      expect((await magicGLPWithChainlinkAutomationPriceOracle.getPrice(magicGlp.address)).value)
        .to.eq(parseEther('1').mul(balance).div(totalSupply));
    });
  });
});
