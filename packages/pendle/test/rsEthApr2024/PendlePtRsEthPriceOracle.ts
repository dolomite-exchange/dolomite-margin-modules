import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { WE_ETH_ETH_REDSTONE_FEED_MAP, WE_ETH_USD_REDSTONE_FEED_MAP } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { advanceToTimestamp, getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
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
import { TWAPPriceOracle, TWAPPriceOracle__factory } from 'packages/oracles/src/types';
import { getTWAPPriceOracleConstructorParams } from 'packages/oracles/src/oracles-constructors';

const PT_WST_ETH_PRICE = BigNumber.from('5018321015037081078544705');

describe('PendlePtRsEthApr2024PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptTWAPOracle: TWAPPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumberish;
  let underlyingToken: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracle!.address,
    );
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthApr2024.ptRsEthMarket,
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
    ptTWAPOracle = await createContractWithAbi<TWAPPriceOracle>(
      TWAPPriceOracle__factory.abi,
      TWAPPriceOracle__factory.bytecode,
      [underlyingToken.address, ['0xb355cce5cbaf411bd56e3b092f5aa10a894083ae'], core.dolomiteMargin.address],
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ptTWAPOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptTWAPOracle.TOKEN()).to.eq(factory.address);
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
        core.testEcosystem!.testPriceOracle.address
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
    const price = await core.chainlinkPriceOracle!.getPrice(token.address);
    await core.testEcosystem!.testPriceOracle.setPrice(token.address, price.value);
    return price.value;
  }
});