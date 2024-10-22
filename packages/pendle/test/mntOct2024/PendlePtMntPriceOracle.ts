import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracleV2, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';

const PT_PRICE = BigNumber.from('970667909600046256');
const TIMESTAMP = 1725471470;

describe('PendlePtMntOct2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;

  before(async () => {
    const blockNumber = 68_670_570;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.Mantle,
    });

    underlyingToken = core.tokens.wmnt!;

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.mntOct2024.mntMarket,
      core.pendleEcosystem!.mntOct2024.ptOracle,
      core.pendleEcosystem!.mntOct2024.syMntToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.mntOct2024.ptMntToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);

    const tokenInfo = {
      oracleInfos: [
        { oracle: ptOracle.address, tokenPair: underlyingToken.address, weight: 100 }
      ],
      decimals: 18,
      token: factory.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);

    await setupTestMarket(core, factory, true, ptOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptOracle.DPT_TOKEN()).to.eq(factory.address);
      expect(await ptOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      await advanceToTimestamp(TIMESTAMP);
      await core.dolomiteRegistry.connect(core.governance)
        .ownerSetChainlinkPriceOracle(
          core.testEcosystem!.testPriceOracle.address,
        );
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_PRICE);
    });
  });
});
