import { CustomTestVaultToken, IERC4626 } from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_AUTOMATION_REGISTRY_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi, createTestVaultToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { SignerWithAddressWithSafety } from '@dolomite-exchange/modules-base/src/utils/SignerWithAddressWithSafety';
import {
  getBlockTimestamp,
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupNativeUSDCBalance } from '@dolomite-exchange/modules-base/test/utils/setup';
import deployments from '@dolomite-exchange/modules-deployments/src/deploy/deployments.json';
import { ADDRESSES } from '@dolomite-margin/dist/src';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, BigNumberish, Signer } from 'ethers';
import { ethers } from 'hardhat';
import {
  IJonesWhitelistControllerV2,
  IJonesWhitelistControllerV2__factory,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCRegistry,
  JonesUSDCRegistry__factory,
  JonesUSDCV2IsolationModeVaultFactory__factory,
  JonesUSDCWithChainlinkAutomationPriceOracle,
  JonesUSDCWithChainlinkAutomationPriceOracle__factory,
} from '../src/types';
import { createJonesUSDCWithChainlinkAutomationPriceOracle } from './jones-ecosystem-utils';
import { JONES_CORE_PROTOCOL_CONFIG } from './jones-utils';

const USDC_PRICE = BigNumber.from('1000043460000000000000000000000'); // $0.99998605
const USDC_SCALE_DIFF = BigNumber.from('10').pow(12);

describe('JonesUSDCWithChainlinkAutomationPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let jonesController: IJonesWhitelistControllerV2;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let jonesUSDCWithChainlinkAutomationPriceOracle: JonesUSDCWithChainlinkAutomationPriceOracle;
  let jUSDC: IERC4626;
  let jUSDCNoSupply: CustomTestVaultToken;
  let chainlinkRegistry: SignerWithAddressWithSafety;
  let deploymentTimestamp: BigNumberish;
  let retentionFee: BigNumber;
  let retentionFeeBase: BigNumber;
  let zeroAddress: Signer;

  before(async () => {
    core = await setupCoreProtocol(JONES_CORE_PROTOCOL_CONFIG);
    const network = core.network;
    chainlinkRegistry = await impersonate(CHAINLINK_AUTOMATION_REGISTRY_MAP[network]!, true);
    zeroAddress = await impersonate(ZERO_ADDRESS);

    jonesUSDCRegistry = JonesUSDCRegistry__factory.connect(
      deployments.JonesUSDCV2RegistryProxy[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    factory = JonesUSDCV2IsolationModeVaultFactory__factory.connect(
      deployments.JonesUSDCV2IsolationModeVaultFactory[Network.ArbitrumOne].address,
      core.hhUser1,
    );
    jonesController = IJonesWhitelistControllerV2__factory.connect(
      await jonesUSDCRegistry.whitelistController(),
      core.hhUser1,
    );

    jUSDC = core.jonesEcosystem.jUSDCV2;
    await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDC(jUSDC.address);

    const role = await jonesController.getUserRole(await jonesUSDCRegistry.unwrapperTraderForLiquidation());
    retentionFee = (await jonesController.getRoleInfo(role)).INCENTIVE_RETENTION;
    retentionFeeBase = BigNumber.from('1000000000000');

    jUSDCNoSupply = await createTestVaultToken(core.tokens.nativeUsdc);
    await setupNativeUSDCBalance(core, core.hhUser1, 1000e6, core.dolomiteMargin);
    await core.tokens.nativeUsdc.connect(core.hhUser1).transfer(jUSDCNoSupply.address, 100e6);

    await core.testEcosystem!.testPriceOracle!.setPrice(core.tokens.nativeUsdc.address, USDC_PRICE);
    await core.dolomiteMargin.ownerSetPriceOracle(
      core.marketIds.nativeUsdc!,
      core.testEcosystem!.testPriceOracle.address,
    );

    jonesUSDCWithChainlinkAutomationPriceOracle = await createJonesUSDCWithChainlinkAutomationPriceOracle(
      core,
      jonesUSDCRegistry,
      factory,
    );
    deploymentTimestamp = await getBlockTimestamp(await ethers.provider.getBlockNumber());
    await jonesUSDCWithChainlinkAutomationPriceOracle.connect(core.governance)
      .ownerSetForwarder(chainlinkRegistry.address);

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
      expect(await jonesUSDCWithChainlinkAutomationPriceOracle.USDC_MARKET_ID()).to.eq(core.marketIds.nativeUsdc);
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
            core.marketIds.nativeUsdc,
            factory.address,
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

    it('fails when jUSDC is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(core.marketIds.djUsdcV2, false);
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.getPrice(factory.address),
        'jUSDCWithChainlinkPriceOracle: jUSDC cannot be borrowable',
      );
    });

    it('fails when price has expired', async () => {
      await increase(24 * 3600);
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
      await increase(23 * 3600);
      await expectThrow(
        jonesUSDCWithChainlinkAutomationPriceOracle.connect(chainlinkRegistry).performUpkeep('0x'),
        'ChainlinkAutomationPriceOracle: checkUpkeep conditions not met',
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

    const price = usdcPrice.mul(totalAssets).div(totalSupply);
    return price.sub(price.mul(retentionFee).div(retentionFeeBase));
  }
});
