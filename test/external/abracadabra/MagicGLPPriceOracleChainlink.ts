import {
  CustomTestToken,
  IERC4626,
  MagicGLPPriceOracleChainlink,
  MagicGLPPriceOracleChainlink__factory, TestPriceOracle
} from '../../../src/types';
import { expect } from 'chai';
import { Network } from '../../../src/utils/no-deps-constants';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { getBlockTimestamp, impersonate, increaseToTimestamp, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import { createMagicGLPPriceOracleChainlink } from '../../utils/ecosystem-token-utils/abracadabra';
import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { expectThrow } from '../../utils/assertions';
import { ADDRESSES } from '@dolomite-margin/dist/src';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const GLP_PRICE = BigNumber.from('1004682394802947459'); // $1.004682394802947459
const CHAINLINK_REGISTRY_ADDRESS = '0x75c0530885F385721fddA23C539AF3701d6183D4';
describe('MagicGLPPriceOracleChainlink', () => {
  let snapshotId: string;

  let magicGlpPriceOracleChainlink: MagicGLPPriceOracleChainlink;
  let magicGlpPriceOracleChainlinkWithNoTotalSupply: MagicGLPPriceOracleChainlink;
  let magicGlp: IERC4626;
  let magicGlpWithNoTotalSupply: CustomTestToken;
  let core: CoreProtocol;
  let chainlinkRegistry: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    magicGlp = core.abraEcosystem!.magicGlp;
    magicGlpWithNoTotalSupply = await createTestToken();
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_ADDRESS, true);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, GLP_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dfsGlp!, core.testEcosystem!.testPriceOracle!.address);

    magicGlpPriceOracleChainlink = await createMagicGLPPriceOracleChainlink(core, chainlinkRegistry);
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
    magicGlpPriceOracleChainlinkWithNoTotalSupply = await createContractWithAbi<MagicGLPPriceOracleChainlink>(
      MagicGLPPriceOracleChainlink__factory.abi,
      MagicGLPPriceOracleChainlink__factory.bytecode,
      [
        core.dolomiteMargin.address,
        magicGlpWithNoTotalSupply.address,
        core.marketIds.dfsGlp!,
        chainlinkRegistry.address
      ],
    );

    await setupTestMarket(core, magicGlpWithNoTotalSupply, true, magicGlpPriceOracleChainlinkWithNoTotalSupply);
    await increase(12 * 3600);
    await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#DOLOMITE_MARGIN', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracleChainlink.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#MAGIC_GLP', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracleChainlink.MAGIC_GLP()).to.eq(magicGlp.address);
    });
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracleChainlink.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp!);
    });
  });

  describe('#latestTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracleChainlink.latestTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#HEARTBEAT', () => {
    it('returns the correct value', async () => {
      expect(await magicGlpPriceOracleChainlink.HEARTBEAT()).to.eq(12 * 3600);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for magicGLP', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);

      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();
      expect((await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value)
        .to.eq(glpPrice.value.mul(balance).div(totalSupply));
    });

    it('returns the correct value when magicGLP total supply is 0', async () => {
      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      expect(glpPrice.value).to.eq(GLP_PRICE);
      const totalSupply = await magicGlpWithNoTotalSupply.totalSupply();
      expect(totalSupply).to.eq(0);
      expect((await magicGlpPriceOracleChainlinkWithNoTotalSupply.getPrice(magicGlpWithNoTotalSupply.address)).value)
        .to.eq(glpPrice.value);
    });

    it('fails when token sent is not magicGLP', async () => {
      await expectThrow(
        magicGlpPriceOracleChainlink.getPrice(ADDRESSES.ZERO),
        `MagicGLPPriceOracleChainlink: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        magicGlpPriceOracleChainlink.getPrice(ADDRESSES.TEST_UNISWAP),
        `MagicGLPPriceOracleChainlink: invalid token <${ADDRESSES.TEST_UNISWAP.toLowerCase()}>`,
      );
      await expectThrow(
        magicGlpPriceOracleChainlink.getPrice(core.gmxEcosystem!.glp.address),
        `MagicGLPPriceOracleChainlink: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when magicGLP is borrowable', async () => {
      await core.dolomiteMargin.connect(core.governance).ownerSetIsClosing(core.marketIds.magicGlp!, false);
      await expectThrow(
        magicGlpPriceOracleChainlink.getPrice(magicGlp.address),
        'MagicGLPPriceOracleChainlink: magicGLP cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await expectThrow(
        magicGlpPriceOracleChainlink.getPrice(magicGlp.address),
        'MagicGLPPriceOracleChainlink: price expired',
      );
    });
  });

  describe.only('#checkUpkeep', () => {
    it('works normally', async () => {
      expect((await magicGlpPriceOracleChainlink.checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });

    xit('fails when called by address other than zero address', async () => {
      await expectThrow(
        magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: static rpc calls only'
      );
    });

    it('returns false when deviation is less than 0.25% and lastTimestamp is less than heartbeat', async () => {
      expect((await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);
    });

    it('returns true when deviation is greater than .25% and lastTimestamp is less than heartbeat', async () => {
      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();

      let upperEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      upperEdge = upperEdge.mul(10025).div(10000);
      upperEdge = upperEdge.mul(totalSupply).div(balance).add(1); // Add 1 so it is greater than deviation
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, upperEdge);
      expect((await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);

      let lowerEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      lowerEdge = lowerEdge.mul(9975).div(10000);
      lowerEdge = lowerEdge.mul(totalSupply).div(balance);
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, lowerEdge);
      expect((await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });

    it.only('returns true when deviation is less than 0.25% and lastTimestamp is more than heartbeat', async () => {
      await increase(11 * 3600);
      expect((await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);

      // CHECK THIS
      await increase(3600);
      expect((await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });
  });

  describe('#performUpkeep', () => {
    it('works if greater than heartbeat period', async () => {
      await increase(11 * 3600);
      await expectThrow(
        magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: checkUpkeep conditions not met'
      );

      await increase(3600);
      await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await magicGlpPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const glpPrice = await core.dolomiteMargin.getMarketPrice(core.marketIds.dfsGlp!);
      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();
      expect((await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value)
        .to.eq(glpPrice.value.mul(balance).div(totalSupply));
    });

    it('works if greater than deviation upperEdge', async () => {
      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();

      let upperEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      upperEdge = upperEdge.mul(10025).div(10000);
      upperEdge = upperEdge.mul(totalSupply).div(balance).add(1); // Add 1 for rounding error
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, upperEdge);

      await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      expect((await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value)
        .to.eq(upperEdge.mul(balance).div(totalSupply));
    });

    it('works if less than deviation lowerEdge', async () => {
      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();

      let lowerEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      lowerEdge = lowerEdge.mul(9975).div(10000);
      lowerEdge = lowerEdge.mul(totalSupply).div(balance);
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, lowerEdge);

      await magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      expect((await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value)
        .to.eq(lowerEdge.mul(balance).div(totalSupply));
    });

    it('fails when not called by Chainlink', async () => {
      await expectThrow(
        magicGlpPriceOracleChainlink.connect(core.hhUser1).performUpkeep('0x'),
      'MagicGLPPriceOracleChainlink: caller is not Chainlink'
      );
    });

    it('fails when before heartbeat and within deviation range', async () => {
      const balance = await core.gmxEcosystem!.fsGlp.balanceOf(magicGlp.address);
      const totalSupply = await magicGlp.totalSupply();

      let upperEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      upperEdge = upperEdge.mul(10025).div(10000);
      upperEdge = upperEdge.mul(totalSupply).div(balance).sub(1); // Sub 1 so it is within deviation
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, upperEdge);
      await expectThrow(
        magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: checkUpkeep conditions not met'
      );

      let lowerEdge = (await magicGlpPriceOracleChainlink.getPrice(magicGlp.address)).value;
      lowerEdge = lowerEdge.mul(9975).div(10000);
      lowerEdge = lowerEdge.mul(totalSupply).div(balance).add(2); // Add 2 so it is within deviation
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, lowerEdge);
      await expectThrow(
        magicGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: checkUpkeep conditions not met'
      );
    });
  });
});
