import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { DolomiteReader, DolomiteReader__factory, DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '../../src/types';
import { Network } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectEvent, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createDolomiteRegistryImplementation, createRegistryProxy } from '../utils/dolomite';
import { setupCoreProtocol } from '../utils/setup';
import { CoreProtocolBerachain } from '../utils/core-protocols/core-protocol-berachain';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { formatEther } from 'ethers/lib/utils';

const ACCOUNT_ADDRESS = '0x40a24ea5b6a248f3a138e6bfe3366e78d1cc71cb';
const POSITION_1 = 1037000008;
const POSITION_2 = 1036000007;
const POSITION_3 = 1038000006;
const POSITION_4 = 1034000005;

describe('DolomiteReader', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let reader: DolomiteReader;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.Berachain),
      network: Network.Berachain,
    });

    reader = await createContractWithAbi<DolomiteReader>(
      DolomiteReader__factory.abi,
      DolomiteReader__factory.bytecode,
      [core.dolomiteMargin.address],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await reader.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
    });
  });

  describe('#calculateHealthFactor', () => {
    it.only('should work normally', async () => {
      const healthFactor = await reader.getHealthFactor(ACCOUNT_ADDRESS, POSITION_1);
      console.log(formatEther(healthFactor.value.toString()));
      console.log();
      const healthFactor2 = await reader.getHealthFactor(ACCOUNT_ADDRESS, POSITION_2);
      console.log(formatEther(healthFactor2.value.toString()));
      console.log();
      const healthFactor3 = await reader.getHealthFactor(ACCOUNT_ADDRESS, POSITION_3);
      console.log(formatEther(healthFactor3.value.toString()));
      console.log();
      const healthFactor4 = await reader.getHealthFactor(ACCOUNT_ADDRESS, POSITION_4);
      console.log(formatEther(healthFactor4.value.toString()));
      console.log();
    });
  });

  describe('#getAdjustedLtv', () => {
    it.only('should work normally', async () => {
      const ltv = await reader.getAdjustedLtv(ACCOUNT_ADDRESS, POSITION_1);
      console.log(formatEther(ltv.value.toString()));
      console.log();
      const ltv2 = await reader.getAdjustedLtv(ACCOUNT_ADDRESS, POSITION_2);
      console.log(formatEther(ltv2.value.toString()));
      console.log();
    });
  });

  describe('#calculateHealthFactorWithChange', () => {
    it('should work normally', async () => {
      const healthFactor = await reader.calculateHealthFactorWithChange(
        ACCOUNT_ADDRESS,
        POSITION_1,
      )
    });
  });
});
