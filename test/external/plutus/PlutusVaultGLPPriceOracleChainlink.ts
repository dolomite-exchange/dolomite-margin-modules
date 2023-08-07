import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import {
  chainlink, IPlutusVaultGLP, IPlutusVaultGLP__factory, IPlutusVaultGLPRouter, IPlutusVaultGLPRouter__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultGLPPriceOracleChainlink,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory
} from '../../../src/types';
import { BigNumber, BigNumberish } from 'ethers';
import { Network } from '../../../src/utils/no-deps-constants';
import deployments from '../../../scripts/deployments.json';
import {
  createPlutusVaultGLPPriceOracleChainlink,
} from '../../utils/ecosystem-token-utils/plutus';
import {
  getBlockTimestamp,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot
} from '../../utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { expectThrow } from '../../utils/assertions';
import { ADDRESSES } from '@dolomite-margin/dist/src';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const GLP_PRICE = BigNumber.from('984588746906888510'); // $0.984588746906888510
const CHAINLINK_REGISTRY_ADDRESS = '0x75c0530885F385721fddA23C539AF3701d6183D4';
const FEE_PRECISION = BigNumber.from('10000');

describe('PlutusVaultGLPPriceOracleChainlink', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let plvGlpPriceOracleChainlink: PlutusVaultGLPPriceOracleChainlink;
  let plvGlpToken: IPlutusVaultGLP;
  let plvGlpRouter: IPlutusVaultGLPRouter;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2;
  let chainlinkRegistry: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;
  let exitFeeBp: BigNumber;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({ blockNumber, network });
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_ADDRESS, true);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, GLP_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(core.marketIds.dfsGlp!, core.testEcosystem!.testPriceOracle!.address);

    plutusVaultRegistry = PlutusVaultRegistry__factory.connect(
      deployments.PlutusVaultRegistryProxy[network].address,
      core.hhUser1,
    );
    factory = PlutusVaultGLPIsolationModeVaultFactory__factory.connect(
      deployments.PlutusVaultGLPIsolationModeVaultFactory[network].address,
      core.hhUser1,
    );
    unwrapperTrader = PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory.connect(
      deployments.PlutusVaultGLPIsolationModeUnwrapperTraderV2[network].address,
      core.hhUser1,
    );
    plvGlpToken = IPlutusVaultGLP__factory.connect(
      await plutusVaultRegistry.plvGlpToken(),
      core.hhUser1,
    );
    plvGlpRouter = IPlutusVaultGLPRouter__factory.connect(
      await plutusVaultRegistry.plvGlpRouter(),
      core.hhUser1,
    );

    plvGlpPriceOracleChainlink = await createPlutusVaultGLPPriceOracleChainlink(
      core,
      plutusVaultRegistry,
      factory,
      unwrapperTrader,
      chainlinkRegistry,
    );
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
    exitFeeBp = (await plvGlpRouter.getFeeBp(unwrapperTrader.address))._exitFeeBp;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#HEARTBEAT', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.HEARTBEAT()).to.eq(12 * 3600);
    });
  });

  describe('#DOLOMITE_MARGIN', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
    });
  });

  describe('#DPLV_GLP', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.DPLV_GLP()).to.eq(factory.address);
    });
  });

  describe('#PLUTUS_VAULT_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.PLUTUS_VAULT_REGISTRY()).to.eq(plutusVaultRegistry.address);
    });
  });

  describe('#PLUTUS_VAULT_GLP_UNWRAPPER_TRADER', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.PLUTUS_VAULT_GLP_UNWRAPPER_TRADER()).to.eq(unwrapperTrader.address);
    });
  });

  describe('#CHAINLINK_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.CHAINLINK_REGISTRY()).to.eq(chainlinkRegistry.address);
    });
  });

  describe('#latestTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracleChainlink.latestTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dplvGLP', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const price = (await plvGlpPriceOracleChainlink.getPrice(factory.address)).value;
      expect(price).to.eq(calculatePrice(GLP_PRICE, totalAssets, totalSupply, exitFeeBp));
    });

    it('returns the correct value when plvGLP has a total supply of 0', async () => {
    });

    it('fails when token sent is not dplvGLP', async () => {
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(ADDRESSES.ZERO),
        `plvGlpPriceOracleChainlink: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(core.gmxEcosystem!.fsGlp.address),
        `plvGlpPriceOracleChainlink: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(core.tokens.dfsGlp!.address),
        `plvGlpPriceOracleChainlink: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(core.gmxEcosystem!.glp.address),
        `plvGlpPriceOracleChainlink: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when plvGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.dplvGlp!, false);
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(factory.address),
        'plvGlpPriceOracleChainlink: plvGLP cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await expectThrow(
        plvGlpPriceOracleChainlink.getPrice(factory.address),
        'plvGlpPriceOracleChainlink: price expired',
      );
    });
  });

  describe('#checkUpkeep', () => {
    it('works normally', async () => {
      expect((await plvGlpPriceOracleChainlink.checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });

    xit('fails when called by address other than zero address', async () => {
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x'),
        'MagicGLPPriceOracleChainlink: static rpc calls only'
      );
    });

    it('returns false when deviation is less than 0.25% and lastTimestamp is less than heartbeat', async () => {
      expect((await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);
    });

    it('returns true when deviation is greater than .25% and lastTimestamp is less than heartbeat', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const currentExchangeRate = (await plvGlpPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        exitFeeBp,
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(
        core.tokens.dfsGlp!.address,
        upper.add(1)
      ); // Add 1 for rounding
      expect((await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);

      await core.testEcosystem!.testPriceOracle!.setPrice(
        core.tokens.dfsGlp!.address,
        lower.sub(1)
      ); // Sub 1 for rounding
      expect((await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });

    it('returns true when deviation is less than 0.25% and lastTimestamp is more than heartbeat', async () => {
      await increase(11 * 3600);
      expect((await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(false);

      await increase(3600);
      expect((await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).checkUpkeep('0x')).upkeepNeeded)
        .to.eq(true);
    });
  });

  describe('#performUpkeep', async () => {
    it('works if greater than heartbeat period', async () => {
      await increase(11 * 3600);
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'plvGlpPriceOracleChainlink: checkUpkeep conditions not met'
      );

      await increase(3600);

      await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await plvGlpPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();
      const price = calculatePrice(GLP_PRICE, totalAssets, totalSupply, exitFeeBp);
      expect((await plvGlpPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('works if greater than deviation upperEdge', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const currentExchangeRate = (await plvGlpPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        exitFeeBp,
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, upper);
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'plvGlpPriceOracleChainlink: checkUpkeep conditions not met',
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, upper.add(1));
      await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await plvGlpPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const price = calculatePrice(upper.add(1), totalAssets, totalSupply, exitFeeBp);
      expect((await plvGlpPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('works if less than deviation lowerEdge', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const currentExchangeRate = (await plvGlpPriceOracleChainlink.getPrice(factory.address)).value;
      const [lower, upper] = calculateDeviationRange(
        currentExchangeRate,
        totalAssets,
        totalSupply,
        exitFeeBp,
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, lower.add(1));
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'plvGlpPriceOracleChainlink: checkUpkeep conditions not met',
      );

      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, lower);
      await plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await plvGlpPriceOracleChainlink.latestTimestamp()).to.eq(upkeepTimestamp);

      const price = calculatePrice(lower.sub(1), totalAssets, totalSupply, exitFeeBp);
      expect((await plvGlpPriceOracleChainlink.getPrice(factory.address)).value)
        .to.eq(price);
    });

    it('fails when not called by Chainlink', async () => {
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(core.hhUser1).performUpkeep('0x'),
        'plvGlpPriceOracleChainlink: caller is not Chainlink'
      );
    });

    it('fails when before heartbeat and within deviation range', async () => {
      await expectThrow(
        plvGlpPriceOracleChainlink.connect(chainlinkRegistry).performUpkeep('0x'),
        'plvGlpPriceOracleChainlink: checkUpkeep conditions not met'
      );
    });
  });

  function calculatePrice(
    glpPrice: BigNumber,
    totalAssets: BigNumber,
    totalSupply: BigNumber,
    exitFeeBp: BigNumber
  ): BigNumber {
    const price = glpPrice.mul(totalAssets).div(totalSupply);
    return price.sub(price.mul(exitFeeBp).div(FEE_PRECISION));
  }

  function calculateDeviationRange(
    exchangeRate: BigNumber,
    totalAssets: BigNumber,
    totalSupply: BigNumber,
    exitFeeBp: BigNumber
  ): BigNumber[] {
    const lowerExchangeRate = exchangeRate.mul(9975).div(10000);
    const upperExchangeRate = exchangeRate.mul(10025).div(10000);

    let lowerEdge = lowerExchangeRate.mul(FEE_PRECISION).div(FEE_PRECISION.sub(exitFeeBp));
    lowerEdge = lowerEdge.mul(totalSupply).div(totalAssets);

    let upperEdge = upperExchangeRate.mul(FEE_PRECISION).div(FEE_PRECISION.sub(exitFeeBp));
    upperEdge = upperEdge.mul(totalSupply).div(totalAssets);
    const testIt = 'string';
    const newOne = 5;

    return [lowerEdge, upperEdge];
  }
});
