import { BalanceCheckFlag } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BaseContract, BigNumber } from 'ethers';
import {
  CustomTestToken,
  GLPUnwrapperProxyV1,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
  WrappedTokenUserVaultV1,
} from '../../../src/types';
import { USDC_MARKET_ID, WETH_MARKET_ID, ZERO_BI } from '../../../src/utils/constants';
import { createContractWithAbi, createTestToken } from '../../../src/utils/dolomite-utils';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectProtocolBalance, expectThrow, expectTotalSupply, expectWalletBalance } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../utils/setup';
import { createGlpUnwrapperProxy, createWrappedTokenFactory } from './wrapped-token-utils';

const defaultAccountNumber = '0';
const borrowAccountNumber = '123';
const amountWei = BigNumber.from('2000000000000000000');
const otherAmountWei = BigNumber.from('10000000'); // $10

describe('WrappedTokenUserVaultV1', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let tokenUnwrapper: GLPUnwrapperProxyV1;
  let wrappedTokenFactory: TestWrappedTokenUserVaultFactory;
  let userVaultImplementation: BaseContract;
  let userVault: TestWrappedTokenUserVaultV1;

  let solidAccount: SignerWithAddress;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
    });
    underlyingToken = await createTestToken();
    userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    wrappedTokenFactory = await createWrappedTokenFactory(underlyingToken, userVaultImplementation);
    await core.testPriceOracle.setPrice(
      wrappedTokenFactory.address,
      '1000000000000000000', // $1.00
    );

    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, wrappedTokenFactory);

    tokenUnwrapper = await createGlpUnwrapperProxy(wrappedTokenFactory);
    await wrappedTokenFactory.initialize([tokenUnwrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(wrappedTokenFactory.address, true);

    solidAccount = core.hhUser5;

    await wrappedTokenFactory.createVault(core.hhUser1.address);
    const vaultAddress = await wrappedTokenFactory.getVaultByAccount(core.hhUser1.address);
    userVault = await setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
      vaultAddress,
      TestWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );

    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(vaultAddress, amountWei);

    otherMarketId = BigNumber.from(USDC_MARKET_ID);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('basic read functions', () => {
    it('should work', async () => {
      expect(await userVault.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
      expect(await userVault.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await userVault.BORROW_POSITION_PROXY()).to.eq(core.borrowPositionProxyV2.address);
      expect(await userVault.VAULT_FACTORY()).to.eq(wrappedTokenFactory.address);
      expect(await userVault.marketId()).to.eq(underlyingMarketId);
    });
  });

  describe('#depositIntoVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, wrappedTokenFactory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);

      await expectTotalSupply(wrappedTokenFactory, amountWei);
    });

    it('should work when interacted with via factory', async () => {
      const factorySigner = await impersonate(wrappedTokenFactory.address, true);
      await userVault.connect(factorySigner).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, amountWei);

      await expectWalletBalance(core.dolomiteMargin, wrappedTokenFactory, amountWei);
      await expectWalletBalance(userVault, underlyingToken, amountWei);
      await expectWalletBalance(core.hhUser1, underlyingToken, ZERO_BI);

      await expectTotalSupply(wrappedTokenFactory, amountWei);
    });

    it('should fail when toAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.depositIntoVaultForDolomiteMargin('1', amountWei),
        'WrappedTokenUserVaultV1: Invalid toAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner or factory can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#withdrawFromVaultForDolomiteMargin', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1.address, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);

      await expectWalletBalance(core.dolomiteMargin, wrappedTokenFactory, ZERO_BI);
      await expectWalletBalance(userVault, underlyingToken, ZERO_BI);
      await expectWalletBalance(core.hhUser1, underlyingToken, amountWei);

      await expectTotalSupply(wrappedTokenFactory, ZERO_BI);
    });

    it('should fail when fromAccountNumber is not 0', async () => {
      await expectThrow(
        userVault.withdrawFromVaultForDolomiteMargin('1', amountWei),
        'WrappedTokenUserVaultV1: Invalid fromAccountNumber <1>',
      );
    });

    it('should fail when not sent by vault owner nor factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).withdrawFromVaultForDolomiteMargin(defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#openBorrowPosition', () => {
    it('should work normally', async () => {
      await userVault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);

      await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, defaultAccountNumber, underlyingMarketId, ZERO_BI);
      await expectProtocolBalance(core, userVault, borrowAccountNumber, underlyingMarketId, amountWei);
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.openBorrowPosition(defaultAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithUnderlyingVaultToken', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, defaultAccountNumber),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(defaultAccountNumber, borrowAccountNumber),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.closeBorrowPositionWithUnderlyingVaultToken(borrowAccountNumber, borrowAccountNumber),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#closeBorrowPositionWithOtherTokens', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).closeBorrowPositionWithOtherTokens(
          borrowAccountNumber,
          defaultAccountNumber,
          [otherMarketId],
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferIntoPositionWithUnderlyingToken', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferIntoPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when fromAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid fromAccountNumber <${borrowAccountNumber}>`,
      );
    });

    it('should fail when borrowAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferIntoPositionWithUnderlyingToken(defaultAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });
  });

  describe('#transferIntoPositionWithOtherToken', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferIntoPositionWithOtherToken(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#transferFromPositionWithUnderlyingToken', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2)
          .transferFromPositionWithUnderlyingToken(borrowAccountNumber, defaultAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when borrowAccountNumber != 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(defaultAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid borrowAccountNumber <${defaultAccountNumber}>`,
      );
    });

    it('should fail when toAccountNumber == 0', async () => {
      await expectThrow(
        userVault.transferFromPositionWithUnderlyingToken(borrowAccountNumber, borrowAccountNumber, amountWei),
        `WrappedTokenUserVaultV1: Invalid toAccountNumber <${borrowAccountNumber}>`,
      );
    });
  });

  describe('#transferFromPositionWithOtherToken', () => {
    it('should work when no allowable debt market is set (all are allowed then)', async () => {
      await wrappedTokenFactory.setAllowablePositionMarketIds([]);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
    });

    it('should work when 1 allowable debt market is set', async () => {
      await wrappedTokenFactory.setAllowablePositionMarketIds([otherMarketId]);
      await userVault.openBorrowPosition(defaultAccountNumber, borrowAccountNumber, amountWei);
      await userVault.transferFromPositionWithOtherToken(
        borrowAccountNumber,
        defaultAccountNumber,
        otherMarketId,
        otherAmountWei,
        BalanceCheckFlag.Both,
      );
    });

    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });

    it('should fail when an invalid debt market is used', async () => {
      await wrappedTokenFactory.setAllowablePositionMarketIds([WETH_MARKET_ID]);
      await expectThrow(
        userVault.transferFromPositionWithOtherToken(
          borrowAccountNumber,
          defaultAccountNumber,
          otherMarketId,
          otherAmountWei,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Market not allowed as debt <${otherMarketId}>`,
      );
    });
  });

  describe('#repayAllForBorrowPosition', () => {
    it('should fail when not called by owner', async () => {
      await expectThrow(
        userVault.connect(core.hhUser2).repayAllForBorrowPosition(
          defaultAccountNumber,
          borrowAccountNumber,
          otherMarketId,
          BalanceCheckFlag.Both,
        ),
        `WrappedTokenUserVaultV1: Only owner can call <${core.hhUser2.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeDepositIntoVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeDepositIntoVault(amountWei),
        `WrappedTokenUserVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#executeWithdrawalFromVault', () => {
    it('should fail when not called by factory', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).executeWithdrawalFromVault(core.hhUser1.address, amountWei),
        `WrappedTokenUserVaultV1: Only factory can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#onLiquidate', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        userVault.connect(core.hhUser1).onLiquidate(
          userVault.address,
          underlyingMarketId,
          { sign: false, value: amountWei },
          otherMarketId,
          { sign: true, value: otherAmountWei },
        ),
        `WrappedTokenUserVaultV1: Only Dolomite can call <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#callFunction', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      it('should fail if not called by DolomiteMargin', async () => {
        await expectThrow(
          userVault.connect(core.hhUser1).onLiquidate(
            userVault.address,
            underlyingMarketId,
            { sign: false, value: amountWei },
            otherMarketId,
            { sign: true, value: otherAmountWei },
          ),
          `WrappedTokenUserVaultV1: Only Dolomite can call <${core.hhUser1.address.toLowerCase()}>`,
        );
      });
    });
  });
});
