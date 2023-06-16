import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  JonesUSDCIsolationModeUnwrapperTraderV2,
  JonesUSDCIsolationModeVaultFactory,
  JonesUSDCPriceOracle,
  JonesUSDCRegistry,
} from '../../../../src/types';
import { createTestToken } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectThrow } from '../../../utils/assertions';
import {
  createJonesUSDCIsolationModeTokenVaultV1,
  createJonesUSDCIsolationModeUnwrapperTraderV2,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../../utils/setup';

const USDC_PRICE = BigNumber.from('999904540000000000000000000000'); // $0.99990454
const JONES_USDC_PRICE = BigNumber.from('1021871542224830000'); // $1.02187...

describe('JonesUSDCPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let jonesUSDCPriceOracle: JonesUSDCPriceOracle;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let unwrapperTrader: JonesUSDCIsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 86413000,
      network: Network.ArbitrumOne,
    });
    jonesUSDCRegistry = await createJonesUSDCRegistry(core);
    const userVaultImplementation = await createJonesUSDCIsolationModeTokenVaultV1();
    factory = await createJonesUSDCIsolationModeVaultFactory(
      core,
      jonesUSDCRegistry,
      core.jonesEcosystem!.jUSDC,
      userVaultImplementation,
    );
    unwrapperTrader = await createJonesUSDCIsolationModeUnwrapperTraderV2(core, jonesUSDCRegistry, factory);
    await jonesUSDCRegistry.initializeUnwrapperTrader(unwrapperTrader.address);
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
        jonesUSDCPriceOracle.getPrice(core.dfsGlp!.address),
        `JonesUSDCPriceOracle: Invalid token <${(core.dfsGlp!.address).toLowerCase()}>`,
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
