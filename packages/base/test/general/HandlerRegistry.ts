import { expect } from 'chai';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { TestHandlerRegistry, TestHandlerRegistry__factory } from '../../src/types';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { createTestHandlerRegistry } from '../utils/ecosystem-token-utils/testers';
import { expectEvent, expectThrow } from '../utils/assertions';

describe('HandlerRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let handlerRegistry: TestHandlerRegistry;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    handlerRegistry = await createTestHandlerRegistry(core);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      const result = await handlerRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser1.address, true);
      await expectEvent(handlerRegistry, result, 'HandlerSet', {
        handler: core.hhUser1.address,
        isTrusted: true
      });
      expect(await handlerRegistry.isHandler(core.hhUser1.address)).to.be.true;
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        handlerRegistry.connect(core.hhUser1).ownerSetIsHandler(core.hhUser1.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetCallbackGasLimit', () => {
    it('should work normally', async () => {
      const result = await handlerRegistry.connect(core.governance).ownerSetCallbackGasLimit(1000);
      await expectEvent(handlerRegistry, result, 'CallbackGasLimitSet', {
        gasLimit: 1000
      });
      expect(await handlerRegistry.callbackGasLimit()).to.eq(1000);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        handlerRegistry.connect(core.hhUser1).ownerSetCallbackGasLimit(1000),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetUnwrapperByToken', () => {
    it('should work normally', async () => {
      const result = await handlerRegistry.connect(core.governance).ownerSetUnwrapperByToken(
        core.tokens.dfsGlp!.address,
        core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1.address
      );
      await expectEvent(handlerRegistry, result, 'UnwrapperTraderSet', {
        token: core.tokens.dfsGlp!.address,
        unwrapper: core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1.address
      });
      expect(await handlerRegistry.getUnwrapperByToken(core.tokens.dfsGlp!.address)).to.eq(
        core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1.address
      );
    });

    it('should fail if invalid unwrapper', async () => {
      await expectThrow(
        handlerRegistry.connect(core.governance).ownerSetUnwrapperByToken(
          core.tokens.dfsGlp!.address,
          core.plutusEcosystem!.live.plvGlpIsolationModeUnwrapperTraderV1.address
        ),
        'HandlerRegistry: Invalid unwrapper trader'
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        handlerRegistry.connect(core.hhUser1).ownerSetUnwrapperByToken(
          core.tokens.dfsGlp!.address,
          core.gmxEcosystem!.live.glpIsolationModeUnwrapperTraderV1.address
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetWrapperByToken', () => {
    it('should work normally', async () => {
      const result = await handlerRegistry.connect(core.governance).ownerSetWrapperByToken(
        core.tokens.dfsGlp!.address,
        core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1.address
      );
      await expectEvent(handlerRegistry, result, 'WrapperTraderSet', {
        token: core.tokens.dfsGlp!.address,
        wrapper: core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1.address
      });
      expect(await handlerRegistry.getWrapperByToken(core.tokens.dfsGlp!.address)).to.eq(
        core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1.address
      );
    });

    it('should fail if invalid wrapper', async () => {
      await expectThrow(
        handlerRegistry.connect(core.governance).ownerSetWrapperByToken(
          core.tokens.dfsGlp!.address,
          core.plutusEcosystem!.live.plvGlpIsolationModeWrapperTraderV1.address
        ),
        'HandlerRegistry: Invalid wrapper trader'
      );
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        handlerRegistry.connect(core.hhUser1).ownerSetWrapperByToken(
          core.tokens.dfsGlp!.address,
          core.gmxEcosystem!.live.glpIsolationModeWrapperTraderV1.address
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
