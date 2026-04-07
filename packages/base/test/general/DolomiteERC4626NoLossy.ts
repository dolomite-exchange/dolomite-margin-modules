import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import {
  DolomiteERC4626NoLossy,
  DolomiteERC4626NoLossy__factory,
  IERC20,
  TestDolomiteERC20User,
  TestDolomiteERC20User__factory,
} from '../../src/types';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from '../../src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_BI,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '../utils';
import {
  expectEvent,
  expectProtocolBalance,
  expectThrow,
} from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteErc4626Proxy } from '../utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance, setupWETHBalance } from '../utils/setup';
import { parseEther } from 'ethers/lib/utils';

const usdcAmount = BigNumber.from('100000000'); // 100 USDC
const isolationModeVault = '0xffa18b366fa3ebE5832a49535F42aa0c93c791eF';

describe('DolomiteERC4626NoLossy', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let dToken: DolomiteERC4626NoLossy;
  let asset: IERC20;

  let accountInfo: AccountInfoStruct;
  let accountInfo2: AccountInfoStruct;
  let parValue: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 449_715_000,
    });

    core.implementationContracts.dolomiteERC4626Implementation = await createContractWithAbi<DolomiteERC4626NoLossy>(
      DolomiteERC4626NoLossy__factory.abi,
      DolomiteERC4626NoLossy__factory.bytecode,
      [core.config.network, core.dolomiteRegistry.address, core.dolomiteMargin.address]
    );
    const tokenProxy = await createDolomiteErc4626Proxy(core.marketIds.usdc, core);
    dToken = DolomiteERC4626NoLossy__factory.connect(tokenProxy.address, core.hhUser1);
    asset = core.tokens.usdc;

    await core.dolomiteMargin.ownerSetGlobalOperator(dToken.address, true);

    await disableInterestAccrual(core, core.marketIds.usdc);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await setupUSDCBalance(core, core.hhUser2, usdcAmount, dToken);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, usdcAmount);

    accountInfo = { owner: core.hhUser1.address, number: ZERO_BI };
    accountInfo2 = { owner: core.hhUser2.address, number: ZERO_BI };
    parValue = (await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value;

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#initialize', () => {
    it('should work normally', async () => {
      expect(await dToken.name()).to.eq('Dolomite: USDC');
      expect(await dToken.symbol()).to.eq('dUSDC');
      expect(await dToken.decimals()).to.eq(6);
      expect(await dToken.marketId()).to.eq(core.marketIds.usdc);
      expect(await dToken.asset()).to.eq(core.tokens.usdc.address);
    });

    it('should not be callable again', async () => {
      await expectThrow(dToken.initialize('', '', 18, 0));
    });
  });

  describe('#maxDeposit', () => {
    it('should work normally', async () => {
      const assets = await dToken.totalAssets();
      const maxSupplyWei = BigNumber.from((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.usdc)).value);
      expect(await dToken.maxDeposit(core.hhUser1.address)).to.eq(maxSupplyWei.sub(assets));

      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(
        core.marketIds.usdc,
        assets.add(usdcAmount),
      );
      expect(await dToken.maxDeposit(core.hhUser1.address)).to.eq(usdcAmount);

      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(core.marketIds.usdc, 1);
      expect(await dToken.maxDeposit(core.hhUser1.address)).to.eq(0);
    });
  });

  describe('#deposit', () => {
    it('should work normally', async () => {
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await dToken.previewDeposit(usdcAmount)).to.eq(parValue);

      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount);
      const result = await dToken.connect(core.hhUser2).deposit(usdcAmount, core.hhUser2.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should work normally if user already has a balance', async () => {
      const parResult = await dToken.previewDeposit(usdcAmount.div(2));
      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount.div(2));
      const result = await dToken.connect(core.hhUser2).deposit(usdcAmount.div(2), core.hhUser2.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parResult,
      });
      await expectEvent(dToken, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount.div(2),
        shares: parResult,
      });

      const parResult2 = await dToken.previewDeposit(usdcAmount.div(2));
      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount.div(2));
      const result2 = await dToken.connect(core.hhUser2).deposit(usdcAmount.div(2), core.hhUser2.address);
      await expectEvent(dToken, result2, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parResult2,
      });
      await expectEvent(dToken, result2, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount.div(2),
        shares: parResult2, // rounding error
      });
    });

    it('should work normally with different recipient', async () => {
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount);
      const result = await dToken.connect(core.hhUser2).deposit(usdcAmount, core.hhUser3.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser3.address,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser3.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await dToken.balanceOf(core.hhUser3.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser3, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if user has negative balance', async () => {
      await setupWETHBalance(core, core.hhUser2, ONE_ETH_BI, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.hhUser2, ZERO_BI, core.marketIds.weth, ONE_ETH_BI);
      await withdrawFromDolomiteMargin(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, ONE_BI);

      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount);
      await expectThrow(
        dToken.connect(core.hhUser2).deposit(usdcAmount, core.hhUser2.address),
        'DolomiteERC4626: Balance cannot be negative',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).deposit(ZERO_BI, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount',
      );
    });

    it('should fail if receiver is invalid', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).deposit(usdcAmount, isolationModeVault),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });

    xit('should fail if reentered', async () => {
      const transaction = await dToken.populateTransaction.deposit(usdcAmount, core.hhUser1.address);
      await expectThrow(
        dToken.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#maxMint', () => {
    it('should work normally', async () => {
      const assets = await dToken.totalAssets();
      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(
        core.marketIds.usdc,
        assets.add(usdcAmount.sub(1)),
      );

      expect(await dToken.maxMint(core.hhUser1.address)).to.eq(parValue.sub(1));
      await expectThrow(
        dToken.connect(core.hhUser2).mint(parValue, core.hhUser2.address),
        'OperationImpl: Total supply exceeds max supply <2>',
      );

      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(
        core.marketIds.usdc,
        assets.add(usdcAmount),
      );
      await dToken.connect(core.hhUser2).mint(parValue, core.hhUser2.address);

      await core.dolomiteMargin.connect(core.governance).ownerSetMaxWei(core.marketIds.usdc, 1);
      expect(await dToken.maxMint(core.hhUser1.address)).to.eq(0);
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await dToken.previewMint(parValue)).to.eq(usdcAmount);

      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount);
      const result = await dToken.connect(core.hhUser2).mint(parValue, core.hhUser2.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should work normally with different recipient', async () => {
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      await asset.connect(core.hhUser2).approve(dToken.address, usdcAmount);
      const result = await dToken.connect(core.hhUser2).mint(parValue, core.hhUser3.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser3.address,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser3.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await dToken.balanceOf(core.hhUser3.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser3, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).mint(ZERO_BI, ADDRESS_ZERO),
        'DolomiteERC4626: Invalid amount',
      );
    });

    it('should fail if receiver is invalid', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).mint(parValue, isolationModeVault),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });

    xit('should fail if reentered', async () => {
      const transaction = await dToken.populateTransaction.mint(parValue, core.hhUser1.address);
      await expectThrow(
        dToken.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#maxWithdraw', () => {
    it('should work normally', async () => {
      expect(await dToken.maxWithdraw(core.hhUser1.address)).to.eq(usdcAmount);
    });
  });

  describe('#withdraw', () => {
    it('should work normally', async () => {
      expect(await dToken.previewWithdraw(usdcAmount)).to.eq(parValue);
      const result = await dToken.connect(core.hhUser1).withdraw(
        usdcAmount,
        core.hhUser1.address,
        core.hhUser1.address
      );
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await dToken.connect(core.hhUser1).withdraw(
        usdcAmount,
        core.hhUser2.address,
        core.hhUser1.address
      );
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(usdcAmount.mul(2));
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await dToken.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await dToken.connect(core.hhUser2).withdraw(
        usdcAmount,
        core.hhUser1.address,
        core.hhUser1.address
      );
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await dToken.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await dToken.connect(core.hhUser2).withdraw(
        usdcAmount,
        core.hhUser3.address,
        core.hhUser1.address
      );
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(usdcAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should fail if owner has negative (or zero) balance', async () => {
      await expectThrow(
        dToken.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser4.address, core.hhUser4.address),
        'DolomiteERC4626: Balance cannot be negative',
      );
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        dToken.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).withdraw(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount',
      );
    });

    xit('should fail if reentered', async () => {
      const transaction = await dToken.populateTransaction.withdraw(
        usdcAmount,
        core.hhUser1.address,
        core.hhUser1.address,
      );
      await expectThrow(
        dToken.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#maxRedeem', () => {
    it('should work normally', async () => {
      expect(await dToken.maxRedeem(core.hhUser1.address)).to.eq(parValue);
    });
  });

  describe('#redeem', () => {
    it('should work normally', async () => {
      expect(await dToken.previewRedeem(parValue)).to.eq(usdcAmount);
      const result = await dToken.connect(core.hhUser1).redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await dToken.connect(core.hhUser1).redeem(parValue, core.hhUser2.address, core.hhUser1.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(usdcAmount.mul(2));
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await dToken.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await dToken.connect(core.hhUser2).redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await dToken.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await dToken.connect(core.hhUser2).redeem(parValue, core.hhUser3.address, core.hhUser1.address);
      await expectEvent(dToken, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(dToken, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(usdcAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        dToken.connect(core.hhUser2).redeem(parValue, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).redeem(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount',
      );
    });

    xit('should fail if reentered', async () => {
      const transaction = await dToken.populateTransaction.redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectThrow(
        dToken.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call',
      );
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      const result = await dToken.connect(core.hhUser1).transfer(core.hhUser2.address, parValue);

      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should work normally', async () => {
      await setEtherBalance(core.governance.address, parseEther('100'));
      await setupUSDCBalance(core, core.governance, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, core.governance, ZERO_BI, core.marketIds.usdc, usdcAmount);

      const transferAmount = parValue.div(3);
      await dToken.connect(core.hhUser1).transfer(core.hhUser2.address, transferAmount);

      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(parValue.sub(transferAmount));
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(transferAmount);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value)
        .to.eq(parValue.sub(transferAmount));
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value)
        .to.eq(transferAmount);
    });

    it('should work for different receivers', async () => {
      const doloErc20User = await createContractWithAbi<TestDolomiteERC20User>(
        TestDolomiteERC20User__factory.abi,
        TestDolomiteERC20User__factory.bytecode,
        [dToken.address],
      );
      expect(await dToken.isValidReceiver(core.hhUser2.address)).to.be.true;
      expect(await dToken.isValidReceiver(doloErc20User.address)).to.be.true;

      await dToken.connect(core.hhUser1).transfer(core.hhUser2.address, parValue);
      await dToken.connect(core.hhUser2).transfer(doloErc20User.address, parValue);

      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(doloErc20User.address)).to.eq(parValue);
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        dToken.connect(zeroImpersonator).transfer(core.hhUser2.address, 0),
        'DolomiteERC4626: Transfer from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(dToken.transfer(ADDRESS_ZERO, 100), 'DolomiteERC4626: Transfer to the zero address');
    });

    it('should fail if to the contract', async () => {
      await expectThrow(
        dToken.connect(core.hhUser1).transfer(dToken.address, parValue),
        'DolomiteERC4626: Transfer to this contract',
      );
    });

    it('should fail if amount is greater than balance', async () => {
      await expectThrow(
        dToken.transfer(core.hhUser2.address, parValue.add(1)),
        'DolomiteERC4626: Transfer amount exceeds balance',
      );
    });

    it('should fail if invalid receiver', async () => {
      await core.dolomiteAccountRegistry.connect(core.governance).ownerSetRestrictedAccount(
        core.hhUser2.address,
        true,
      );
      await expectThrow(
        dToken.transfer(core.hhUser2.address, parValue),
        `DolomiteERC4626: Invalid receiver <${core.hhUser2.address.toLowerCase()}>`,
      );
      await expectThrow(
        dToken.transfer(isolationModeVault, parValue),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });
  });

  describe('#approve', () => {
    it('should work normally', async () => {
      await dToken.approve(core.hhUser2.address, 100);
      expect(await dToken.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(100);
    });

    it('should enable tx.origin & msg.sender', async () => {
      const doloErc20User = await createContractWithAbi<TestDolomiteERC20User>(
        TestDolomiteERC20User__factory.abi,
        TestDolomiteERC20User__factory.bytecode,
        [dToken.address],
      );

      await doloErc20User.connect(core.hhUser2).approve(core.hhUser2.address, parValue);
      expect(await dToken.isValidReceiver(core.hhUser2.address)).to.be.true;
      expect(await dToken.isValidReceiver(doloErc20User.address)).to.be.true;
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        dToken.connect(zeroImpersonator).approve(core.hhUser2.address, 150),
        'DolomiteERC4626: Approve from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(dToken.approve(ADDRESS_ZERO, 100), 'DolomiteERC4626: Approve to the zero address');
    });
  });

  describe('#transferFrom', () => {
    it('should work normally', async () => {
      await dToken.approve(core.hhUser2.address, parValue);
      await dToken.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue);

      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(parValue);
      expect(await dToken.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should work with infinite approval', async () => {
      await dToken.approve(core.hhUser2.address, MAX_UINT_256_BI);
      await dToken.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue);

      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(parValue);
      expect(await dToken.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(MAX_UINT_256_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should fail if not approved', async () => {
      await expectThrow(
        dToken.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, 50),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount greater than balance', async () => {
      await dToken.approve(core.hhUser2.address, parValue.add(1));
      await expectThrow(
        dToken.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue.add(1)),
        'DolomiteERC4626: Transfer amount exceeds balance',
      );
    });

    it('should fail if to zero address', async () => {
      await dToken.approve(core.hhUser2.address, parValue);
      await expectThrow(
        dToken.connect(core.hhUser2).transferFrom(core.hhUser1.address, ADDRESS_ZERO, parValue),
        'DolomiteERC4626: Transfer to the zero address',
      );
    });
  });

  describe('#balanceOf', () => {
    it('should work normally', async () => {
      expect(await dToken.balanceOf(core.hhUser1.address)).to.eq(parValue);
    });

    it('should return zero if no balance or negative balance', async () => {
      expect(await dToken.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
    });
  });

  describe('#totalSupply', () => {
    it('should work normally', async () => {
      const totalSupply = (await core.dolomiteMargin.getMarketTotalPar(core.marketIds.usdc)).supply;
      expect(await dToken.totalSupply()).to.eq(totalSupply);
    });
  });

  describe('#name', () => {
    it('should work normally', async () => {
      expect(await dToken.name()).to.eq('Dolomite: USDC');
    });
  });

  describe('#symbol', () => {
    it('should work normally', async () => {
      expect(await dToken.symbol()).to.eq('dUSDC');
    });
  });

  describe('#decimals', () => {
    it('should work normally', async () => {
      expect(await dToken.decimals()).to.eq(6);
    });
  });

  describe('#totalAssets', () => {
    it('should work normally', async () => {
      const totalSupply = (await core.dolomiteMargin.getMarketTotalPar(core.marketIds.usdc)).supply;
      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.usdc);

      // Can be one wei off due to rounding
      expect((await dToken.totalAssets()).toNumber()).to.approximately(
        totalSupply.mul(index.supply).div(ONE_ETH_BI).toNumber(),
        1,
      );
    });
  });
});
