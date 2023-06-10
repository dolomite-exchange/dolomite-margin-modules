import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  JonesUSDCIsolationModeUnwrapperTraderV1,
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
  createJonesUSDCIsolationModeUnwrapperTraderV1,
  createJonesUSDCIsolationModeVaultFactory,
  createJonesUSDCPriceOracle,
  createJonesUSDCRegistry,
} from '../../../utils/ecosystem-token-utils/jones';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../../utils/setup';

const GLP_PRICE = BigNumber.from('951856689348643550'); // $0.95185668
const PLV_GLP_PRICE = BigNumber.from('1122820703434687401'); // $1.12282070

describe('JonesUSDCPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let plvGlpPriceOracle: JonesUSDCPriceOracle;
  let jonesUSDCRegistry: JonesUSDCRegistry;
  let factory: JonesUSDCIsolationModeVaultFactory;
  let unwrapperTrader: JonesUSDCIsolationModeUnwrapperTraderV1;
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
      core.plutusEcosystem!.plvGlp,
      userVaultImplementation,
    );
    unwrapperTrader = await createJonesUSDCIsolationModeUnwrapperTraderV1(core, jonesUSDCRegistry, factory);
    plvGlpPriceOracle = await createJonesUSDCPriceOracle(
      core,
      jonesUSDCRegistry,
      factory,
      unwrapperTrader,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, plvGlpPriceOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dplvGLP', async () => {
      const price = await plvGlpPriceOracle.getPrice(factory.address);
      expect(price.value).to.eq(PLV_GLP_PRICE);
    });

    it('returns the correct value plvGLP has a total supply of 0', async () => {
      const testToken = await createTestToken();
      await jonesUSDCRegistry.connect(core.governance).ownerSetPlvGlpToken(testToken.address);
      const price = await plvGlpPriceOracle.getPrice(factory.address);
      expect(price.value).to.eq(GLP_PRICE);
    });

    it('fails when token sent is not dplvGLP', async () => {
      await expectThrow(
        plvGlpPriceOracle.getPrice(ADDRESSES.ZERO),
        `JonesUSDCPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `JonesUSDCPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.dfsGlp!.address),
        `JonesUSDCPriceOracle: invalid token <${(core.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        plvGlpPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `JonesUSDCPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when plvGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        plvGlpPriceOracle.getPrice(factory.address),
        'JonesUSDCPriceOracle: plvGLP cannot be borrowable',
      );
    });
  });
});
