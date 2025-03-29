import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { AccountInfoStruct } from 'packages/base/src/utils';
import {
  DolomiteERC4626WithPayable,
  IWETH,
  TestDolomiteERC4626WithPayable,
  TestDolomiteERC4626WithPayable__factory,
} from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from '../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry, createDolomiteErc4626WithPayableProxy } from '../utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getDolomiteErc4626ImplementationConstructorParams } from '../../src/utils/constructors/dolomite';

const wethAmount = parseEther('1');
const isolationModeVault = '0xffa18b366fa3ebE5832a49535F42aa0c93c791eF';

describe('DolomiteERC4626WithPayable', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let token: TestDolomiteERC4626WithPayable;
  let asset: IWETH;
  let accountInfo: AccountInfoStruct;
  let parValue: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 220_664_500,
    });
    core.implementationContracts.dolomiteERC4626WithPayableImplementation =
      await createContractWithAbi<TestDolomiteERC4626WithPayable>(
        TestDolomiteERC4626WithPayable__factory.abi,
        TestDolomiteERC4626WithPayable__factory.bytecode,
        await getDolomiteErc4626ImplementationConstructorParams(core),
      );
    const tokenProxy = await createDolomiteErc4626WithPayableProxy(core.marketIds.weth, core);
    token = TestDolomiteERC4626WithPayable__factory.connect(tokenProxy.address, core.hhUser1);
    asset = core.tokens.weth;

    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry
      .connect(core.governance)
      .ownerSetDolomiteAccountRegistry(core.dolomiteAccountRegistryProxy.address);

    await disableInterestAccrual(core, core.marketIds.weth);
    await setupWETHBalance(core, core.hhUser1, wethAmount.mul(10), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.weth, wethAmount);
    await core.dolomiteMargin.ownerSetGlobalOperator(token.address, true);

    accountInfo = { owner: core.hhUser1.address, number: ZERO_BI };
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
      expect(await token.asset()).to.eq(core.tokens.weth.address);
    });

    it('should not be callable again', async () => {
      await expectThrow(token.initialize('Dolomite: WETH', 'dWETH', 18, 0));
    });
  });

  describe('#depositFromPayable', () => {
    it('should work normally', async () => {
      expect(
        await token.connect(core.hhUser1).callStatic.depositFromPayable(core.hhUser2.address, { value: wethAmount }),
      ).to.eq(parValue);
      const result = await token.connect(core.hhUser1).depositFromPayable(core.hhUser2.address, { value: wethAmount });
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });

      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.weth, wethAmount);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).depositFromPayable(core.hhUser1.address, { value: ZERO_BI }),
        'DolomiteERC4626WithPayable: Invalid amount',
      );
    });

    it('should fail if receiver is invalid', async () => {
      await expectThrow(
        token.connect(core.hhUser1).depositFromPayable(isolationModeVault, { value: wethAmount }),
        `DolomiteERC4626WithPayable: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });
  });

  describe('#redeemToPayable', () => {
    it('should work normally', async () => {
      expect(await token.previewRedeem(parValue)).to.eq(wethAmount);

      const result = await token
        .connect(core.hhUser1)
        .redeemToPayable(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(Promise.resolve(result)).to.changeEtherBalance(core.hhUser1, wethAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await token
        .connect(core.hhUser1)
        .redeemToPayable(parValue, core.hhUser2.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await ethers.provider.getBalance(core.hhUser2.address)).to.eq(parseEther(`${10_001}`));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token
        .connect(core.hhUser2)
        .redeemToPayable(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser1, wethAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token
        .connect(core.hhUser2)
        .redeemToPayable(parValue, core.hhUser3.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser3, wethAmount);
      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        token.connect(core.hhUser2).redeemToPayable(parValue, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).redeemToPayable(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626WithPayable: Invalid amount',
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.redeemToPayable(
        parValue,
        core.hhUser1.address,
        core.hhUser1.address,
      );
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#withdrawToPayable', () => {
    it('should work normally', async () => {
      expect(await token.previewWithdraw(wethAmount)).to.eq(parValue);
      const result = await token
        .connect(core.hhUser1)
        .withdrawToPayable(wethAmount, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser1, wethAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await token
        .connect(core.hhUser1)
        .withdrawToPayable(wethAmount, core.hhUser2.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser1, ZERO_BI);
      await expect(result).to.changeEtherBalance(core.hhUser2, wethAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token
        .connect(core.hhUser2)
        .withdrawToPayable(wethAmount, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser1, wethAmount);
      await expect(result).to.changeEtherBalance(core.hhUser2, ZERO_BI);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token
        .connect(core.hhUser2)
        .withdrawToPayable(wethAmount, core.hhUser3.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: wethAmount,
        shares: parValue,
      });

      await expect(result).to.changeEtherBalance(core.hhUser1, ZERO_BI);
      await expect(result).to.changeEtherBalance(core.hhUser2, ZERO_BI);
      await expect(result).to.changeEtherBalance(core.hhUser3, wethAmount);

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(wethAmount.mul(9));
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(ZERO_BI);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser3.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.weth, ZERO_BI);
    });

    it('should fail if owner has negative (or zero) balance', async () => {
      await expectThrow(
        token.connect(core.hhUser2).withdrawToPayable(wethAmount, core.hhUser4.address, core.hhUser4.address),
        'DolomiteERC4626WithPayable: Balance cannot be negative',
      );
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        token.connect(core.hhUser2).withdrawToPayable(wethAmount, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).withdrawToPayable(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626WithPayable: Invalid amount',
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.withdrawToPayable(
        wethAmount,
        core.hhUser1.address,
        core.hhUser1.address,
      );
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });
});
