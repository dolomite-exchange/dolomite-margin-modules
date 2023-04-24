import { ActionType, AmountDenomination, AmountReference } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { defaultAbiCoder } from 'ethers/lib/utils';
import {
  CustomTestToken,
  TestWrappedTokenUserVaultFactory,
  TestWrappedTokenUserVaultFactory__factory,
  TestWrappedTokenUserVaultWrapper,
  TestWrappedTokenUserVaultWrapper__factory,
  TestWrappedTokenUserVaultV1,
  TestWrappedTokenUserVaultV1__factory,
} from '../../../../src/types';
import { Account } from '../../../../src/types/IDolomiteMargin';
import { createContractWithAbi, createTestToken } from '../../../../src/utils/dolomite-utils';
import { BYTES_EMPTY, Network, ZERO_BI } from '../../../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../../../utils';
import { expectThrow } from '../../../utils/assertions';
import { CoreProtocol, setupCoreProtocol, setupTestMarket, setupUserVaultProxy } from '../../../utils/setup';

const defaultAccountNumber = '0';
const amountWei = BigNumber.from('200000000000000000000'); // $200
const otherAmountWei = BigNumber.from('10000000'); // $10
const TEN = BigNumber.from('10000000000000000000');

const abiCoder = ethers.utils.defaultAbiCoder;

describe('WrappedTokenUserVaultWrapper', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;
  let wrapper: TestWrappedTokenUserVaultWrapper;
  let factory: TestWrappedTokenUserVaultFactory;
  let vault: TestWrappedTokenUserVaultV1;
  let defaultAccount: Account.InfoStruct;

  let solidUser: SignerWithAddress;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 53107700,
      network: Network.ArbitrumOne,
    });
    underlyingToken = await createTestToken();
    otherToken = await createTestToken();
    const userVaultImplementation = await createContractWithAbi(
      TestWrappedTokenUserVaultV1__factory.abi,
      TestWrappedTokenUserVaultV1__factory.bytecode,
      [],
    );
    factory = await createContractWithAbi<TestWrappedTokenUserVaultFactory>(
      TestWrappedTokenUserVaultFactory__factory.abi,
      TestWrappedTokenUserVaultFactory__factory.bytecode,
      [
        underlyingToken.address,
        core.borrowPositionProxyV2.address,
        userVaultImplementation.address,
        core.dolomiteMargin.address,
      ],
    );

    await core.testPriceOracle.setPrice(factory.address, '1000000000000000000'); // $1.00
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, factory, true);

    await core.testPriceOracle.setPrice(otherToken.address, '1000000000000000000000000000000'); // $1.00
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    wrapper = await createContractWithAbi(
      TestWrappedTokenUserVaultWrapper__factory.abi,
      TestWrappedTokenUserVaultWrapper__factory.bytecode,
      [factory.address, core.dolomiteMargin.address],
    );
    await factory.connect(core.governance).ownerInitialize([wrapper.address]);
    await core.dolomiteMargin.connect(core.governance).ownerSetGlobalOperator(factory.address, true);

    solidUser = core.hhUser5;

    await factory.createVault(core.hhUser1.address);
    const vaultAddress = await factory.getVaultByAccount(core.hhUser1.address);
    vault = setupUserVaultProxy<TestWrappedTokenUserVaultV1>(
      vaultAddress,
      TestWrappedTokenUserVaultV1__factory,
      core.hhUser1,
    );
    defaultAccount = { owner: vault.address, number: defaultAccountNumber };

    await underlyingToken.connect(core.hhUser1).approve(vault.address, amountWei);
    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await vault.depositIntoVaultForDolomiteMargin(defaultAccountNumber, amountWei);

    expect(await underlyingToken.balanceOf(vault.address)).to.eq(amountWei);
    expect((await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId)).value).to.eq(amountWei);

    await otherToken.connect(core.hhUser1).addBalance(core.dolomiteMargin.address, amountWei);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('Call and Exchange for non-liquidation sale', () => {
    it('should work when called with the normal conditions', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 0;
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        underlyingMarketId,
        otherMarketId,
        ZERO_BI,
        otherAmountWei,
      );

      await core.dolomiteMargin.ownerSetGlobalOperator(core.hhUser5.address, true);
      await core.dolomiteMargin.connect(core.hhUser5).operate([defaultAccount], actions);

      const underlyingBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, underlyingMarketId);
      expect(underlyingBalanceWei.value).to.eq(amountWei.add(TEN));
      expect(await vault.underlyingBalanceOf()).to.eq(amountWei.add(TEN));

      const otherBalanceWei = await core.dolomiteMargin.getAccountWei(defaultAccount, otherMarketId);
      expect(otherBalanceWei.sign).to.eq(false);
      expect(otherBalanceWei.value).to.eq(otherAmountWei);
    });
  });

  describe('#exchange', () => {
    it('should fail if not called by DolomiteMargin', async () => {
      await expectThrow(
        wrapper.connect(core.hhUser1).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          otherToken.address,
          factory.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `OnlyDolomiteMargin: Only Dolomite can call function <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('should fail if output token is incorrect', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          core.hhUser1.address,
          core.dolomiteMargin.address,
          core.weth.address,
          otherToken.address,
          amountWei,
          BYTES_EMPTY,
        ),
        `WrappedTokenUserVaultWrapper: Invalid output token <${core.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if the output amount is insufficient', async () => {
      const dolomiteMarginImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        wrapper.connect(dolomiteMarginImpersonator).exchange(
          vault.address,
          core.dolomiteMargin.address,
          factory.address,
          otherToken.address,
          amountWei.div(1e12), // normalize the amount to match the # of decimals otherToken has
          defaultAbiCoder.encode(['uint256'], [amountWei.mul(2)]), // minOutputAmount is too large
        ),
        `WrappedTokenUserVaultWrapper: Insufficient output amount <${amountWei.toString()}, ${amountWei.mul(2).toString()}>`,
      );
    });
  });

  describe('#actionsLength', () => {
    it('should return the correct amount', async () => {
      expect(await wrapper.actionsLength()).to.eq(1);
    });
  });

  describe('#createActionsForWrapping', () => {
    it('should work for normal condition', async () => {
      const solidAccountId = 0;
      const liquidAccountId = 1;
      const actions = await wrapper.createActionsForWrapping(
        solidAccountId,
        liquidAccountId,
        solidUser.address,
        core.hhUser1.address,
        underlyingMarketId,
        otherMarketId,
        otherAmountWei,
        amountWei,
      );
      expect(actions.length).to.eq(1);

      // Inspect the sell action
      expect(actions[0].actionType).to.eq(ActionType.Sell);
      expect(actions[0].accountId).to.eq(solidAccountId);
      expect(actions[0].amount.sign).to.eq(false);
      expect(actions[0].amount.denomination).to.eq(AmountDenomination.Wei);
      expect(actions[0].amount.ref).to.eq(AmountReference.Delta);
      expect(actions[0].amount.value).to.eq(amountWei);
      expect(actions[0].primaryMarketId).to.eq(otherMarketId);
      expect(actions[0].secondaryMarketId).to.eq(underlyingMarketId);
      expect(actions[0].otherAddress).to.eq(wrapper.address);
      expect(actions[0].otherAccountId).to.eq(ZERO_BI);
      const amountOut = await wrapper.getExchangeCost(
        factory.address,
        otherToken.address,
        amountWei,
        BYTES_EMPTY,
      );
      expect(actions[0].data).to.eq(abiCoder.encode(['uint', 'bytes'], [amountOut, BYTES_EMPTY]));
    });

    it('should fail when owed market is invalid', async () => {
      const solidAccount = 0;
      await expectThrow(
        wrapper.createActionsForWrapping(
          solidAccount,
          solidAccount,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          core.marketIds.weth,
          otherMarketId,
          ZERO_BI,
          amountWei,
        ),
        `WrappedTokenUserVaultWrapper: Invalid owed market <${core.marketIds.weth.toString()}>`,
      );
    });
  });
});
