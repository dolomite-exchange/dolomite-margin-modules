import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getTWAPPriceOracleV2ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { RS_ETH_CAMELOT_POOL_MAP } from 'packages/base/src/utils/constants';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { IAlgebraV3Pool__factory, TWAPPriceOracleV2, TWAPPriceOracleV2__factory } from 'packages/oracles/src/types';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracle, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtRsEthPriceOracle,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

const PT_RS_ETH_PRICE = BigNumber.from('3682064398981067160104');

describe('PendlePtRsEthApr2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 187_700_000,
      network: Network.ArbitrumOne,
    });
    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracleOld!.address,
    );

    underlyingToken = core.tokens.rsEth!;
    const tokenPair = IAlgebraV3Pool__factory.connect(
      RS_ETH_CAMELOT_POOL_MAP[Network.ArbitrumOne]!,
      core.hhUser1,
    );
    const twapPriceOracle = await createContractWithAbi<TWAPPriceOracleV2>(
      TWAPPriceOracleV2__factory.abi,
      TWAPPriceOracleV2__factory.bytecode,
      getTWAPPriceOracleV2ConstructorParams(core, core.tokens.rsEth, tokenPair),
    );
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, core.tokens.rsEth, false, twapPriceOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(underlyingMarketId, twapPriceOracle.address);
    await freezeAndGetOraclePrice(underlyingToken);

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthApr2024.rsEthMarket,
      core.pendleEcosystem!.rsEthApr2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.weEthApr2024.ptWeEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtRsEthPriceOracle(core, factory, pendleRegistry);
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
      expect(await ptOracle.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
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
