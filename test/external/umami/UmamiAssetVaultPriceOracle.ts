import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  UmamiAssetVaultIsolationModeTokenVaultV1,
  UmamiAssetVaultIsolationModeUnwrapperTraderV2,
  UmamiAssetVaultIsolationModeVaultFactory,
  UmamiAssetVaultPriceOracle,
  UmamiAssetVaultRegistry,
} from '../../../src/types';
import { createTestToken } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createUmamiAssetVaultIsolationModeTokenVaultV1,
  createUmamiAssetVaultIsolationModeUnwrapperTraderV2,
  createUmamiAssetVaultIsolationModeVaultFactory,
  createUmamiAssetVaultPriceOracle,
  createUmamiAssetVaultRegistry,
} from '../../utils/ecosystem-token-utils/umami';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../utils/setup';

const USDC_PRICE = BigNumber.from('999904540000000000000000000000'); // $0.99990454
const UMAMI_USDC_PRICE = BigNumber.from('1021871542224830000'); // $1.02187...

describe('UmamiAssetVaultPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let umamiAssetVaultPriceOracle: UmamiAssetVaultPriceOracle;
  let umamiRegistry: UmamiAssetVaultRegistry;
  let userVaultImplementation: UmamiAssetVaultIsolationModeTokenVaultV1;
  let factory: UmamiAssetVaultIsolationModeVaultFactory;
  let unwrapperTrader: UmamiAssetVaultIsolationModeUnwrapperTraderV2;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 104861700,
      network: Network.ArbitrumOne,
    });
    umamiRegistry = await createUmamiAssetVaultRegistry(core);
    userVaultImplementation = await createUmamiAssetVaultIsolationModeTokenVaultV1();
    factory = await createUmamiAssetVaultIsolationModeVaultFactory(
      core,
      umamiRegistry,
      core.umamiEcosystem!.umUsdc,
      core.usdc,
      userVaultImplementation,
    );
    unwrapperTrader = await createUmamiAssetVaultIsolationModeUnwrapperTraderV2(core, umamiRegistry, factory);
    umamiAssetVaultPriceOracle = await createUmamiAssetVaultPriceOracle(
      core,
      umamiRegistry,
      factory,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, umamiAssetVaultPriceOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for umUSDC', async () => {
      const price = await umamiAssetVaultPriceOracle.getPrice(factory.address);
      expect(price.value).to.eq(UMAMI_USDC_PRICE);
    });

    it('returns the correct value umUSDC has a total supply of 0', async () => {
      const testToken = await createTestToken();
      const newFactory = await createUmamiAssetVaultIsolationModeVaultFactory(
        core,
        umamiRegistry,
        testToken,
        core.usdc,
        userVaultImplementation,
      );
      const umamiAssetVaultPriceOracle = await createUmamiAssetVaultPriceOracle(core, umamiRegistry, newFactory);
      const price = await umamiAssetVaultPriceOracle.getPrice(factory.address);
      const usdcPrice = USDC_PRICE.div(1e12);
      const retentionFee = usdcPrice.mul(97).div(10000);
      expect(price.value).to.eq(usdcPrice.sub(retentionFee));
    });

    it('fails when token sent is not umUSDC', async () => {
      await expectThrow(
        umamiAssetVaultPriceOracle.getPrice(ADDRESSES.ZERO),
        `UmamiAssetVaultPriceOracle: Invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        umamiAssetVaultPriceOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        umamiAssetVaultPriceOracle.getPrice(core.dfsGlp!.address),
        `UmamiAssetVaultPriceOracle: Invalid token <${(core.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        umamiAssetVaultPriceOracle.getPrice(core.gmxEcosystem!.glp.address),
        `UmamiAssetVaultPriceOracle: Invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when jUSDC is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        umamiAssetVaultPriceOracle.getPrice(factory.address),
        'UmamiAssetVaultPriceOracle: Umami Asset cannot be borrowable',
      );
    });
  });
});
