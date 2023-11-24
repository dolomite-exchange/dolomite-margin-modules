import { ADDRESSES } from '@dolomite-exchange/dolomite-margin';
import { setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
  IERC20,
  PendlePtIsolationModeVaultFactory,
  PendlePtPriceOracle,
  PendleRegistry,
  TestPendlePtOracle,
  TestPendlePtOracle__factory,
} from '../../../../src/types';
import { createContractWithAbi } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { advanceToTimestamp, revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectThrow } from '../../../utils/assertions';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtPriceOracle,
  createPendleRegistry,
} from '../../../utils/ecosystem-token-utils/pendle';
import { CoreProtocol, setupCoreProtocol, setupTestMarket } from '../../../utils/setup';

const PT_RETH_PRICE = BigNumber.from('1808539032753997677827');

describe('PendlePtREthJun2025PriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let marketId: BigNumberish;
  let underlyingToken: IERC20;

  before(async () => {
    const blockNumber = 148_468_519;
    core = await setupCoreProtocol({
      blockNumber,
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

    underlyingToken = core.tokens.weth;
    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rEthJun2025.ptREthMarket,
      core.pendleEcosystem!.rEthJun2025.ptOracle,
      core.pendleEcosystem!.syREthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.rEthJun2025.ptREthToken,
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
      await advanceToTimestamp(1699549200);
      const price = await ptOracle.getPrice(factory.address);
      expect(price.value).to.eq(PT_RETH_PRICE);
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
});
