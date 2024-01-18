import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { TestBitsLib, TestBitsLib__factory } from '../../../src/types';
import { createContractWithAbi } from '../../../packages/base/src/utils/dolomite-utils';
import { ZERO_BI } from '../../../packages/base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '../../../packages/base/test/utils';

describe('BitsLib', () => {
  let snapshotId: string;

  let testBitsLib: TestBitsLib;

  before(async () => {
    testBitsLib = await createContractWithAbi<TestBitsLib>(
      TestBitsLib__factory.abi,
      TestBitsLib__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('BitsLibCreateBitmaps', () => {
    it('should work', async () => {
      expect((await testBitsLib.BitsLibCreateBitmaps(0)).length).eq(1);
      expect((await testBitsLib.BitsLibCreateBitmaps(1)).length).eq(1);
      expect((await testBitsLib.BitsLibCreateBitmaps(255)).length).eq(1);
      expect((await testBitsLib.BitsLibCreateBitmaps(256)).length).eq(2);
    });
  });

  describe('BitsLibGetMarketIdFromBit', () => {
    it('should work', async () => {
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(0, 0)).eq(0);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(0, 1)).eq(1);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(0, 255)).eq(255);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(0, 256)).eq(256);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(0, 1)).eq(1);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(1, 0)).eq(256);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(1, 1)).eq(257);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(1, 255)).eq(511);
      expect(await testBitsLib.BitsLibGetMarketIdFromBit(1, 256)).eq(512);
    });
  });

  describe('BitsLibSetBit', () => {
    it('should work', async () => {
      const result1 = await testBitsLib.BitsLibSetBit([ZERO_BI, ZERO_BI, ZERO_BI], 0);
      expect(result1.length === 3);
      expect(result1[0]).eq(BigNumber.from(1));
      expect(result1[1]).eq(ZERO_BI);
      expect(result1[2]).eq(ZERO_BI);

      const result2 = await testBitsLib.BitsLibSetBit([1, ZERO_BI, ZERO_BI], 0);
      expect(result2.length === 3);
      expect(result2[0]).eq(BigNumber.from(1));
      expect(result2[1]).eq(ZERO_BI);
      expect(result2[2]).eq(ZERO_BI);

      const result3 = await testBitsLib.BitsLibSetBit([0x04, ZERO_BI, ZERO_BI], 0);
      expect(result3.length === 3);
      expect(result3[0]).eq(BigNumber.from(5));
      expect(result3[1]).eq(ZERO_BI);
      expect(result3[2]).eq(ZERO_BI);

      const result4 = await testBitsLib.BitsLibSetBit([ZERO_BI, 1, ZERO_BI], 256);
      expect(result4.length === 3);
      expect(result4[0]).eq(ZERO_BI);
      expect(result4[1]).eq(1);
      expect(result4[2]).eq(ZERO_BI);

      const result5 = await testBitsLib.BitsLibSetBit([ZERO_BI, 1, ZERO_BI], 257);
      expect(result5.length === 3);
      expect(result5[0]).eq(ZERO_BI);
      expect(result5[1]).eq(3);
      expect(result5[2]).eq(ZERO_BI);
    });
  });

  describe('BitsLibHasBit', () => {
    it('should work', async () => {
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, ZERO_BI, ZERO_BI], 0)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([1, ZERO_BI, ZERO_BI], 0)).eq(true);
      expect(await testBitsLib.BitsLibHasBit([1, ZERO_BI, ZERO_BI], 1)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([4, ZERO_BI, ZERO_BI], 2)).eq(true);
      expect(await testBitsLib.BitsLibHasBit([4, ZERO_BI, ZERO_BI], 4)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([1, ZERO_BI, ZERO_BI], 257)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, 1, ZERO_BI], 256)).eq(true);
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, 1, ZERO_BI], 257)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, ZERO_BI, 1], 511)).eq(false);
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, ZERO_BI, 1], 512)).eq(true);
      expect(await testBitsLib.BitsLibHasBit([ZERO_BI, ZERO_BI, 1], 513)).eq(false);
    });
  });

  describe('BitsLibUnsetBit', () => {
    it('should work', async () => {
      expect(await testBitsLib.BitsLibUnsetBit(0, 0)).eq(0);
      expect(await testBitsLib.BitsLibUnsetBit(0, 1)).eq(0);
      expect(await testBitsLib.BitsLibUnsetBit(0, 256)).eq(0);
      expect(await testBitsLib.BitsLibUnsetBit(1, 1)).eq(1);
      expect(await testBitsLib.BitsLibUnsetBit(1, 0)).eq(0);
      expect(await testBitsLib.BitsLibUnsetBit(1, 1)).eq(1);
      expect(await testBitsLib.BitsLibUnsetBit(4, 4)).eq(4);
      expect(await testBitsLib.BitsLibUnsetBit(4, 2)).eq(0);
      expect(await testBitsLib.BitsLibUnsetBit(8, 3)).eq(0);
    });
  });

  describe('BitsLibGetLeastSignificantBit', () => {
    it('should work', async () => {
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(0)).eq(0);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(1)).eq(0);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(2)).eq(1);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(3)).eq(0);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(4)).eq(2);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000000000000000000000000000')).eq(128);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xFFFFFFFFFFFFFFFF000000000000000000000000000000000000000000000000')).eq(192);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xFFFFFFFF00000000000000000000000000000000000000000000000000000000')).eq(224);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xFFFF000000000000000000000000000000000000000000000000000000000000')).eq(240);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xFF00000000000000000000000000000000000000000000000000000000000000')).eq(248);
      expect(await testBitsLib.BitsLibGetLeastSignificantBit(
        '0xF000000000000000000000000000000000000000000000000000000000000000')).eq(252);
    });
  });
});
