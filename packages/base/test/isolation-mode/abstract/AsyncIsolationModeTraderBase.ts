import { expect } from 'chai';
import {
  TestAsyncIsolationModeTraderBase,
  TestAsyncIsolationModeTraderBase__factory,
  TestHandlerRegistry
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createIsolationModeTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { CoreProtocolArbitrumOne } from '../../utils/core-protocol';
import { createTestHandlerRegistry } from '../../utils/ecosystem-utils/testers';

describe('AsyncIsolationModeTraderBase', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let handlerRegistry: TestHandlerRegistry;
  let trader: TestAsyncIsolationModeTraderBase;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    handlerRegistry = await createTestHandlerRegistry(core);

    const implementation = await createContractWithAbi<TestAsyncIsolationModeTraderBase>(
      TestAsyncIsolationModeTraderBase__factory.abi,
      TestAsyncIsolationModeTraderBase__factory.bytecode,
      [core.tokens.weth.address],
    );
    const calldata = await implementation.populateTransaction.initialize(
      handlerRegistry.address,
      core.dolomiteMargin.address,
    );
    const proxy = await createIsolationModeTraderProxy(implementation.address, calldata.data!, core);
    trader = await TestAsyncIsolationModeTraderBase__factory.connect(proxy.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize correctly', async () => {
      expect(await trader.WETH()).to.eq(core.tokens.weth.address);
      expect(await trader.HANDLER_REGISTRY()).to.eq(handlerRegistry.address);
      expect(await trader.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        trader.initialize(
          handlerRegistry.address,
          core.tokens.weth.address,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerWithdrawETH', () => {
    it('should work normally', async () => {
      await setEtherBalance(trader.address, ONE_ETH_BI);
      await expect(() =>
        trader.connect(core.governance).ownerWithdrawETH(core.governance.address),
      ).to.changeTokenBalance(core.tokens.weth, core.governance, ONE_ETH_BI);
    });

    it('should emit OwnerWithdrawETH', async () => {
      await setEtherBalance(trader.address, ONE_ETH_BI);
      const result = await trader.connect(core.governance).ownerWithdrawETH(core.governance.address);
      await expectEvent(trader, result, 'OwnerWithdrawETH', {
        receiver: core.governance.address,
        bal: ONE_ETH_BI,
      });
    });

    it('should fail if not called by dolomite margin owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerWithdrawETH(core.governance.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#onlyHandler', () => {
    it('should work normally', async () => {
      await handlerRegistry.connect(core.governance).ownerSetIsHandler(core.hhUser4.address, true);
      await trader.connect(core.hhUser4).testOnlyHandler();
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).testOnlyHandler(),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#callbackGasLimit', () => {
    it('should work normally', async () => {
      expect(await trader.callbackGasLimit()).to.eq(0);
      await handlerRegistry.connect(core.governance).ownerSetCallbackGasLimit(1000);
      expect(await trader.callbackGasLimit()).to.eq(1000);
    });
  });

  describe('#validateIsRetryable', () => {
    it('should work normally', async () => {
      await trader.testValidateIsRetryable(true);
      await expectThrow(
        trader.testValidateIsRetryable(false),
        'AsyncIsolationModeTraderBase: Conversion is not retryable',
      );
    });
  });

  describe('#eventEmitter', () => {
    it('should work normally', async () => {
      expect(await trader.testEventEmitter()).to.eq(core.eventEmitterRegistryProxy!.address);
    });
  });
});
