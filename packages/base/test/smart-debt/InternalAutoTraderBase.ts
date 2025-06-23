import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import { expect } from 'chai';
import { defaultAbiCoder, parseEther } from 'ethers/lib/utils';
import { expectThrow } from '../utils/assertions';
import { TestInternalAutoTraderBase, TestInternalAutoTraderBase__factory } from 'packages/base/src/types';

const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('InternalAutoTraderBase', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestInternalAutoTraderBase;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await createAndUpgradeDolomiteRegistry(core);

    trader = await createContractWithAbi<TestInternalAutoTraderBase>(
      TestInternalAutoTraderBase__factory.abi,
      TestInternalAutoTraderBase__factory.bytecode,
      [core.config.network, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await trader.CHAIN_ID()).to.equal(core.config.network);
      expect(await trader.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
    });
  });

  describe('#callFunction', () => {
    it('should work normally', async () => {
      const dolomiteImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await core.dolomiteRegistry.connect(core.governance).ownerSetTrustedInternalTradeCallers(
        [OTHER_ADDRESS],
        [true]
      );

      expect(await trader.tradeEnabled()).to.equal(false);
      await trader.connect(dolomiteImpersonator).callFunction(
        OTHER_ADDRESS,
        { owner: OTHER_ADDRESS, number: 0 },
        defaultAbiCoder.encode(['bool'], [true])
      );
      expect(await trader.tradeEnabled()).to.equal(true);
    });

    it('should fail if sender is not trusted internal trade caller', async () => {
      const dolomiteImpersonator = await impersonate(core.dolomiteMargin.address, true);

      await expectThrow(
        trader.connect(dolomiteImpersonator).callFunction(
          OTHER_ADDRESS,
          { owner: OTHER_ADDRESS, number: 0 },
          defaultAbiCoder.encode(['bool'], [true])
        ),
        'InternalAutoTraderBase: Invalid sender'
      );
    });

    it('should fail if caller is not Dolomite margin', async () => {
      await expectThrow(
        trader.callFunction(
          OTHER_ADDRESS,
          { owner: OTHER_ADDRESS, number: 0 },
          defaultAbiCoder.encode(['bool'], [true])
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetGlobalFee', () => {
    it('should work normally', async () => {
      const newFee = { value: parseEther('0.1') };
      await trader.connect(core.governance).ownerSetGlobalFee(newFee);
      expect((await trader.globalFee()).value).to.equal(newFee.value);
      expect((await trader.getFees())[1].value).to.equal(newFee.value);
    });

    it('should fail if not called by owner', async () => {
      const newFee = { value: parseEther('0.1') };
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetGlobalFee(newFee),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetAdminFee', () => {
    it('should work normally', async () => {
      const newFee = { value: parseEther('0.5') };
      await trader.connect(core.governance).ownerSetAdminFee(newFee);
      expect((await trader.adminFee()).value).to.equal(newFee.value);
      expect((await trader.getFees())[0].value).to.equal(newFee.value);
    });

    it('should fail if not called by owner', async () => {
      const newFee = { value: parseEther('0.5') };
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetAdminFee(newFee),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
