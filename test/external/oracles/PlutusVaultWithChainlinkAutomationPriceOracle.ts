import {
  CoreProtocol,
  setupCoreProtocol,
  setupUSDCBalance
} from '../../utils/setup';
import {
  IPlutusVaultGLP,
  IPlutusVaultGLP__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultWithChainlinkAutomationPriceOracle,
  PlutusVaultWithChainlinkAutomationPriceOracle__factory,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory,
  CustomTestVaultToken,
} from '../../../src/types';
import { BigNumber, BigNumberish } from 'ethers';
import { Network } from '../../../src/utils/no-deps-constants';
import deployments from '../../../scripts/deployments.json';
import {
  createPlutusVaultWithChainlinkAutomationPriceOracle,
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
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { parseEther } from 'ethers/lib/utils';
import { createContractWithAbi, createTestVaultToken } from '../../../src/utils/dolomite-utils';
import { CHAINLINK_REGISTRY_MAP } from '../../../src/utils/constants';

const GLP_PRICE = BigNumber.from('984588746906888510'); // $0.984588746906888510
const FEE_PRECISION = BigNumber.from('10000');

describe('PlutusVaultWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let plvWithChainlinkAutomationPriceOracle: PlutusVaultWithChainlinkAutomationPriceOracle;
  let plvGlpToken: IPlutusVaultGLP;
  let plvGlpTokenNoSupply: CustomTestVaultToken;
  let plvGlpRouter: IPlutusVaultGLPRouter;
  let plutusVaultRegistry: PlutusVaultRegistry;
  let factory: PlutusVaultGLPIsolationModeVaultFactory;
  let unwrapperTrader: PlutusVaultGLPIsolationModeUnwrapperTraderV1 | PlutusVaultGLPIsolationModeUnwrapperTraderV2;
  let chainlinkRegistry: SignerWithAddress;
  let deploymentTimestamp: BigNumberish;
  let exitFeeBp: BigNumber;
  let zeroAddress: SignerWithAddress;

  before(async () => {
    const network = Network.ArbitrumOne;
    const blockNumber = await getRealLatestBlockNumber(true, network);
    core = await setupCoreProtocol({ blockNumber, network });
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_MAP[network], true);
    zeroAddress = await impersonate(ZERO_ADDRESS);

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
    plvGlpTokenNoSupply = await createTestVaultToken(core.tokens.usdc!);
    await setupUSDCBalance(core, core.hhUser1, 1000e6, core.dolomiteMargin);
    await core.tokens.usdc!.connect(core.hhUser1).transfer(plvGlpTokenNoSupply.address, 100e6);

    plvGlpRouter = IPlutusVaultGLPRouter__factory.connect(
      await plutusVaultRegistry.plvGlpRouter(),
      core.hhUser1,
    );

    plvWithChainlinkAutomationPriceOracle = await createPlutusVaultWithChainlinkAutomationPriceOracle(
      core,
      chainlinkRegistry.address,
      plutusVaultRegistry,
      factory,
      unwrapperTrader,
    );
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
    exitFeeBp = (await plvGlpRouter.getFeeBp(unwrapperTrader.address))._exitFeeBp;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#DFS_GLP_MARKET_ID', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
    });
  });

  describe('#DPLV_GLP', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.DPLV_GLP()).to.eq(factory.address);
    });
  });

  describe('#PLUTUS_VAULT_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.PLUTUS_VAULT_REGISTRY()).to.eq(plutusVaultRegistry.address);
    });
  });

  describe('#PLUTUS_VAULT_GLP_UNWRAPPER_TRADER', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.PLUTUS_VAULT_GLP_UNWRAPPER_TRADER())
        .to.eq(unwrapperTrader.address);
    });
  });

  describe('#lastUpdateTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.lastUpdateTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#exchangeRateNumerator', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.exchangeRateNumerator())
        .to.eq(await plvGlpToken.totalAssets());
    });
  });

  describe('#exchangeRateDenominator', () => {
    it('returns the correct value', async () => {
      expect(await plvWithChainlinkAutomationPriceOracle.exchangeRateDenominator())
        .to.eq(await plvGlpToken.totalSupply());
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dplvGLP', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const price = (await plvWithChainlinkAutomationPriceOracle.getPrice(factory.address)).value;
      expect(price).to.eq(calculatePrice(GLP_PRICE, totalAssets, totalSupply, exitFeeBp));
    });

    it('returns the correct value when plvGLP has a total supply of 0', async () => {
      await plutusVaultRegistry.connect(core.governance).ownerSetPlvGlpToken(plvGlpTokenNoSupply.address);
      expect(await plvGlpTokenNoSupply.totalSupply()).to.eq(0);

      const plvWithChainlinkAutomationPriceOracleNoSupply =
        await createContractWithAbi<PlutusVaultWithChainlinkAutomationPriceOracle>(
          PlutusVaultWithChainlinkAutomationPriceOracle__factory.abi,
          PlutusVaultWithChainlinkAutomationPriceOracle__factory.bytecode,
          [
            core.dolomiteMargin.address,
            chainlinkRegistry.address,
            core.marketIds.dfsGlp!,
            factory.address,
            plutusVaultRegistry.address,
            unwrapperTrader.address
          ],
        );

      const price = (await plvWithChainlinkAutomationPriceOracleNoSupply.getPrice(factory.address)).value;
      expect(price).to.eq(calculatePrice(GLP_PRICE, BigNumber.from('0'), BigNumber.from('0'), exitFeeBp));
    });

    it('fails when token sent is not dplvGLP', async () => {
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(ADDRESSES.ZERO),
        `PlvWithChainlinkPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PlvWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(core.tokens.dfsGlp!.address),
        `PlvWithChainlinkPriceOracle: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PlvWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when plvGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.dplvGlp!, false);
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(factory.address),
        'PlvWithChainlinkPriceOracle: plvGLP cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(12 * 3600);
      await plvWithChainlinkAutomationPriceOracle.getPrice(factory.address);

      await increase(3600);
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.getPrice(factory.address),
        'ChainlinkAutomationPriceOracle: Price is expired',
      );
    });
  });

  describe('#checkUpkeep', () => {
    it('works normally', async () => {
      expect((await plvWithChainlinkAutomationPriceOracle.connect(zeroAddress).callStatic
        .checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });
  });

  describe('#performUpkeep', async () => {
    it('works normally', async () => {
      await increase(11 * 3600);
      await expectThrow(
        plvWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x'),
        'ChainlinkAutomationPriceOracle: checkUpkeep conditions not met'
      );

      await increase(3600);
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, parseEther('1'));

      await plvWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await plvWithChainlinkAutomationPriceOracle.lastUpdateTimestamp()).to.eq(upkeepTimestamp);

      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();
      const price = calculatePrice(parseEther('1'), totalAssets, totalSupply, exitFeeBp);
      expect((await plvWithChainlinkAutomationPriceOracle.getPrice(factory.address)).value)
        .to.eq(price);
    });
  });

  function calculatePrice(
    glpPrice: BigNumber,
    totalAssets: BigNumber,
    totalSupply: BigNumber,
    exitFeeBp: BigNumber
  ): BigNumber {
    if (totalSupply.eq(0)) {
      return glpPrice.sub(glpPrice.mul(exitFeeBp).div(FEE_PRECISION));
    }
    const price = glpPrice.mul(totalAssets).div(totalSupply);
    return price.sub(price.mul(exitFeeBp).div(FEE_PRECISION));
  }
});
