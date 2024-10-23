import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracleV2, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

const PT_RS_ETH_PRICE = BigNumber.from('2207227206779889489578');

describe('PendlePtRsEthDec2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 250_769_568,
      network: Network.ArbitrumOne,
    });

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthDec2024.rsEthMarket,
      core.pendleEcosystem!.rsEthDec2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.rsEthDec2024.ptRsEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);

    const tokenInfo = {
      oracleInfos: [
        { oracle: ptOracle.address, tokenPair: core.tokens.weth.address, weight: 100 }
      ],
      decimals: 18,
      token: factory.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
    await setupTestMarket(core, factory, true, core.oracleAggregatorV2);

    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
    await factory.connect(core.governance).ownerInitialize([]);

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
      await advanceToTimestamp(1725647670);
      const price = await core.oracleAggregatorV2.getPrice(factory.address);
      expect(price.value).to.eq(PT_RS_ETH_PRICE);
    });
  });
});
