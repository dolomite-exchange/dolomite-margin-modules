import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { OARB, OARB__factory } from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from 'test/utils/setup';

describe('OARB', () => {
  let snapshotId: string;
  let core: CoreProtocol;
  let oARB: OARB;
  let marketId: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    oARB = await createContractWithAbi<OARB>(OARB__factory.abi, OARB__factory.bytecode, [core.dolomiteMargin.address]);

    await core.testEcosystem!.testPriceOracle.setPrice(
      oARB.address,
      '1000000000000000000' // $1.00
    );
    marketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, oARB, true);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oARB.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#ownerInitialize', () => {
    it('should work normally', async () => {
      expect(await oARB.marketId()).to.eq(0);
      const result = await oARB.connect(core.governance).ownerInitialize();
      await expectEvent(oARB, result, 'Initialized', {
        marketId
      });
      expect(await oARB.marketId()).to.eq(marketId);
    });

    it('should fail if already initialized', async () => {
      await oARB.connect(core.governance).ownerInitialize();
      await expectThrow(oARB.connect(core.governance).ownerInitialize(), 'oARBToken: Already initialized');
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        oARB.connect(core.hhUser1).ownerInitialize(),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      await oARB.connect(core.governance).ownerInitialize();
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
    });

    it('should fail if not initialized', async () => {
      await expectThrow(oARB.connect(core.hhUser5).mint(ONE_ETH_BI), 'oARBToken: Not initialized');
    });

    it('should fail if not called by operator', async () => {
      await oARB.connect(core.governance).ownerInitialize();
      await expectThrow(
        oARB.connect(core.hhUser1).mint(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#burn', () => {
    it('should work normally', async () => {
      await oARB.connect(core.governance).ownerInitialize();
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
      await oARB.connect(core.hhUser5).mint(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ONE_ETH_BI);
      await oARB.connect(core.hhUser5).burn(ONE_ETH_BI);
      expect(await oARB.balanceOf(core.hhUser5.address)).to.eq(ZERO_BI);
    });

    it('should fail if not initialized', async () => {
      await expectThrow(oARB.connect(core.hhUser5).burn(ONE_ETH_BI), 'oARBToken: Not initialized');
    });

    it('should fail if not called by operator', async () => {
      await oARB.connect(core.governance).ownerInitialize();
      await expectThrow(
        oARB.connect(core.hhUser1).burn(ONE_ETH_BI),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
