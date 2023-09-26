import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { GmxRegistryV2, TestGmxV2IsolationModeTraderBase, TestGmxV2IsolationModeTraderBase__factory } from 'src/types';
import { createContractWithAbi } from 'src/utils/dolomite-utils';
import { Network, ONE_ETH_BI, ZERO_BI } from 'src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, setEtherBalance, snapshot } from 'test/utils';
import { expectEvent, expectThrow } from 'test/utils/assertions';
import { createIsolationModeTraderProxy } from 'test/utils/dolomite';
import { createGmxRegistryV2 } from 'test/utils/ecosystem-token-utils/gmx';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from 'test/utils/setup';

const CALLBACK_GAS_LIMIT = BigNumber.from('1500000');

describe('GmxV2IsolationModeTraderBase', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let gmxRegistryV2: GmxRegistryV2;
  let trader: TestGmxV2IsolationModeTraderBase;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    gmxRegistryV2 = await createGmxRegistryV2(core);

    const implementation = await createContractWithAbi<TestGmxV2IsolationModeTraderBase>(
      TestGmxV2IsolationModeTraderBase__factory.abi,
      TestGmxV2IsolationModeTraderBase__factory.bytecode,
      [],
    );
    const calldata = await implementation.populateTransaction.initialize(
      gmxRegistryV2.address,
      core.tokens.weth.address,
      CALLBACK_GAS_LIMIT,
      core.dolomiteMargin.address,
    );
    const proxy = await createIsolationModeTraderProxy(implementation.address, calldata.data!, core);
    trader = await TestGmxV2IsolationModeTraderBase__factory.connect(proxy.address, core.hhUser1);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should initialize correctly', async () => {
      expect(await trader.WETH()).to.eq(core.tokens.weth.address);
      expect(await trader.GMX_REGISTRY_V2()).to.eq(gmxRegistryV2.address);
      expect(await trader.callbackGasLimit()).to.eq(CALLBACK_GAS_LIMIT);
      expect(await trader.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });

    it('should not initialize twice', async () => {
      await expectThrow(
        trader.triggerInternalInitializer(
          gmxRegistryV2.address,
          core.tokens.weth.address,
          CALLBACK_GAS_LIMIT,
        ),
        'Initializable: contract is already initialized',
      );
    });
  });

  describe('#ownerSetIsHandler', () => {
    it('should work normally', async () => {
      const result = await trader.connect(core.governance).ownerSetIsHandler(
        core.gmxEcosystemV2!.gmxDepositHandler.address,
        true,
      );
      await expectEvent(trader, result, 'OwnerSetIsHandler', {
        handler: core.gmxEcosystemV2!.gmxDepositHandler.address,
        isTrusted: true,
      });

      expect(await trader.isHandler(core.gmxEcosystemV2!.gmxDepositHandler.address)).to.eq(true);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetIsHandler(core.gmxEcosystemV2!.gmxDepositHandler.address, true),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
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

  describe('#ownerSetCallbackGasLimit', () => {
    it('should work normally', async () => {
      await trader.connect(core.governance).ownerSetCallbackGasLimit(CALLBACK_GAS_LIMIT);
      expect(await trader.callbackGasLimit()).to.eq(CALLBACK_GAS_LIMIT);
    });

    it('should failed if not called by dolomite owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerSetCallbackGasLimit(ZERO_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#onlyHandler', () => {
    it('should work normally', async () => {
      await trader.connect(core.governance).ownerSetIsHandler(core.hhUser4.address, true);
      await trader.connect(core.hhUser4).testOnlyHandler();
    });

    it('should fail if not called by valid handler', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).testOnlyHandler(),
        `GmxV2IsolationModeTraderBase: Only handler can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
