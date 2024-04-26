import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { STETH_USD_CHAINLINK_FEED_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import {
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupTestMarket,
} from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  IERC20,
  PendlePtIsolationModeVaultFactory,
  PendlePtPriceOracle,
  PendleRegistry,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracle,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

const PT_WST_ETH_PRICE = BigNumber.from('4843076344353594664836639');

describe('PendlePtWstEthJun2025PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumberish;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracleOld!.address,
    );
    underlyingToken = core.tokens.stEth!;
    await core.chainlinkPriceOracleOld!.connect(core.governance).ownerInsertOrUpdateOracleToken(
      core.tokens.stEth!.address,
      18,
      STETH_USD_CHAINLINK_FEED_MAP[core.config.network]!,
      ADDRESS_ZERO,
    );
    await freezeAndGetOraclePrice(core.tokens.stEth!);

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.wstEthJun2025.wstEthMarket,
      core.pendleEcosystem!.wstEthJun2025.ptOracle,
      core.pendleEcosystem!.syWstEthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.wstEthJun2025.ptWstEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtPriceOracle(
      core,
      factory,
      pendleRegistry,
      underlyingToken,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
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

    it('should fail when oracle is not ready yet', async () => {
      const testPtOracle = await createContractWithAbi<TestPendlePtOracle>(
        TestPendlePtOracle__factory.abi,
        TestPendlePtOracle__factory.bytecode,
        [],
      );
      await pendleRegistry.connect(core.governance).ownerSetPtOracle(testPtOracle.address);

      await testPtOracle.setOracleState(true, 0, false);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken),
        'PendlePtPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendlePtPriceOracle(core, factory, pendleRegistry, underlyingToken); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      await advanceToTimestamp(1705000000);
      await core.dolomiteRegistry.connect(core.governance)
        .ownerSetChainlinkPriceOracle(
          core.testEcosystem!.testPriceOracle.address,
        );
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_WST_ETH_PRICE);
    });

    it('fails when token sent is not dpt', async () => {
      await expectThrow(
        ptOracle.getPrice(ADDRESSES.ZERO),
        `PendlePtPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ptOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendlePtPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        ptOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendlePtPriceOracle: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        ptOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendlePtPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when pt is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ptOracle.getPrice(factory.address),
        'PendlePtPriceOracle: PT cannot be borrowable',
      );
    });
  });

  async function freezeAndGetOraclePrice(token: IERC20): Promise<BigNumber> {
    const price = await core.chainlinkPriceOracleOld!.getPrice(token.address);
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    return price.value;
  }
});
