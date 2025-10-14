import { Network } from 'packages/base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber, impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol, setupTestMarket } from 'packages/base/test/utils/setup';
import { GlvIsolationModeTokenVaultV1, GlvIsolationModeTokenVaultV1__factory } from '../src/types';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP, INVALID_TOKEN_MAP } from 'packages/base/src/utils/constants';
import { createGmxV2IsolationModeVaultFactory, createGmxV2Library } from 'packages/gmx-v2/test/gmx-v2-ecosystem-utils';
import { GMX_V2_EXECUTION_FEE_FOR_TESTS } from 'packages/gmx-v2/src/gmx-v2-constructors';
import { formatEther } from 'ethers/lib/utils';

const vaultAddress = '0x57b3a2D1BC1f0dfa2810a53A43714B43d329d823';
const userAddress = '0x17c8AFd739A175eACF8Af5531671b222102B8083';

describe('Glv Gm Markets Test', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let vault: GlvIsolationModeTokenVaultV1;
  let user: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    user = await impersonate(userAddress, true);
    vault = GlvIsolationModeTokenVaultV1__factory.connect(vaultAddress, user);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#glv btc', () => {
    it.only('should work normally for bnb', async () => {
      // Add bnb oracle and gmx bnb address
      const gmxBnbAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['BNB'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxBnbAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxBnbAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxBnbAddress]!.decimals,
        token: gmxBnbAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.bnbUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.bnbUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.bnbUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'bnb gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for cro', async () => {
      // Add cro oracle and gmx cro address
      const gmxCroAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['CRO'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxCroAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxCroAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxCroAddress]!.decimals,
        token: gmxCroAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.croUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.croUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.croUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'cro gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for pump', async () => {
      // Add pump oracle and gmx pump address
      const gmxPumpAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['PUMP'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxPumpAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxPumpAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxPumpAddress]!.decimals,
        token: gmxPumpAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.pumpUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.pumpUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.pumpUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'pump gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for ada', async () => {
      // Add ada oracle and gmx ada address
      const gmxAdaAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['ADA'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxAdaAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxAdaAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxAdaAddress]!.decimals,
        token: gmxAdaAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.adaUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.adaUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.adaUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'ada gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for cake', async () => {
      const gmxCakeAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['CAKE'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxCakeAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxCakeAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxCakeAddress]!.decimals,
        token: gmxCakeAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.cakeUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.cakeUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.cakeUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'cake gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for dot', async () => {
      const gmxDotAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['DOT'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxDotAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxDotAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxDotAddress]!.decimals,
        token: gmxDotAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.dotUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.dotUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.dotUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'dot gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for hype', async () => {
      const gmxHypeAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['HYPE'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxHypeAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxHypeAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxHypeAddress]!.decimals,
        token: gmxHypeAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.hypeUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.hypeUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.hypeUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'hype gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for ordi', async () => {
      const gmxOrdiAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['ORDI'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxOrdiAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxOrdiAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxOrdiAddress]!.decimals,
        token: gmxOrdiAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.ordiUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.ordiUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.ordiUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'ordi gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for stx', async () => {
      const gmxStxAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['STX'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxStxAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxStxAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxStxAddress]!.decimals,
        token: gmxStxAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.stxUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.stxUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.stxUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'stx gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for tao', async () => {
      const gmxTaoAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['TAO'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxTaoAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxTaoAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxTaoAddress]!.decimals,
        token: gmxTaoAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        [core.marketIds.wbtc, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.taoUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.taoUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.taoUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'tao gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });
  });

  describe('#glv eth', () => {
    it.only('should work normally for apt', async () => {
      // Add apt oracle and gmx apt address
      const gmxAptAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['APT'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxAptAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxAptAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxAptAddress]!.decimals,
        token: gmxAptAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.aptUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.aptUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.aptUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'apt gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for crv', async () => {
      // Add crv oracle and gmx crv address
      const gmxCrvAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['CRV'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxCrvAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxCrvAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxCrvAddress]!.decimals,
        token: gmxCrvAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.crvUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.crvUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.crvUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'crv gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for cvx', async () => {
      // Add cvx oracle and gmx cvx address
      const gmxCvxAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['CVX'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxCvxAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxCvxAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxCvxAddress]!.decimals,
        token: gmxCvxAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.cvxUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.cvxUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.cvxUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'cvx gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for mnt', async () => {
      // Add mnt oracle and gmx mnt address
      const gmxMntAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['MNT'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxMntAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxMntAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxMntAddress]!.decimals,
        token: gmxMntAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.mntUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.mntUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.mntUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'mnt gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for sui', async () => {
      // Add sui oracle and gmx sui address
      const gmxSuiAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['SUI'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxSuiAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxSuiAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxSuiAddress]!.decimals,
        token: gmxSuiAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.suiUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.suiUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.suiUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'sui gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it.only('should work normally for wlfi', async () => {
      // Add wlfi oracle and gmx wlfi address
      const gmxWlfiAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['WLFI'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxWlfiAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxWlfiAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: INVALID_TOKEN_MAP[Network.ArbitrumOne][gmxWlfiAddress]!.decimals,
        token: gmxWlfiAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.wlfiUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.wlfiUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.wlfiUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'wlfi gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for dolo', async () => {
      // Add dolo oracle and gmx dolo address
      const gmxDoloAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['DOLO'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxDoloAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxDoloAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxDoloAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.doloUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.doloUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.doloUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'dolo gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for ethena', async () => {
      // Add ethena oracle and gmx ethena address
      const gmxEthenaAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['ENA'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxEthenaAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxEthenaAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxEthenaAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.ethenaUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.ethenaUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.ethenaUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'ena gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for near', async () => {
      // Add near oracle and gmx near address
      const gmxNearAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['NEAR'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxNearAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxNearAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 24,
        token: gmxNearAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.nearUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.nearUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.nearUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'near gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for tia', async () => {
      // Add tia oracle and gmx tia address
      const gmxTiaAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['TIA'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxTiaAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxTiaAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 6,
        token: gmxTiaAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.tiaUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.tiaUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.tiaUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'tia gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for ltc', async () => {
      // Add ltc oracle and gmx ltc address
      const gmxLtcAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['LTC'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxLtcAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxLtcAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 8,
        token: gmxLtcAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.ltcUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.ltcUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.ltcUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'ltc gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for atom', async () => {
      // Add atom oracle and gmx atom address
      const gmxAtomAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['ATOM'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxAtomAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxAtomAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 6,
        token: gmxAtomAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.atomUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.atomUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.atomUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'atom gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for sei', async () => {
      // Add sei oracle and gmx sei address
      const gmxSeiAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['SEI'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxSeiAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxSeiAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxSeiAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.seiUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.seiUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.seiUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'sei gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for makerUsd', async () => {
      // Add mkr oracle and gmx mkr address
      const gmxMkrAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['MKR'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxMkrAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxMkrAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxMkrAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.mkrUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.mkrUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.mkrUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'mkr gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for zro', async () => {
      // Add zro oracle and gmx zro address
      const gmxZroAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['ZRO'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxZroAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxZroAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxZroAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.zroUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.zroUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.zroUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'zro gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for melania', async () => {
      // Add melania oracle and gmx melania address
      const gmxMelaniaAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['MELANIA'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxMelaniaAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxMelaniaAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 6,
        token: gmxMelaniaAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.melaniaUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.melaniaUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.melaniaUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'melania gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for ldo', async () => {
      // Add ldo oracle and gmx ldo address
      const gmxLdoAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['LDO'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxLdoAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxLdoAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxLdoAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.lidoUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.lidoUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.lidoUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'ldo gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for pol', async () => {
      // Add pol oracle and gmx pol address
      const gmxPolAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['POL'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxPolAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxPolAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxPolAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.polUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.polUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.polUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'pol gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for bera', async () => {
      // Add bera oracle and gmx bera address
      const gmxBeraAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['BERA'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxBeraAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxBeraAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 18,
        token: gmxBeraAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.beraUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.beraUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.beraUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'bera gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for xrp', async () => {
      // Add xrp oracle and gmx xrp address
      const gmxXrpAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['XRP'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxXrpAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxXrpAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 6,
        token: gmxXrpAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.xrpUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.xrpUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.xrpUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'xrp gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for trump', async () => {
      // Add trump oracle and gmx trump address
      const gmxTrumpAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['TRUMP'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxTrumpAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxTrumpAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 6,
        token: gmxTrumpAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.trumpUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.trumpUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.trumpUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'trump gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });

    it('should work normally for doge', async () => {
      // Add doge oracle and gmx doge address
      const gmxDogeAddress = GMX_V2_PLACEHOLDER_TOKEN_ADDRESS_MAP[Network.ArbitrumOne]['DOGE'];
      await core.chainlinkPriceOracleV3.connect(core.governance).ownerInsertOrUpdateOracleToken(
        gmxDogeAddress,
        CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][gmxDogeAddress]!.aggregatorAddress,
        false
      );
      await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
        oracleInfos: [
          { oracle: core.chainlinkPriceOracleV3.address, tokenPair: ZERO_ADDRESS, weight: 100 }
        ],
        decimals: 8,
        token: gmxDogeAddress
      });

      const gmxV2Library = await createGmxV2Library();
      const factory = await createGmxV2IsolationModeVaultFactory(
        core,
        gmxV2Library,
        core.gmxV2Ecosystem.live.registry,
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        [core.marketIds.weth, core.marketIds.nativeUsdc],
        core.gmxV2Ecosystem.gmTokens.dogeUsd,
        core.gmxV2Ecosystem.live.tokenVaultImplementation,
        GMX_V2_EXECUTION_FEE_FOR_TESTS
      );
      await core.gmxV2Ecosystem.live.registry.connect(core.governance).ownerSetGmxMarketToIndexToken(
        core.gmxV2Ecosystem.gmTokens.dogeUsd.marketToken.address,
        core.gmxV2Ecosystem.gmTokens.dogeUsd.indexToken.address
      );
      await core.gmxV2Ecosystem.live.priceOracle.connect(core.governance).ownerSetMarketToken(factory.address, true);

      await setupTestMarket(core, factory, true, core.gmxV2Ecosystem.live.priceOracle);
      await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);
      await factory.connect(core.governance).ownerInitialize([]);

      console.log(
        'doge gm price: ',
        formatEther((await core.gmxV2Ecosystem.live.priceOracle.getPrice(factory.address)).value.toString())
      );
    });
  });
});
