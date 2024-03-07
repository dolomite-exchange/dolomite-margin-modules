import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { CHAINLINK_PRICE_AGGREGATORS_MAP, WE_ETH_ETH_REDSTONE_FEED_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  IERC20,
  PendlePtIsolationModeVaultFactory,
  PendlePtPriceOracle,
  PendleRegistry,
} from '../../src/types';
import {
  createPendlePtEEthPriceOracle,
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';
import { RedstonePriceOracle, RedstonePriceOracle__factory } from 'packages/oracles/src/types';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { getRedstonePriceOracleConstructorParams } from 'packages/oracles/src/oracles-constructors';

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
    const wethAggregator = await core.chainlinkPriceOracle!.getAggregatorByToken(core.tokens.weth.address);
    const weEthAggregator = WE_ETH_ETH_REDSTONE_FEED_MAP[Network.ArbitrumOne];
    const redstoneOracle = (await createContractWithAbi<RedstonePriceOracle>(
      RedstonePriceOracle__factory.abi,
      RedstonePriceOracle__factory.bytecode,
      await getRedstonePriceOracleConstructorParams(
        [core.tokens.weth, underlyingToken],
        [wethAggregator, weEthAggregator],
        [ADDRESS_ZERO, core.tokens.weth.address],
        core
      )
    )).connect(core.governance);

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetRedstonePriceOracle(redstoneOracle.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracle!.address,
    );
    await core.chainlinkPriceOracle!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      underlyingToken.address,
      18,
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weEth.address],
      ADDRESS_ZERO,
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
      await setNextBlockTimestamp(1709735900);
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_E_ETH_PRICE);
    });
  });
});
