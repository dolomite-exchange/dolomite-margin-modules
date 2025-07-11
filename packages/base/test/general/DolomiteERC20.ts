import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { AccountInfoStruct } from 'packages/base/src/utils';
import {
  DolomiteERC20,
  DolomiteERC20__factory,
  TestDolomiteERC20User,
  TestDolomiteERC20User__factory,
} from '../../src/types';
import { createContractWithAbi, depositIntoDolomiteMargin } from '../../src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  MAX_UINT_256_BI,
  Network,
  ONE_DAY_SECONDS,
  ONE_ETH_BI,
  ZERO_BI,
} from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, setEtherBalance, snapshot } from '../utils';
import { expectEvent, expectNotEvent, expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createAndUpgradeDolomiteRegistry, createDolomiteErc20Proxy } from '../utils/dolomite';
import {
  disableInterestAccrual, enableInterestAccrual,
  getMaxDeploymentVersionAddressByDeploymentKey,
  setupCoreProtocol,
  setupUSDCBalance,
} from '../utils/setup';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { DolomiteOwnerV2 } from 'packages/admin/src/types';
import { createDolomiteOwnerV2 } from 'packages/admin/test/admin-ecosystem-utils';
import { Ownable__factory } from 'packages/liquidity-mining/src/types';
import { parseEther } from 'ethers/lib/utils';

const usdcAmount = BigNumber.from('100000000'); // 100 USDC
const D_TOKEN_ROLE = '0xcd86ded6d567eb7adb1b98d283b7e4004869021f7651dbae982e0992bfe0df5a';
const TIMELOCK = ONE_DAY_SECONDS;

describe('DolomiteERC20', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let token: DolomiteERC20;
  let accountInfo: AccountInfoStruct;
  let accountInfo2: AccountInfoStruct;
  let parValue: BigNumber;

  let dolomiteOwner: DolomiteOwnerV2;
  let dolomiteOwnerAccount: AccountInfoStruct;
  let dolomiteOwnerImpersonator: SignerWithAddressWithSafety;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 220_664_500,
    });
    const implementation = await createContractWithAbi<DolomiteERC20>(
      DolomiteERC20__factory.abi,
      DolomiteERC20__factory.bytecode,
      [core.config.network],
    );
    const tokenProxy = await createDolomiteErc20Proxy(implementation, core.marketIds.usdc, core);
    token = DolomiteERC20__factory.connect(tokenProxy.address, core.hhUser1);
    await token.initializeVersion2();
    await token.initializeVersion3(core.dolomiteRegistry.address);

    await createAndUpgradeDolomiteRegistry(core);
    // await core.dolomiteRegistryProxy
    //   .connect(core.governance)
    //   .upgradeTo(getMaxDeploymentVersionAddressByDeploymentKey('DolomiteRegistryImplementation', core.network));
    await core.dolomiteRegistry
      .connect(core.governance)
      .ownerSetDolomiteAccountRegistry(core.dolomiteAccountRegistryProxy.address);

    await disableInterestAccrual(core, core.marketIds.usdc);
    await setupUSDCBalance(core, core.hhUser1, usdcAmount.mul(10), core.dolomiteMargin);
    await setupUSDCBalance(core, core.hhUser2, usdcAmount.mul(10), core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, usdcAmount);
    await core.dolomiteMargin.ownerSetGlobalOperator(token.address, true);

    accountInfo = { owner: core.hhUser1.address, number: ZERO_BI };
    accountInfo2 = { owner: core.hhUser2.address, number: ZERO_BI };
    parValue = (await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value;

    dolomiteOwner = await createDolomiteOwnerV2(core, TIMELOCK);
    dolomiteOwnerAccount = {
      owner: dolomiteOwner.address,
      number: ZERO_BI,
    };
    dolomiteOwnerImpersonator = await impersonate(dolomiteOwner.address, true);

    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRole(D_TOKEN_ROLE);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(D_TOKEN_ROLE, token.address);
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
      await dolomiteOwner.BYPASS_TIMELOCK_ROLE(),
      token.address,
    );
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).grantRole(
      await dolomiteOwner.EXECUTOR_ROLE(),
      token.address,
    );
    await dolomiteOwner.connect(dolomiteOwnerImpersonator).ownerAddRoleToAddressFunctionSelectors(
      D_TOKEN_ROLE,
      core.dolomiteMargin.address,
      [
        '0x8f6bc659' /* ownerWithdrawExcessTokens */,
        '0x0cd30a0e', /* ownerSetMaxWei */
      ],
    );

    await Ownable__factory.connect(core.dolomiteMargin.address, core.governance).transferOwnership(
      dolomiteOwner.address,
    );

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
      expect(await token.underlyingToken()).to.eq(core.tokens.usdc.address);
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

  describe('#mint', () => {
    it('should work normally', async () => {
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(ZERO_BI);

      expect(await token.connect(core.hhUser2).callStatic.mint(usdcAmount)).to.eq(parValue);
      const result = await token.connect(core.hhUser2).mint(usdcAmount);
      await expectEvent(token, result, 'Transfer', {
        from: ADDRESS_ZERO,
        to: core.hhUser2.address,
        value: parValue,
      });

      expect(await token.balanceOf(core.hhUser2.address)).to.eq(parValue);
      await expectProtocolBalance(core, core.hhUser2, ZERO_BI, core.marketIds.usdc, usdcAmount);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(token.connect(core.hhUser1).mint(ZERO_BI), 'DolomiteERC20: Invalid amount');
    });
  });

  describe('#redeem', () => {
    it('should work normally', async () => {
      expect(await token.connect(core.hhUser1).callStatic.redeem(parValue)).to.eq(usdcAmount);
      const result = await token.connect(core.hhUser1).redeem(parValue);
      await expectEvent(token, result, 'Transfer', {
        from: core.hhUser1.address,
        to: ADDRESS_ZERO,
        value: parValue,
      });

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(ZERO_BI);
      await expectProtocolBalance(core, core.hhUser1, ZERO_BI, core.marketIds.usdc, ZERO_BI);
    });

    it('should fail if amount is 0', async () => {
      await expectThrow(token.connect(core.hhUser1).redeem(ZERO_BI), 'DolomiteERC20: Invalid amount');
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

    it('should work when lossy and owner has to withdraw excess tokens', async () => {
      expect((await core.dolomiteMargin.getAccountPar(dolomiteOwnerAccount, core.marketIds.usdc)).value).to.eq(ZERO_BI);

      const transferAmount = parValue.div(3);
      const result = await token.connect(core.hhUser1).transfer(core.hhUser2.address, transferAmount);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue.sub(transferAmount));
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(transferAmount);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value)
        .to.eq(parValue.sub(transferAmount));
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value)
        .to.eq(transferAmount);

      await expectEvent(core.dolomiteMargin, result, 'LogWithdrawExcessTokens', {
        token: core.tokens.usdc.address,
      });
      await expectNotEvent(core.dolomiteMargin, result, 'LogSetMaxWei');
    });

    it('should work when lossy and owner does not have to withdraw', async () => {
      await setEtherBalance(dolomiteOwnerImpersonator.address, parseEther('100'));
      await setupUSDCBalance(core, dolomiteOwnerImpersonator, usdcAmount, core.dolomiteMargin);
      await depositIntoDolomiteMargin(core, dolomiteOwnerImpersonator, ZERO_BI, core.marketIds.usdc, usdcAmount);
      await expectProtocolBalanceIsGreaterThan(core, dolomiteOwnerAccount, core.marketIds.usdc, ZERO_BI, 0);

      const transferAmount = parValue.div(3);
      const result = await token.connect(core.hhUser1).transfer(core.hhUser2.address, transferAmount);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue.sub(transferAmount));
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(transferAmount);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value)
        .to.eq(parValue.sub(transferAmount));
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value)
        .to.eq(transferAmount);

      await expectNotEvent(core.dolomiteMargin, result, 'LogWithdrawExcessTokens');
      await expectNotEvent(core.dolomiteMargin, result, 'LogSetMaxWei');
    });

    it.only('should work when lossy and owner deposit exceeds supply cap', async () => {
      const assets = await core.dTokens.usdc.totalSupply();
      console.log('assets: ', assets);
      const ownerUsdc = BigNumber.from('1000000000');
      await core.dolomiteMargin.connect(dolomiteOwnerImpersonator).ownerSetMaxWei(
        core.marketIds.usdc,
        assets.add(ownerUsdc.sub(1)),
      );

      const transferAmount = parValue.div(3);
      const result = await token.connect(core.hhUser1).transfer(core.hhUser2.address, transferAmount);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue.sub(transferAmount));
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(transferAmount);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value)
        .to.eq(parValue.sub(transferAmount));
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value)
        .to.eq(transferAmount);

      const maxWeiBefore = await core.dolomiteMargin.getMarketMaxWei(core.marketIds.usdc);
      expect(maxWeiBefore.value).to.eq(assets.add(ownerUsdc.sub(1)));
      await expectProtocolBalanceIsGreaterThan(core, dolomiteOwnerAccount, core.marketIds.usdc, ownerUsdc, 0);

      await expectEvent(core.dolomiteMargin, result, 'LogWithdrawExcessTokens', {
        token: core.tokens.usdc.address,
      });
      await expectEvent(core.dolomiteMargin, result, 'LogSetMaxWei', {
        marketId: core.marketIds.usdc,
        maxWei: maxWeiBefore,
      });
      await expectEvent(core.dolomiteMargin, result, 'LogSetMaxWei', {
        marketId: core.marketIds.usdc,
        maxWei: { sign: true, value: ZERO_BI },
      });
    });

    it('should work when lossy and owner deposit DOES NOT exceed supply cap', async () => {
      const assets = await token.totalAssets();
      const numExcessTokens = await core.dolomiteMargin.getNumExcessTokens(core.marketIds.usdc);
      await core.dolomiteMargin.connect(dolomiteOwnerImpersonator).ownerSetMaxWei(
        core.marketIds.usdc,
        assets.add(numExcessTokens.value),
      );

      const transferAmount = parValue.div(3);
      await token.connect(core.hhUser1).transfer(core.hhUser2.address, transferAmount);

      expect(await token.balanceOf(core.hhUser1.address)).to.eq(parValue.sub(transferAmount));
      expect(await token.balanceOf(core.hhUser2.address)).to.eq(transferAmount);
      expect((await core.dolomiteMargin.getAccountPar(accountInfo, core.marketIds.usdc)).value)
        .to.eq(parValue.sub(transferAmount));
      expect((await core.dolomiteMargin.getAccountPar(accountInfo2, core.marketIds.usdc)).value)
        .to.eq(transferAmount);

      expect((await core.dolomiteMargin.getMarketMaxWei(core.marketIds.usdc)).value)
        .to.eq(assets.add(numExcessTokens.value));
      await expectProtocolBalance(
        core,
        dolomiteOwner,
        ZERO_BI,
        core.marketIds.usdc,
        numExcessTokens.value.sub(1), // sub one because transfer is lossy and owner loses 1 par
      );
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
        'ERC20: Transfer from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(token.transfer(ADDRESS_ZERO, 100), 'ERC20: Transfer to the zero address');
    });

    it('should fail if amount is greater than balance', async () => {
      await expectThrow(
        token.transfer(core.hhUser2.address, parValue.add(1)),
        'ERC20: Transfer amount exceeds balance',
      );
    });

    it('should fail if invalid receiver', async () => {
      const isolationModeVault = '0xffa18b366fa3ebE5832a49535F42aa0c93c791eF';
      await core.dolomiteAccountRegistry.ownerSetRestrictedAccount(core.hhUser2.address, true);
      await expectThrow(
        token.transfer(core.hhUser2.address, parValue),
        'ERC20: Transfers can only be made to valid receivers',
      );
      await expectThrow(
        token.transfer(isolationModeVault, parValue),
        'ERC20: Transfers can only be made to valid receivers',
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
        'ERC20: Approve from the zero address',
      );
    });

    it('should fail if to zero address', async () => {
      await expectThrow(token.approve(ADDRESS_ZERO, 100), 'ERC20: Approve to the zero address');
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
        'ERC20: Insufficient allowance',
      );
    });

    it('should fail if amount greater than balance', async () => {
      await token.approve(core.hhUser2.address, parValue.add(1));
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, core.hhUser2.address, parValue.add(1)),
        'ERC20: Transfer amount exceeds balance',
      );
    });

    it('should fail if to zero address', async () => {
      await token.approve(core.hhUser2.address, parValue);
      await expectThrow(
        token.connect(core.hhUser2).transferFrom(core.hhUser1.address, ADDRESS_ZERO, parValue),
        'ERC20: Transfer to the zero address',
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

  describe('#unscaledBalanceOf', () => {
    it('should work normally', async () => {
      await enableInterestAccrual(core, core.marketIds.usdc);
      const weiAmount = await core.dolomiteMargin.getAccountWei(accountInfo, core.marketIds.usdc);
      expect(await token.unscaledBalanceOf(core.hhUser1.address)).to.eq(weiAmount.value);
      await increase(ONE_DAY_SECONDS);
      expect(await token.unscaledBalanceOf(core.hhUser1.address)).to.gt(weiAmount.value);
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

  describe('#unscaledTotalSupply', () => {
    it('should work normally', async () => {
      const totalSupply = (await core.dolomiteMargin.getMarketTotalPar(core.marketIds.usdc)).supply;
      const index = await core.dolomiteMargin.getMarketCurrentIndex(core.marketIds.usdc);

      // Can be one wei off due to rounding
      expect((await token.unscaledTotalSupply()).toNumber()).to.approximately(
        totalSupply.mul(index.supply).div(ONE_ETH_BI).toNumber(),
        1,
      );
    });
  });
});
