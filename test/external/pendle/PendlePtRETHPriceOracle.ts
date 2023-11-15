import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  PendlePtRETHIsolationModeVaultFactory,
  PendlePtRETHPriceOracle,
  PendleRETHRegistry,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../../src/types';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { Network } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import {
  createPendlePtRETHIsolationModeTokenVaultV1,
  createPendlePtRETHIsolationModeVaultFactory,
  createPendlePtRETHPriceOracle,
  createPendleRETHRegistry,
} from '../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../utils/setup';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const PT_RETH_PRICE = BigNumber.from('1968646858895243740410'); //

describe('PendlePtRETHPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let ptRETHOracle: PendlePtRETHPriceOracle;
  let pendleRegistry: PendleRETHRegistry;
  let factory: PendlePtRETHIsolationModeVaultFactory;
  let marketId: BigNumberish;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    pendleRegistry = await createPendleRETHRegistry(core);
    const userVaultImplementation = await createPendlePtRETHIsolationModeTokenVaultV1();
    factory = await createPendlePtRETHIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.ptRETHToken,
      userVaultImplementation,
    );
    ptRETHOracle = await createPendlePtRETHPriceOracle(
      core,
      factory,
      pendleRegistry,
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true, ptRETHOracle);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptRETHOracle.DPT_RETH()).to.eq(factory.address);
      expect(await ptRETHOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptRETHOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await ptRETHOracle.RETH_MARKET_ID()).to.eq(core.marketIds.rEth);
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
        createPendlePtRETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtRETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, false);
      await expectThrow(
        createPendlePtRETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtRETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(true, 0, true);
      await expectThrow(
        createPendlePtRETHPriceOracle(core, factory, pendleRegistry),
        'PendlePtRETHPriceOracle: Oracle not ready yet',
      );

      await testPtOracle.setOracleState(false, 0, true);
      await createPendlePtRETHPriceOracle(core, factory, pendleRegistry); // should work now
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for dptRETH', async () => {
      await setNextBlockTimestamp(1700000000);
      const price = await ptRETHOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_RETH_PRICE);
    });

    it('fails when token sent is not dptRETH', async () => {
      await expectThrow(
        ptRETHOracle.getPrice(ADDRESSES.ZERO),
        `PendlePtRETHPriceOracle: invalid token <${ADDRESSES.ZERO}>`,
      );
      await expectThrow(
        ptRETHOracle.getPrice(core.gmxEcosystem!.fsGlp.address),
        `PendlePtRETHPriceOracle: invalid token <${core.gmxEcosystem!.fsGlp.address.toLowerCase()}>`,
      );
      await expectThrow(
        ptRETHOracle.getPrice(core.tokens.dfsGlp!.address),
        `PendlePtRETHPriceOracle: invalid token <${(core.tokens.dfsGlp!.address).toLowerCase()}>`,
      );
      await expectThrow(
        ptRETHOracle.getPrice(core.gmxEcosystem!.glp.address),
        `PendlePtRETHPriceOracle: invalid token <${core.gmxEcosystem!.glp.address.toLowerCase()}>`,
      );
    });

    it('fails when ptRETH is borrowable', async () => {
      await core.dolomiteMargin.ownerSetIsClosing(marketId, false);
      await expectThrow(
        ptRETHOracle.getPrice(factory.address),
        'PendlePtRETHPriceOracle: ptRETH cannot be borrowable',
      );
    });
  });
});
