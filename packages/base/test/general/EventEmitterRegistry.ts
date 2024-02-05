import { BYTES_EMPTY, BYTES_ZERO, Network, ONE_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { EventEmitterRegistry, IIsolationModeVaultFactory, IIsolationModeVaultFactory__factory } from '../../src/types';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol } from '../utils/setup';
import { createEventEmitter } from '../utils/dolomite';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { expectEvent, expectThrow } from '../utils/assertions';
import { GenericTraderParamStruct } from 'packages/base/src/utils';

describe('EventEmitterRegistry', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let eventEmitter: EventEmitterRegistry;
  let factory: IIsolationModeVaultFactory;
  let defaultAccountOwner: SignerWithAddress;
  let defaultAccountNumber: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(core.hhUser5.address, true);
    factory = await IIsolationModeVaultFactory__factory.connect(
      core.tokens.dArb!.address,
      core.governance
    );
    await factory.ownerSetIsTokenConverterTrusted(core.hhUser5.address, true);

    eventEmitter = await createEventEmitter(core);
    defaultAccountOwner = core.hhUser1;
    defaultAccountNumber = ZERO_BI;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should fail when called again', async () => {
      await expectThrow(
        eventEmitter.initialize(),
        'Initializable: contract is already initialized'
      );
    });
  });

  describe('#emitZapExecuted', () => {
    it('should work normally', async () => {
      const marketIdsPath : any[] = [];
      const tradersPath : GenericTraderParamStruct[] = [{
        traderType: 0,
        makerAccountIndex: 0,
        trader: core.hhUser2.address,
        tradeData: '0x',
      }];
      const result = await eventEmitter.connect(core.hhUser5).emitZapExecuted(
        defaultAccountOwner.address,
        defaultAccountNumber,
        marketIdsPath,
        tradersPath
      );
      await expectEvent(eventEmitter, result, 'ZapExecuted', {});
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitZapExecuted(
          defaultAccountOwner.address,
          defaultAccountNumber,
          [],
          [{
            traderType: 0,
            makerAccountIndex: 0,
            trader: core.hhUser2.address,
            tradeData: '0x',
          }]
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitBorrowPositionOpen', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitBorrowPositionOpen(
        defaultAccountOwner.address,
        defaultAccountNumber
      );
      await expectEvent(eventEmitter, result, 'BorrowPositionOpen', {});
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitBorrowPositionOpen(
          defaultAccountOwner.address,
          defaultAccountNumber
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitMarginPositionOpen', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitMarginPositionOpen(
        defaultAccountOwner.address,
        defaultAccountNumber,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        core.tokens.weth.address,
        { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
        { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
        { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
      );
      await expectEvent(eventEmitter, result, 'MarginPositionOpen', {});
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitMarginPositionOpen(
          defaultAccountOwner.address,
          defaultAccountNumber,
          core.tokens.weth.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitMarginPositionClose', () => {
    it('should work normally', async () => {
      const balanceUpdate = { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } };
      const result = await eventEmitter.connect(core.hhUser5).emitMarginPositionClose(
        defaultAccountOwner.address,
        defaultAccountNumber,
        core.tokens.weth.address,
        core.tokens.usdc.address,
        core.tokens.weth.address,
        balanceUpdate,
        balanceUpdate,
        balanceUpdate,
      );
      await expectEvent(eventEmitter, result, 'MarginPositionClose', {});
    });

    it('should fail if not called by global operator', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitMarginPositionClose(
          defaultAccountOwner.address,
          defaultAccountNumber,
          core.tokens.weth.address,
          core.tokens.usdc.address,
          core.tokens.weth.address,
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
          { deltaWei: { sign: true, value: ZERO_BI }, newPar: { sign: true, value: ZERO_BI } },
        ),
        `OnlyDolomiteMargin: Caller is not a global operator <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositCreated', async () => {
    it('should work normally', async () => {
      const deposit = {
        key: BYTES_ZERO,
        vault: defaultAccountOwner.address,
        accountNumber: defaultAccountNumber,
        inputToken: factory.address,
        inputAmount: ONE_BI,
        outputAmount: ONE_BI,
        isRetryable: false
      };
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositCreated(
        BYTES_ZERO,
        factory.address,
        deposit
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCreated', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      const deposit = {
        key: BYTES_ZERO,
        vault: defaultAccountOwner.address,
        accountNumber: defaultAccountNumber,
        inputToken: factory.address,
        inputAmount: ONE_BI,
        outputAmount: ONE_BI,
        isRetryable: false
      };
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositCreated(
          BYTES_ZERO,
          factory.address,
          deposit
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositOutputAmountUpdated', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositOutputAmountUpdated(
        BYTES_ZERO,
        factory.address,
        ONE_BI
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositOutputAmountUpdated', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositOutputAmountUpdated(
          BYTES_ZERO,
          factory.address,
          ONE_BI
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositExecuted', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositExecuted(
        BYTES_ZERO,
        factory.address,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositExecuted', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositExecuted(
          BYTES_ZERO,
          factory.address,
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositFailed', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositFailed(
        BYTES_ZERO,
        factory.address,
        'Tuff'
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositFailed', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositFailed(
          BYTES_ZERO,
          factory.address,
          'Tuff'
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositCancelled', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositCancelled(
        BYTES_ZERO,
        factory.address,
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelled', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositCancelled(
          BYTES_ZERO,
          factory.address,
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncDepositCancelledFailed', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncDepositCancelledFailed(
        BYTES_ZERO,
        factory.address,
        'Tuff'
      );
      await expectEvent(eventEmitter, result, 'AsyncDepositCancelledFailed', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncDepositCancelledFailed(
          BYTES_ZERO,
          factory.address,
          'Tuff'
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncWithdrawalCreated', () => {
    it('should work normally', async () => {
      const withdrawal = {
        key: BYTES_ZERO,
        vault: defaultAccountOwner.address,
        accountNumber: defaultAccountNumber,
        inputAmount: ONE_BI,
        outputToken: factory.address,
        outputAmount: ONE_BI,
        isRetryable: false,
        isLiquidation: false,
        extraData: BYTES_EMPTY
      };
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncWithdrawalCreated(
        BYTES_ZERO,
        factory.address,
        withdrawal
      );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalCreated', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      const withdrawal = {
        key: BYTES_ZERO,
        vault: defaultAccountOwner.address,
        accountNumber: defaultAccountNumber,
        inputAmount: ONE_BI,
        outputToken: factory.address,
        outputAmount: ONE_BI,
        isRetryable: false,
        isLiquidation: false,
        extraData: BYTES_EMPTY
      };
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncWithdrawalCreated(
          BYTES_ZERO,
          factory.address,
          withdrawal
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncWithdrawalOutputAmountUpdated', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncWithdrawalOutputAmountUpdated(
        BYTES_ZERO,
        factory.address,
        ONE_BI
      );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalOutputAmountUpdated', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncWithdrawalOutputAmountUpdated(
          BYTES_ZERO,
          factory.address,
          ONE_BI
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncWithdrawalExecuted', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncWithdrawalExecuted(
        BYTES_ZERO,
        factory.address,
      );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalExecuted', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncWithdrawalExecuted(
          BYTES_ZERO,
          factory.address,
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncWithdrawalFailed', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncWithdrawalFailed(
        BYTES_ZERO,
        factory.address,
        'Tuff'
      );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalFailed', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncWithdrawalFailed(
          BYTES_ZERO,
          factory.address,
          'Tuff'
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });

  describe('#emitAsyncWithdrawalCancelled', () => {
    it('should work normally', async () => {
      const result = await eventEmitter.connect(core.hhUser5).emitAsyncWithdrawalCancelled(
        BYTES_ZERO,
        factory.address,
      );
      await expectEvent(eventEmitter, result, 'AsyncWithdrawalCancelled', {});
    });

    it('should fail if not called by trusted token converter', async () => {
      await expectThrow(
        eventEmitter.connect(core.hhUser2).emitAsyncWithdrawalCancelled(
          BYTES_ZERO,
          factory.address,
        ),
        `EventEmitter: Caller is not a converter <${core.hhUser2.address.toLowerCase()}>`
      );
    });
  });
});
