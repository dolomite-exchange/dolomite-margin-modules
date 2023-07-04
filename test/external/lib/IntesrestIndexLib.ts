import { expect } from 'chai';
import { BigNumber, BigNumberish } from 'ethers';
import { TestInterestIndexLib, TestInterestIndexLib__factory } from '../../../src/types';
import { Account } from '../../../src/types/IDolomiteMargin';
import { IDolomiteStructs } from '../../../src/types/TestInterestIndexLib';
import {
  createContractWithAbi,
  depositIntoDolomiteMargin,
  withdrawFromDolomiteMargin,
} from '../../../src/utils/dolomite-utils';
import { Network, ZERO_BI } from '../../../src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot, waitDays } from '../../utils';
import { CoreProtocol, getDefaultCoreProtocolConfig, setupCoreProtocol, setupUSDCBalance } from '../../utils/setup';

const depositAmount = BigNumber.from('5000000000'); // 5,000 USDC
const withdrawAmount = BigNumber.from('1000000000000000000'); // 1 ETH

const zeroPar: IDolomiteStructs.ParStruct = {
  sign: false,
  value: ZERO_BI,
};
const zeroWei: IDolomiteStructs.WeiStruct = {
  sign: false,
  value: ZERO_BI,
};

const defaultAccountNumber = ZERO_BI;

describe('InterestIndexLib', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let testLib: TestInterestIndexLib;
  let defaultAccount: Account.InfoStruct;
  let marketIdPositive: BigNumberish;
  let marketIdNegative: BigNumberish;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    testLib = await createContractWithAbi<TestInterestIndexLib>(
      TestInterestIndexLib__factory.abi,
      TestInterestIndexLib__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    defaultAccount = {
      owner: core.hhUser1.address,
      number: defaultAccountNumber,
    };
    marketIdPositive = core.marketIds.usdc;
    marketIdNegative = core.marketIds.weth;
    await setupUSDCBalance(core, core.hhUser1, depositAmount, core.dolomiteMargin);
    await depositIntoDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.usdc, depositAmount);
    await withdrawFromDolomiteMargin(core, core.hhUser1, defaultAccountNumber, core.marketIds.weth, withdrawAmount);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('parToWei', () => {
    it('should work for positive numbers', async () => {
      for (let i = 0; i < 10; i++) {
        const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdPositive);
        const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdPositive);

        const foundWei = await testLib.parToWei(marketIdPositive, par);
        expect(foundWei.sign).to.eq(wei.sign);
        expect(foundWei.value).to.eq(wei.value);

        await waitDays(1);
      }
    });

    it('should work for zero', async () => {
      const foundWeiPositive = await testLib.parToWei(marketIdPositive, zeroPar);
      expect(foundWeiPositive.sign).to.eq(zeroWei.sign);
      expect(foundWeiPositive.value).to.eq(zeroWei.value);

      const foundWeiNegative = await testLib.parToWei(marketIdNegative, zeroPar);
      expect(foundWeiNegative.sign).to.eq(zeroWei.sign);
      expect(foundWeiNegative.value).to.eq(zeroWei.value);
    });

    it('should work for negative numbers', async () => {
      for (let i = 0; i < 10; i++) {
        const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdNegative);
        const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdNegative);

        const foundWei = await testLib.parToWei(marketIdNegative, par);
        expect(foundWei.sign).to.eq(wei.sign);
        expect(foundWei.value).to.eq(wei.value);

        await waitDays(1);
      }
    });
  });

  describe('weiToPar', () => {
    it('should work for positive numbers', async () => {
      for (let i = 0; i < 10; i++) {
        const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdPositive);
        const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdPositive);

        const foundPar = await testLib.weiToPar(marketIdPositive, wei);
        expect(foundPar.sign).to.eq(par.sign);
        expect(foundPar.value).to.eq(par.value);

        await waitDays(1);
      }
    });

    it('should work for zero', async () => {
      const foundParPositive = await testLib.weiToPar(marketIdPositive, zeroWei);
      expect(foundParPositive.sign).to.eq(zeroPar.sign);
      expect(foundParPositive.value).to.eq(zeroPar.value);

      const foundParNegative = await testLib.weiToPar(marketIdNegative, zeroWei);
      expect(foundParNegative.sign).to.eq(zeroPar.sign);
      expect(foundParNegative.value).to.eq(zeroPar.value);
    });

    it('should work for negative numbers', async () => {
      for (let i = 0; i < 10; i++) {
        const par = await core.dolomiteMargin.getAccountPar(defaultAccount, marketIdNegative);
        const wei = await core.dolomiteMargin.getAccountWei(defaultAccount, marketIdNegative);

        const foundPar = await testLib.weiToPar(marketIdNegative, wei);
        expect(foundPar.sign).to.eq(par.sign);
        expect(foundPar.value).to.eq(par.value);

        await waitDays(1);
      }
    });
  });
});
