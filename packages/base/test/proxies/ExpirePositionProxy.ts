import { BalanceCheckFlag } from '@dolomite-exchange/dolomite-margin';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ExpirePositionProxy, ExpirePositionProxy__factory } from 'packages/base/src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
} from 'packages/base/src/utils/dolomite-utils';
import { Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectThrow } from '../utils/assertions';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import {
  disableInterestAccrual,
  setupCoreProtocol,
  setupWETHBalance,
} from '../utils/setup';
import { AccountInfoStruct } from 'packages/base/src/utils';

const defaultAccountNumber = ZERO_BI;
const borrowAccountNumber = BigNumber.from('123');
const usdcAmount = BigNumber.from('100000000');
const daiAmount = parseEther('100');
const expirationTimestamp = BigNumber.from('1777900000');

describe('ExpirePositionProxy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let expirePositionProxy: ExpirePositionProxy;

  let account1: AccountInfoStruct;
  let account2: AccountInfoStruct;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 459_300_000,
    });

    await disableInterestAccrual(core, core.marketIds.weth);
    await disableInterestAccrual(core, core.marketIds.usdc);
    await disableInterestAccrual(core, core.marketIds.dai);

    expirePositionProxy = await createContractWithAbi<ExpirePositionProxy>(
      ExpirePositionProxy__factory.abi,
      ExpirePositionProxy__factory.bytecode,
      [core.expiry.address, core.dolomiteMargin.address]
    );

    await setupWETHBalance(core, core.hhUser1, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.usdc,
      usdcAmount,
      BalanceCheckFlag.None
    );
    await core.borrowPositionProxyV2.connect(core.hhUser1).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.dai,
      daiAmount,
      BalanceCheckFlag.None
    );

    await setupWETHBalance(core, core.hhUser2, ONE_ETH_BI, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.usdc,
      usdcAmount,
      BalanceCheckFlag.None
    );
    await core.borrowPositionProxyV2.connect(core.hhUser2).transferBetweenAccounts(
      borrowAccountNumber,
      defaultAccountNumber,
      core.marketIds.dai,
      daiAmount,
      BalanceCheckFlag.None
    );

    await expectProtocolBalance(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(usdcAmount));
    await expectProtocolBalance(core, core.hhUser1, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(daiAmount).add(ONE_BI));
    await expectProtocolBalance(core, core.hhUser2, defaultAccountNumber, core.marketIds.usdc, usdcAmount);
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.weth, ONE_ETH_BI);
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.usdc, ZERO_BI.sub(usdcAmount));
    await expectProtocolBalance(core, core.hhUser2, borrowAccountNumber, core.marketIds.dai, ZERO_BI.sub(daiAmount).add(ONE_BI));

    await core.dolomiteMargin.ownerSetGlobalOperator(expirePositionProxy.address, true);

    account1 = { owner: core.hhUser1.address, number: borrowAccountNumber };
    account2 = { owner: core.hhUser2.address, number: borrowAccountNumber };

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await expirePositionProxy.EXPIRY()).to.equal(core.expiry.address);
      expect(await expirePositionProxy.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
    });
  });

  describe('#expirePositions', () => {
    it('should work normally with 1 position with 1 market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        }
      ];
      await expirePositionProxy.connect(core.governance).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
    });

    it('should work normally with 1 position and multiple markets', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        }
      ];
      await expirePositionProxy.connect(core.governance).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account1, core.marketIds.dai)).to.eq(expirationTimestamp);
    });

    it('should work normally with multiple positions with 1 market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        },
        {
          expirationTimestamp,
          account: account2,
          owedMarkets: [core.marketIds.usdc],
        }
      ];
      await expirePositionProxy.connect(core.governance).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.usdc)).to.eq(expirationTimestamp);
    });

    it('should work normally with multiple positions with multiple market', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        },
        {
          expirationTimestamp,
          account: account2,
          owedMarkets: [core.marketIds.usdc, core.marketIds.dai],
        }
      ];
      await expirePositionProxy.connect(core.governance).expirePositions(positions);

      expect(await core.expiry.getExpiry(account1, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account1, core.marketIds.dai)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.usdc)).to.eq(expirationTimestamp);
      expect(await core.expiry.getExpiry(account2, core.marketIds.dai)).to.eq(expirationTimestamp);
    });

    it('should fail if not called by dolomite margin owner', async () => {
      const positions = [
        {
          expirationTimestamp,
          account: account1,
          owedMarkets: [core.marketIds.usdc],
        }
      ];
      await expectThrow(
        expirePositionProxy.connect(core.hhUser4).expirePositions(positions),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser4.address.toLowerCase()}>`
      );
    });
  });
});
