import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  PendlePtWstETHIsolationModeVaultFactory,
  PendlePtWstETHPriceOracle,
  PendleWstETHRegistry,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createPendlePtWstETHIsolationModeTokenVaultV1,
  createPendlePtWstETHIsolationModeVaultFactory,
  createPendleWstETHPriceOracle,
  createPendleWstETHRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

/**
 * This is the expected price at the following timestamp: 1700000000
 *
 * Keep in mind that Pendle's prices tick upward each second.
 */
const PT_WST_ETH_PRICE = BigNumber.from('2116436801030652594370');

describe('PendlePtWstETHPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let ptWstETHOracle: PendlePtWstETHPriceOracle;
  let pendleRegistry: PendleWstETHRegistry;
  let factory: PendlePtWstETHIsolationModeVaultFactory;
  let marketId: BigNumberish;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    pendleRegistry = await createPendleWstETHRegistry(core);
    const userVaultImplementation = await createPendlePtWstETHIsolationModeTokenVaultV1();
    factory = await createPendlePtWstETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.ptWstEth2024Market,
      core.pendleEcosystem!.ptWstEth2024Token,
      userVaultImplementation,
    );
    ptWstETHOracle = await createPendleWstETHPriceOracle(
      core,
      factory,
      pendleRegistry,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ptWstETHOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptWstETHOracle.DPT_WST_ETH()).to.eq(factory.address);
      expect(await ptWstETHOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptWstETHOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await ptWstETHOracle.WST_ETH_MARKET_ID()).to.eq(core.marketIds.wstEth);
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
        createPendleWstETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtWstETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendleWstETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtWstETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendleWstETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtWstETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendleWstETHPriceOracle(core, factory, pendleRegistry); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dptWstEth', async () => {
      await setNextBlockTimestamp(1700000000);
      const price = await ptWstETHOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_WST_ETH_PRICE);
    });

    it('fails when token sent is not dptWstEth', async () => {
      await expectThrow(
        ptWstETHOracle.getPrice(ADDRESSES.ZERO),
        `PendlePtWstETHPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ptWstETHOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendlePtWstETHPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        ptWstETHOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendlePtWstETHPriceOracle: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        ptWstETHOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendlePtWstETHPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when ptGLP is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ptWstETHOracle.getPrice(factory.address),
        'PendlePtWstETHPriceOracle: ptWstEth cannot be borrowable',
      );
    });
  });
});
