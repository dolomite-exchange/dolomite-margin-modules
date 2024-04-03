import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import {
  CHAINLINK_PRICE_AGGREGATORS_MAP,
  REDSTONE_PRICE_AGGREGATORS_MAP,
} from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle,
  getRedstonePriceOracleV2ConstructorParams,
} from 'packages/oracles/src/oracles-constructors';
import {
  ChainlinkPriceOracleV2,
  ChainlinkPriceOracleV2__factory,
  RedstonePriceOracleV2,
  RedstonePriceOracleV2__factory,
} from '@dolomite-exchange/modules-oracles/src/types';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracle, PendleRegistry } from '../../src/types';
import {
  createPendlePtEEthPriceOracle,
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

const PT_E_ETH_PRICE = BigNumber.from('3689824302982898438870');

describe('PendlePtEEthApr2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 187_700_000,
      network: Network.ArbitrumOne,
    });

    underlyingToken = core.tokens.weEth!;
    const wethAggregator = await core.chainlinkPriceOracleOld!.getAggregatorByToken(core.tokens.weth.address);
    const weEthAggregator = REDSTONE_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne].aggregatorAddress;
    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracleV2>(
      RedstonePriceOracleV2__factory.abi,
      RedstonePriceOracleV2__factory.bytecode,
      await getRedstonePriceOracleV2ConstructorParams(
        [core.tokens.weth, underlyingToken],
        [wethAggregator, weEthAggregator],
        [ADDRESS_ZERO, core.tokens.weth.address],
        [false, false],
        core,
      ),
    )).connect(core.governance);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    const chainlinkOracle = (await createContractWithAbi<ChainlinkPriceOracleV2>(
      ChainlinkPriceOracleV2__factory.abi,
      ChainlinkPriceOracleV2__factory.bytecode,
      await getChainlinkPriceOracleV2ConstructorParamsFromOldPriceOracle(core),
    )).connect(core.governance);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      chainlinkOracle.address,
    );
    await chainlinkOracle.connect(core.governance).ownerInsertOrUpdateOracleTokenWithBypass(
      core.tokens.weEth.address,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address].aggregatorAddress,
      ZERO_ADDRESS,
      true,
    );

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.weEthApr2024.ptWeEthMarket,
      core.pendleEcosystem!.weEthApr2024.ptOracle,
      core.pendleEcosystem!.syWeEthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.weEthApr2024.ptWeEthToken,
      userVaultImplementation,
    );

    ptOracle = await createPendlePtEEthPriceOracle(core, factory, pendleRegistry);
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
      expect(await ptOracle.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_E_ETH_PRICE);
    });
  });
});
