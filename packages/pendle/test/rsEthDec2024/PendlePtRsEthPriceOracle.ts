import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracleV2, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracleV2,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { TokenInfo } from 'packages/oracles/src';

const PT_RS_ETH_PRICE = BigNumber.from('966874469227388740');

describe('PendlePtRsEthSep2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracleV2;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 220_737_000,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.tokens.rsEth!;
    await core.chainlinkPriceOracleV3.ownerInsertOrUpdateOracleToken(
      underlyingToken.address,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][underlyingToken.address]!.aggregatorAddress,
      false
    );
    const tokenInfo: TokenInfo = {
      oracleInfos: [
        { oracle: core.chainlinkPriceOracleV3.address, tokenPair: core.tokens.weth.address, weight: 100 }
      ],
      decimals: 18,
      token: underlyingToken.address
    };
    await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, core.tokens.rsEth, false, core.oracleAggregatorV2);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(
      underlyingMarketId,
      core.oracleAggregatorV2.address
    );

    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthSep2024.rsEthMarket,
      core.pendleEcosystem!.rsEthSep2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.rsEthSep2024.ptRsEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracleV2(core, factory, pendleRegistry);
    await setupTestMarket(core, factory, true, ptOracle);
    await freezeAndGetOraclePrice(underlyingToken);

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
      await advanceToTimestamp(1718111300);
      await core.dolomiteRegistry.connect(core.governance)
        .ownerSetChainlinkPriceOracle(
          core.testEcosystem!.testPriceOracle.address,
        );
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_RS_ETH_PRICE);
    });
  });

  async function freezeAndGetOraclePrice(token: IERC20): Promise<BigNumber> {
    const price = (await core.dolomiteMargin.getMarketPrice(underlyingMarketId));
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    return price.value;
  }
});
