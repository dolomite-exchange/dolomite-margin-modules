import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCPriceOracle,
  JonesUSDCRegistry,
} from '../src/types';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation,
  createJonesUSDCIsolationModeUnwrapperTraderV2ForZap,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from './jones-ecosystem-utils';
import { JONES_CORE_PROTOCOL_CONFIG } from './jones-utils';

const USDC_PRICE = BigNumber.from('1000043460000000000000000000000'); // $1.00004346
const JONES_USDC_PRICE = BigNumber.from('1122695803999545963'); // $1.122695803999545963

describe('JonesUSDCPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let jonesUSDCPriceOracle: JonesUSDCPriceOracle;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let unwrapperTraderForLiquidation: JonesUSDCIsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(JONES_CORE_PROTOCOL_CONFIG);
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      core.jonesEcosystem.jUSDCV2,
      userVaultImplementation,
    );
    unwrapperTraderForLiquidation = await createJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation(
      core,
      jonesUSDCRegistry,
      factory,
    );
    const unwrapperTraderForZap = await createJonesUSDCIsolationModeUnwrapperTraderV2ForZap(
      core,
      jonesUSDCRegistry,
      factory,
    );
    await jonesUSDCRegistry.initializeUnwrapperTraders(
      unwrapperTraderForLiquidation.address,
      unwrapperTraderForZap.address,
    );
    jonesUSDCPriceOracle = await createJonesUSDCPriceOracle(
      core,
      jonesUSDCRegistry,
      factory,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, jonesUSDCPriceOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for djUSDC', async () => {
      const price = await jonesUSDCPriceOracle.getPrice(factory.address);
      expect(price.value).to.eq(JONES_USDC_PRICE);
    });

    it('returns the correct value jUSDC has a total supply of 0', async () => {
      const testToken = await createTestToken();
      await jonesUSDCRegistry.connect(core.governance).ownerSetJUSDC(testToken.address);
      const price = await jonesUSDCPriceOracle.getPrice(factory.address);
      const usdcPrice = USDC_PRICE.div(1e12);
      const retentionFee = usdcPrice.mul(97).div(10000);
      expect(price.value).to.eq(usdcPrice.sub(retentionFee));
    });

    it('fails when token sent is not djUSDC', async () => {
      await expectThrow(
        jonesUSDCPriceOracle.getPrice(ADDRESSES.ZERO),
        `JonesUSDCPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `JonesUSDCPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracle.getPrice(core.tokens.dfsGlp!.address),
        `JonesUSDCPriceOracle: Invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        jonesUSDCPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `JonesUSDCPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when jUSDC is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        jonesUSDCPriceOracle.getPrice(factory.address),
        'JonesUSDCPriceOracle: jUSDC cannot be borrowable',
      );
    });
  });
});
