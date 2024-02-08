import {
  AmountDenomination,
  AmountReference,
  BalanceCheckFlag,
} from '@dolomite-margin/dist/src';
import { expect } from 'chai';
import { BigNumber, ethers } from 'ethers';
import { CustomTestToken, TestAccountActionLib, TestAccountActionLib__factory, TestExpirationLib } from '../../src/types';
import { createContractWithAbi, createContractWithLibrary, createContractWithName, createTestToken } from '../../src/utils/dolomite-utils';
import { Network, ONE_BI, ZERO_BI } from '../../src/utils/no-deps-constants';
import { impersonate, revertToSnapshotAndCapture, snapshot } from '../utils';
import { CoreProtocolArbitrumOne } from '../utils/core-protocol';
import { disableInterestAccrual, getDefaultCoreProtocolConfig, setupCoreProtocol, setupTestMarket } from '../utils/setup';

const amountWei = BigNumber.from('200000000');
const amountWeiBig = BigNumber.from('500000000');
const defaultAccountNumber = BigNumber.from('0');
const otherAccountNumber = BigNumber.from('123');

describe('ExpirationLib', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let testLib: TestExpirationLib;
  let accountActionLib: TestAccountActionLib;
  let underlyingToken: CustomTestToken;
  let underlyingMarketId: BigNumber;
  let otherToken: CustomTestToken;
  let otherMarketId: BigNumber;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));

    const lib = await createContractWithName('ExpirationLib', []);
    testLib = await createContractWithLibrary<TestExpirationLib>(
      'TestExpirationLib',
      { ExpirationLib: lib.address },
      [],
    );
    accountActionLib = await createContractWithAbi<TestAccountActionLib>(
      TestAccountActionLib__factory.abi,
      TestAccountActionLib__factory.bytecode,
      [core.dolomiteMargin.address],
    );
    await core.dolomiteMargin.ownerSetGlobalOperator(testLib.address, true);
    await core.dolomiteMargin.ownerSetGlobalOperator(accountActionLib.address, true);

    underlyingToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      underlyingToken.address,
      '1000000000000000000', // $1.00 in USDC
    );
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, underlyingToken, false);

    otherToken = await createTestToken();
    await core.testEcosystem!.testPriceOracle.setPrice(
      otherToken.address,
      '1000000000000000000', // $1.00 in USDC
    );
    otherMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, otherToken, false);

    await underlyingToken.connect(core.hhUser1).addBalance(core.dolomiteMargin.address, amountWeiBig);
    await underlyingToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWei);
    await underlyingToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWei);

    await otherToken.connect(core.hhUser1).addBalance(core.hhUser1.address, amountWeiBig);
    await otherToken.connect(core.hhUser1).approve(core.dolomiteMargin.address, amountWeiBig);

    await disableInterestAccrual(core, underlyingMarketId);
    await disableInterestAccrual(core, otherMarketId);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#clearExpirationIfNeeded', () => {
    it('should work normally if par value is zero', async () => {
      const amountStruct = {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountWei,
      };
      const otherAccountStruct = { owner: core.hhUser1.address, number: otherAccountNumber };
      await accountActionLib.deposit(
        core.hhUser1.address,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        amountStruct,
      );
      await accountActionLib.transfer(
        core.hhUser1.address,
        otherAccountNumber,
        core.hhUser1.address,
        defaultAccountNumber,
        otherMarketId,
        AmountDenomination.Wei,
        ONE_BI,
        BalanceCheckFlag.None
      );
      const accountId = '0';
      const expiryTimeDelta = '3600';
      const callAction = await accountActionLib.connect(core.hhUser1).encodeExpirationAction(
        otherAccountStruct,
        accountId,
        otherMarketId,
        core.expiry.address,
        expiryTimeDelta,
      );
      const actionLibImpersonator = await impersonate(accountActionLib.address, true);
      await core.dolomiteMargin.connect(actionLibImpersonator).operate([otherAccountStruct], [callAction])
      
      expect(await core.expiry.getExpiry(otherAccountStruct, otherMarketId)).to.be.gt(ZERO_BI);
      await accountActionLib.transfer(
        core.hhUser1.address,
        defaultAccountNumber,
        core.hhUser1.address,
        otherAccountNumber,
        otherMarketId,
        AmountDenomination.Wei,
        ONE_BI,
        BalanceCheckFlag.None
      );
      await testLib.clearExpirationIfNeeded(
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.hhUser1.address,
        otherAccountNumber,
        otherMarketId
      );
      expect(await core.expiry.getExpiry(otherAccountStruct, otherMarketId)).to.eq(ZERO_BI);
    });

    it('should work normally if par value is positive', async () => {
      const amountStruct = {
        sign: true,
        denomination: AmountDenomination.Wei,
        ref: AmountReference.Delta,
        value: amountWei,
      };
      const otherAccountStruct = { owner: core.hhUser1.address, number: otherAccountNumber };
      await accountActionLib.deposit(
        core.hhUser1.address,
        core.hhUser1.address,
        otherAccountNumber,
        underlyingMarketId,
        amountStruct,
      );
      await accountActionLib.transfer(
        core.hhUser1.address,
        otherAccountNumber,
        core.hhUser1.address,
        defaultAccountNumber,
        otherMarketId,
        AmountDenomination.Wei,
        ONE_BI,
        BalanceCheckFlag.None
      );
      const accountId = '0';
      const expiryTimeDelta = '3600';
      const callAction = await accountActionLib.connect(core.hhUser1).encodeExpirationAction(
        otherAccountStruct,
        accountId,
        otherMarketId,
        core.expiry.address,
        expiryTimeDelta,
      );
      const actionLibImpersonator = await impersonate(accountActionLib.address, true);
      await core.dolomiteMargin.connect(actionLibImpersonator).operate([otherAccountStruct], [callAction])
      
      expect(await core.expiry.getExpiry(otherAccountStruct, otherMarketId)).to.be.gt(ZERO_BI);
      await accountActionLib.deposit(
        core.hhUser1.address,
        core.hhUser1.address,
        otherAccountNumber,
        otherMarketId,
        amountStruct,
      );
      await testLib.clearExpirationIfNeeded(
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.hhUser1.address,
        otherAccountNumber,
        otherMarketId
      );
      expect(await core.expiry.getExpiry(otherAccountStruct, otherMarketId)).to.eq(ZERO_BI);
    });

    it('should work if not needed', async () => {
      await testLib.clearExpirationIfNeeded(
        core.dolomiteMargin.address,
        core.dolomiteRegistry.address,
        core.hhUser1.address,
        otherAccountNumber,
        otherMarketId
      );
      expect(await core.expiry.getExpiry({owner: core.hhUser1.address, number: otherAccountNumber}, otherMarketId)).to.eq(ZERO_BI);
    });
  });
});
