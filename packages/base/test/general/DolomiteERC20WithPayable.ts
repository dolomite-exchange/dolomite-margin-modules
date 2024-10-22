import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import { DolomiteERC20WithPayable, DolomiteERC20WithPayable__factory, } from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI, } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteErc20Proxy } from '../utils/dolomite';
import {
  disableInterestAccrual,
  getDefaultCoreProtocolConfig,
  setupCoreProtocol,
  setupWETHBalance
} from '../utils/setup';
import { parseEther } from 'ethers/lib/utils';

const wethAmount = parseEther('1');

describe('DolomiteERC20WithPayable', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let token: DolomiteERC20WithPayable;
  let accountInfo: AccountInfoStruct;
  let accountInfo2: AccountInfoStruct;
  let parValue: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    const implementation = await createContractWithAbi<DolomiteERC20WithPayable>(
      DolomiteERC20WithPayable__factory.abi,
      DolomiteERC20WithPayable__factory.bytecode,
      [core.tokens.weth.address],
    );
    const tokenProxy = await createDolomiteErc20Proxy(implementation, core.marketIds.weth, core);
    token = DolomiteERC20WithPayable__factory.connect(tokenProxy.address, core.hhUser1);
    await token.initializeVersion2();

    await disableInterestAccrual(core, core.marketIds.weth);
    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(10), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.weth, wethAmount);
    await core.dolomiteMargin.ownerSetGlobalOperator(token.address, true);

    accountInfo = { owner: core.hhUser1.address, number: ZERO_BI };
    accountInfo2 = { owner: core.hhUser2.address, number: ZERO_BI };
    parValue = (await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.weth)).value;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await token.name()).to.eq('Dolomite: WETH');
      expect(await token.symbol()).to.eq('dWETH');
      expect(await token.decimals()).to.eq(18);
      expect(await token.marketId()).to.eq(core.marketIds.weth);
      expect(await token.underlyingToken()).to.eq(core.tokens.weth.address);
    });

    it('should not be callable again', async () => {
      await expectThrow(token.initialize('', '', 18, 0));
    });
  });

  describe('#initialize', () => {
    it('should not be callable again', async () => {
      await expectThrow(token.initializeVersion2());
    });
  });

  describe('#mintFromPayable', () => {
    it('should work normally', async () => {
      expect(await token.connect(core.hhUser1).callStatic.mintFromPayable({ value: wethAmount })).to.eq(parValue);
      const result = await token.connect(core.hhUser1).mintFromPayable({ value: wethAmount });
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser1.address,
        value: parValue,
      });

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue.mul(2));
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, wethAmount.mul(2));
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).mintFromPayable({ value: ZERO_BI }),
        'DolomiteERC20WithPayable: Invalid amount',
      );
    });
  });

  describe('#redeemToPayable', () => {
    it('should work normally', async () => {
      expect(await token.connect(core.hhUser1).callStatic.redeemToPayable(parValue)).to.eq(wethAmount);
      const result = await token.connect(core.hhUser1).redeemToPayable(parValue);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).redeemToPayable(ZERO_BI),
        'DolomiteERC20WithPayable: Invalid amount',
      );
    });
  });
});
