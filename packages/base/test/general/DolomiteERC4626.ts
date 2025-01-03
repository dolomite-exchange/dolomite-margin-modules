import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import {
  IERC20,
  TestDolomiteERC20User,
  TestDolomiteERC20User__factory,
  TestDolomiteERC4626,
  TestDolomiteERC4626__factory,
} from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, MAX_UINT_256_BI, Network, ONE_ETH_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectProtocolBalance, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry, createDolomiteErc4626Proxy } from '../utils/dolomite';
import { disableInterestAccrual, setupCoreProtocol, setupUSDCBalance } from '../utils/setup';

const usdcAmount = BigNumber.from('100000000'); // 100 USDC
const isolationModeVault = '0xffa18b366fa3ebE5832a49535F42aa0c93c791eF';

describe('DolomiteERC4626', () => {
  let snapshotId: string;
  let core: CoreProtocolArbitrumOne;
  let token: TestDolomiteERC4626;
  let asset: IERC20;
  let accountInfo: AccountInfoStruct;
  let accountInfo2: AccountInfoStruct;
  let parValue: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 220_664_500,
    });
    core.implementationContracts.dolomiteERC4626Implementation = await createContractWithAbi<TestDolomiteERC4626>(
      TestDolomiteERC4626__factory.abi,
      TestDolomiteERC4626__factory.bytecode,
      [],
    );
    const tokenProxy = await createDolomiteErc4626Proxy(core.marketIds.usdc, core);
    token = TestDolomiteERC4626__factory.connect(tokenProxy.address, core.hhUser1);
    asset = core.tokens.usdc;

    await createAndUpgradeDolomiteRegistry(core);
    await core.dolomiteRegistry
      .connect(core.governance)
      .ownerSetDolomiteAccountRegistry(core.dolomiteAccountRegistryProxy.address);

    await disableInterestAccrual(core, core.marketIds.usdc);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount, core.dolomiteMargin);
    await setupUSDCBalance(core, core.hhUser2, usdcAmount, token);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.ownerSetGlobalOperator(token.address, true);

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
      expect(await token.name()).to.eq('Dolomite: USDC');
      expect(await token.symbol()).to.eq('dUSDC');
      expect(await token.decimals()).to.eq(6);
      expect(await token.marketId()).to.eq(core.marketIds.usdc);
      expect(await token.asset()).to.eq(core.tokens.usdc.address);
    });

    it('should not be callable again', async () => {
      await expectThrow(token.initialize('', '', 18, 0, ADDRESS_ZERO));
    });
  });

  describe('#maxDeposit', () => {
    it('should work normally', async () => {
      expect(await token.maxDeposit(core.hhUser1.address)).to.eq(MAX_UINT_256_BI);

      const assets = await token.totalAssets();
      await core.dolomiteMargin.ownerSetMaxWei(core.marketIds.usdc, assets.add(usdcAmount));
      expect(await token.maxDeposit(core.hhUser1.address)).to.eq(usdcAmount);

      await core.dolomiteMargin.ownerSetMaxWei(core.marketIds.usdc, 1);
      expect(await token.maxDeposit(core.hhUser1.address)).to.eq(0);
    });
  });

  describe('#deposit', () => {
    it('should work normally', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await token.previewDeposit(usdcAmount)).to.eq(parValue);

      await asset.connect(core.hhUser2).approve(token.address, usdcAmount);
      const result = await token.connect(core.hhUser2).deposit(usdcAmount, core.hhUser2.address);
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });
      await expectEvent(token, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should work normally with different recipient', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      await asset.connect(core.hhUser2).approve(token.address, usdcAmount);
      const result = await token.connect(core.hhUser2).deposit(usdcAmount, core.hhUser3.address);
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser3.address,
        value: parValue,
      });
      await expectEvent(token, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser3.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await token.balanceOf(core.hhUser3.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser3, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).deposit(ZERO_BI, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount'
      );
    });

    it('should fail if receiver is invalid', async () => {
      await expectThrow(
        token.connect(core.hhUser1).deposit(usdcAmount, isolationModeVault),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.deposit(usdcAmount, core.hhUser1.address);
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#maxMint', () => {
    it('should work normally', async () => {
      expect(await token.maxMint(core.hhUser1.address)).to.eq(MAX_UINT_256_BI);

      const assets = await token.totalAssets();
      await core.dolomiteMargin.ownerSetMaxWei(core.marketIds.usdc, assets.add(usdcAmount));
      // Adding usdcAmount to assets is some reason one less
      expect(await token.maxMint(core.hhUser1.address)).to.eq(parValue.sub(1));
      await expectThrow(
        token.connect(core.hhUser2).mint(parValue, core.hhUser2.address),
        'OperationImpl: Total supply exceeds max supply <2>'
      );
      await token.connect(core.hhUser2).mint(parValue.sub(1), core.hhUser2.address);

      await core.dolomiteMargin.ownerSetMaxWei(core.marketIds.usdc, 1);
      expect(await token.maxMint(core.hhUser1.address)).to.eq(0);
    });
  });

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await token.previewMint(parValue)).to.eq(usdcAmount);

      await asset.connect(core.hhUser2).approve(token.address, usdcAmount);
      const result = await token.connect(core.hhUser2).mint(parValue, core.hhUser2.address);
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });
      await expectEvent(token, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser2.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should work normally with different recipient', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      await asset.connect(core.hhUser2).approve(token.address, usdcAmount);
      const result = await token.connect(core.hhUser2).mint(parValue, core.hhUser3.address);
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser3.address,
        value: parValue,
      });
      await expectEvent(token, result, 'Deposit', {
        sender: core.hhUser2.address,
        owner: core.hhUser3.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await token.balanceOf(core.hhUser3.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser3, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).mint(ZERO_BI, ADDRESS_ZERO),
        'DolomiteERC4626: Invalid amount'
      );
    });

    it('should fail if receiver is invalid', async () => {
      await expectThrow(
        token.connect(core.hhUser1).mint(parValue, isolationModeVault),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.mint(parValue, core.hhUser1.address);
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#maxWithdraw', () => {
    it('should work normally', async () => {
      expect(await token.maxWithdraw(core.hhUser1.address)).to.eq(usdcAmount);
    });
  });

  describe('#withdraw', () => {
    it('should work normally', async () => {
      expect(await token.previewWithdraw(usdcAmount)).to.eq(parValue);
      const result = await token.connect(core.hhUser1).withdraw(usdcAmount, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await token.connect(core.hhUser1).withdraw(usdcAmount, core.hhUser2.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(usdcAmount.mul(2));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser3.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue,
      });

      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(usdcAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should fail if owner has negative (or zero) balance', async () => {
      await expectThrow(
        token.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser4.address, core.hhUser4.address),
        'DolomiteERC4626: Balance cannot be negative',
      );
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        token.connect(core.hhUser2).withdraw(usdcAmount, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).withdraw(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.withdraw(
        usdcAmount,
        core.hhUser1.address,
        core.hhUser1.address
      );
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#maxRedeem', () => {
    it('should work normally', async () => {
      expect(await token.maxRedeem(core.hhUser1.address)).to.eq(parValue);
    });
  });

  describe('#redeem', () => {
    it('should work normally', async () => {
      expect(await token.previewRedeem(parValue)).to.eq(usdcAmount);
      const result = await token.connect(core.hhUser1).redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser1.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work with different receiver', async () => {
      const result = await token.connect(core.hhUser1).redeem(parValue, core.hhUser2.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await asset.balanceOf(core.hhUser2.address)).to.eq(usdcAmount.mul(2));
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token.connect(core.hhUser2).redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser1.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(usdcAmount);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should work for different owner and receiver', async () => {
      await token.connect(core.hhUser1).approve(core.hhUser2.address, parValue);
      const result = await token.connect(core.hhUser2).redeem(parValue, core.hhUser3.address, core.hhUser1.address);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });
      await expectEvent(token, result, 'Withdraw', {
        sender: core.hhUser2.address,
        receiver: core.hhUser3.address,
        owner: core.hhUser1.address,
        assets: usdcAmount,
        shares: parValue
      });

      expect(await asset.balanceOf(core.hhUser3.address)).to.eq(usdcAmount);
      expect(await asset.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should fail if owner has not approved the sender', async () => {
      await expectThrow(
        token.connect(core.hhUser2).redeem(parValue, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(
        token.connect(core.hhUser1).redeem(ZERO_BI, core.hhUser1.address, core.hhUser1.address),
        'DolomiteERC4626: Invalid amount'
      );
    });

    it('should fail if reentered', async () => {
      const transaction = await token.populateTransaction.redeem(parValue, core.hhUser1.address, core.hhUser1.address);
      await expectThrow(
        token.callFunctionAndTriggerReentrancy(transaction.data!),
        'ReentrancyGuardUpgradeable: Reentrant call'
      );
    });
  });

  describe('#transfer', () => {
    it('should work normally', async () => {
      await token.connect(core.hhUser1).transfer(core.hhUser2.address, parValue);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should work for different receivers', async () => {
      const doloErc20User = await createContractWithAbi<TestDolomiteERC20User>(
        TestDolomiteERC20User__factory.abi,
        TestDolomiteERC20User__factory.bytecode,
        [token.address],
      );
      expect(await token.isValidReceiver(core.hhUser2.address)).to.be.true;
      expect(await token.isValidReceiver(doloErc20User.address)).to.be.true;

      await token.connect(core.hhUser1).transfer(core.hhUser2.address, parValue);
      await token.connect(core.hhUser2).transfer(doloErc20User.address, parValue);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(doloErc20User.address)).to.eq(parValue);
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        token.connect(zeroImpersonator).transfer(core.hhUser2.address, 0),
        'DolomiteERC4626: Transfer from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(token.transfer(ADDRESS_ZERO, 100), 'DolomiteERC4626: Transfer to the zero address');
    });

    it('should fail if amount is greater than balance', async () => {
      await expectThrow(
        token.transfer(core.hhUser2.address, parValue.add(1)),
        'DolomiteERC4626: Transfer amount exceeds balance',
      );
    });

    it('should fail if invalid receiver', async () => {
      await core.dolomiteAccountRegistry.ownerSetRestrictedAccount(core.hhUser2.address, true);
      await expectThrow(
        token.transfer(core.hhUser2.address, parValue),
        `DolomiteERC4626: Invalid receiver <${core.hhUser2.address.toLowerCase()}>`,
      );
      await expectThrow(
        token.transfer(isolationModeVault, parValue),
        `DolomiteERC4626: Invalid receiver <${isolationModeVault.toLowerCase()}>`,
      );
    });
  });

  describe('#approve', () => {
    it('should work normally', async () => {
      await token.approve(core.hhUser2.address, 100);
      expect(await token.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(100);
    });

    it('should enable tx.origin & msg.sender', async () => {
      const doloErc20User = await createContractWithAbi<TestDolomiteERC20User>(
        TestDolomiteERC20User__factory.abi,
        TestDolomiteERC20User__factory.bytecode,
        [token.address],
      );

      await doloErc20User.connect(core.hhUser2).approve(core.hhUser2.address, parValue);
      expect(await token.isValidReceiver(core.hhUser2.address)).to.be.true;
      expect(await token.isValidReceiver(doloErc20User.address)).to.be.true;
    });

    it('should fail if from zero address', async () => {
      const zeroImpersonator = await impersonate(ADDRESS_ZERO, true);
      await expectThrow(
        token.connect(zeroImpersonator).approve(core.hhUser2.address, 150),
        'DolomiteERC4626: Approve from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(token.approve(ADDRESS_ZERO, 100), 'DolomiteERC4626: Approve to the zero address');
    });
  });

  describe('#transferFrom', () => {
    it('should work normally', async () => {
      await token.approve(core.hhUser2.address, parValue);
      await token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      expect(await token.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should work with infinite approval', async () => {
      await token.approve(core.hhUser2.address, MAX_UINT_256_BI);
      await token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      expect(await token.allowance(core.hhUser1.address, core.hhUser2.address)).to.eq(MAX_UINT_256_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value).to.eq(parValue);
    });

    it('should fail if not approved', async () => {
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, 50),
        'DolomiteERC4626: Insufficient allowance',
      );
    });

    it('should fail if amount greater than balance', async () => {
      await token.approve(core.hhUser2.address, parValue.add(1));
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue.add(1)),
        'DolomiteERC4626: Transfer amount exceeds balance',
      );
    });

    it('should fail if to zero address', async () => {
      await token.approve(core.hhUser2.address, parValue);
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, ADDRESS_ZERO, parValue),
        'DolomiteERC4626: Transfer to the zero address',
      );
    });
  });

  describe('#balanceOf', () => {
    it('should work normally', async () => {
      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue);
    });

    it('should return zero if no balance or negative balance', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);
    });
  });

  describe('#totalSupply', () => {
    it('should work normally', async () => {
      const totalSupply = (await core.dolomiteMargin.getMarketTotalPar(core.marketIds.usdc)).supply;
      expect(await token.totalSupply()).to.eq(totalSupply);
    });
  });

  describe('#name', () => {
    it('should work normally', async () => {
      expect(await token.name()).to.eq('Dolomite: USDC');
    });
  });

  describe('#symbol', () => {
    it('should work normally', async () => {
      expect(await token.symbol()).to.eq('dUSDC');
    });
  });

  describe('#decimals', () => {
    it('should work normally', async () => {
      expect(await token.decimals()).to.eq(6);
    });
  });

  describe('#totalAssets', () => {
    it('should work normally', async () => {
      const totalSupply = (await core.dolomiteMargin.getMarketTotalPar(core.marketIds.usdc)).supply;
      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.usdc);

      // Can be one wei off due to rounding
      expect((await token.totalAssets()).toNumber()).to.approximately(
        totalSupply.mul(index.supply).div(ONE_ETH_BI).toNumber(),
        1,
      );
    });
  });
});
