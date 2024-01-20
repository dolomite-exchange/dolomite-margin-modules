import { expect } from 'chai';
import { GmxV2Registry, } from '../src/types';
import {
  TestAsyncIsolationModeTraderBase, TestAsyncIsolationModeTraderBase__factory 
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, setEtherBalance, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { createIsolationModeTraderProxy } from '@dolomite-exchange/modules-base/test/utils/dolomite';
import { createGmxV2Registry } from './utils/gmxv2';
import { CoreProtocol, getDefaultCoreProtocolConfigForGmxV2, setupCoreProtocol } from 'packages/base/test/utils/setup';
import { GMX_V2_CALLBACK_GAS_LIMIT } from '../src/gmx-v2-constructors';

describe('GmxV2IsolationModeTraderBase', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxV2Registry: GmxV2Registry;
  let trader: TestAsyncIsolationModeTraderBase;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfigForGmxV2());
    gmxV2Registry = await createGmxV2Registry(core, GMX_V2_CALLBACK_GAS_LIMIT);

    const implementation = await createContractWithAbi<TestAsyncIsolationModeTraderBase>(
      TestAsyncIsolationModeTraderBase__factory.abi,
      TestAsyncIsolationModeTraderBase__factory.bytecode,
      [core.tokens.weth.address],
    );
    const calldata = await implementation.populateTransaction.initialize(
      gmxV2Registry.address,
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
      expect(await trader.HANDLER_REGISTRY()).to.eq(gmxV2Registry.address);
      expect(await trader.callbackGasLimit()).to.eq(GMX_V2_CALLBACK_GAS_LIMIT);
      expect(await trader.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        trader.initialize(
          gmxV2Registry.address,
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
      await gmxV2Registry.connect(core.governance).ownerSetIsHandler(core.hhUser4.address, true);
      await trader.connect(core.hhUser4).testOnlyHandler();
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).testOnlyHandler(),
        `AsyncIsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
