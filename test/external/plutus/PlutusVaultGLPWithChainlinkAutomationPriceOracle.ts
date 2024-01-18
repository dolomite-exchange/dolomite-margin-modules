import { ADDRESSES } from '@dolomite-margin/dist/src';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import deployments from '../../../scripts/deployments.json';
import {
  CustomTestVaultToken,
  IPlutusVaultGLP,
  IPlutusVaultGLP__factory,
  IPlutusVaultGLPRouter,
  IPlutusVaultGLPRouter__factory,
  PlutusVaultGLPIsolationModeUnwrapperTraderV1,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2,
  PlutusVaultGLPIsolationModeUnwrapperTraderV2__factory,
  PlutusVaultGLPIsolationModeVaultFactory,
  PlutusVaultGLPIsolationModeVaultFactory__factory,
  PlutusVaultGLPWithChainlinkAutomationPriceOracle,
  PlutusVaultRegistry,
  PlutusVaultRegistry__factory,
} from '../../../src/types';
import { CHAINLINK_REGISTRY_MAP } from '../../../packages/base/src/utils/constants';
import { createTestVaultToken } from '../../../packages/base/src/utils/dolomite-utils';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import {
  getBlockTimestamp,
  getRealLatestBlockNumber,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '../../../packages/base/test/utils';
import { expectThrow } from '../../../packages/base/test/utils/assertions';
import { createPlutusVaultGLPWithChainlinkAutomationPriceOracle } from '../../utils/ecosystem-token-utils/plutus';
import { CoreProtocol, setupCoreProtocol, setupUSDCBalance } from '../../../packages/base/test/utils/setup';

const GLP_PRICE = BigNumber.from('984588746906888510'); // $0.984588746906888510
const FEE_PRECISION = BigNumber.from('10000');

describe('PlutusVaultGLPWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let plvGlpPriceOracle: PlutusVaultGLPWithChainlinkAutomationPriceOracle;
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
    chainlinkRegistry = await impersonate(CHAINLINK_REGISTRY_MAP[network]!, true);
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

    plvGlpPriceOracle = await createPlutusVaultGLPWithChainlinkAutomationPriceOracle(
      core,
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
      expect(await plvGlpPriceOracle.DFS_GLP_MARKET_ID()).to.eq(core.marketIds.dfsGlp);
    });
  });

  describe('#DPLV_GLP', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.DPLV_GLP()).to.eq(factory.address);
    });
  });

  describe('#PLUTUS_VAULT_REGISTRY', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.PLUTUS_VAULT_REGISTRY()).to.eq(plutusVaultRegistry.address);
    });
  });

  describe('#PLUTUS_VAULT_GLP_UNWRAPPER_TRADER', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.PLUTUS_VAULT_GLP_UNWRAPPER_TRADER())
        .to.eq(unwrapperTrader.address);
    });
  });

  describe('#lastUpdateTimestamp', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.lastUpdateTimestamp()).to.eq(deploymentTimestamp);
    });
  });

  describe('#exchangeRateNumerator', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.exchangeRateNumerator())
        .to.eq(await plvGlpToken.totalAssets());
    });
  });

  describe('#exchangeRateDenominator', () => {
    it('returns the correct value', async () => {
      expect(await plvGlpPriceOracle.exchangeRateDenominator())
        .to.eq(await plvGlpToken.totalSupply());
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dplvGLP', async () => {
      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();

      const price = (await plvGlpPriceOracle.getPrice(factory.address)).value;
      expect(price).to.eq(calculatePrice(GLP_PRICE, totalAssets, totalSupply, exitFeeBp));
    });

    it('returns the correct value when plvGLP has a total supply of 0', async () => {
      await plutusVaultRegistry.connect(core.governance).ownerSetPlvGlpToken(plvGlpTokenNoSupply.address);
      expect(await plvGlpTokenNoSupply.totalSupply()).to.eq(0);

      const plvGlpPriceOracleNoSupply = await createPlutusVaultGLPWithChainlinkAutomationPriceOracle(
        core,
        plutusVaultRegistry,
        factory,
        unwrapperTrader,
      );

      const price = (await plvGlpPriceOracleNoSupply.getPrice(factory.address)).value;
      expect(price).to.eq(calculatePrice(GLP_PRICE, BigNumber.from('0'), BigNumber.from('0'), exitFeeBp));
    });

    it('fails when token sent is not dplvGLP', async () => {
      await expectThrow(
        plvGlpPriceOracle.getPrice(ADDRESSES.ZERO),
        `PlvGLPWithChainlinkPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PlvGLPWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.tokens.dfsGlp!.address),
        `PlvGLPWithChainlinkPriceOracle: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PlvGLPWithChainlinkPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when plvGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.dplvGlp!, false);
      await expectThrow(
        plvGlpPriceOracle.getPrice(factory.address),
        'PlvGLPWithChainlinkPriceOracle: plvGLP cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(24 * 3600);
      await plvGlpPriceOracle.getPrice(factory.address);

      await increase(3600);
      await expectThrow(
        plvGlpPriceOracle.getPrice(factory.address),
        'ChainlinkAutomationPriceOracle: Price is expired',
      );
    });
  });

  describe('#checkUpkeep', () => {
    it('works normally', async () => {
      expect((await plvGlpPriceOracle.connect(zeroAddress).callStatic
        .checkUpkeep('0x')).upkeepNeeded).to.eq(false);
    });
  });

  describe('#performUpkeep', async () => {
    it('works normally', async () => {
      await increase(23 * 3600);
      await expectThrow(
        plvGlpPriceOracle.connect(chainlinkRegistry).performUpkeep('0x'),
        'ChainlinkAutomationPriceOracle: checkUpkeep conditions not met',
      );

      await increase(3600);
      await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.dfsGlp!.address, parseEther('1'));

      await plvGlpPriceOracle.connect(chainlinkRegistry).performUpkeep('0x');
      const upkeepTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
      expect(await plvGlpPriceOracle.lastUpdateTimestamp()).to.eq(upkeepTimestamp);

      const totalAssets = await plvGlpToken.totalAssets();
      const totalSupply = await plvGlpToken.totalSupply();
      const price = calculatePrice(parseEther('1'), totalAssets, totalSupply, exitFeeBp);
      expect((await plvGlpPriceOracle.getPrice(factory.address)).value)
        .to.eq(price);
    });
  });

  function calculatePrice(
    glpPrice: BigNumber,
    totalAssets: BigNumber,
    totalSupply: BigNumber,
    exitFeeBp: BigNumber,
  ): BigNumber {
    if (totalSupply.eq(0)) {
      return glpPrice.sub(glpPrice.mul(exitFeeBp).div(FEE_PRECISION));
    }
    const price = glpPrice.mul(totalAssets).div(totalSupply);
    return price.sub(price.mul(exitFeeBp).div(FEE_PRECISION));
  }
});
