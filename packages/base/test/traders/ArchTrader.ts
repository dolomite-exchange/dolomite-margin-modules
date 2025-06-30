import { BigNumber } from 'ethers';
import { Network } from '../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { expectProtocolBalance, expectProtocolBalanceIsGreaterThan, expectThrow } from '../utils/assertions';

import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createOdosAggregatorTrader } from '../utils/ecosystem-utils/traders';
import { disableInterestAccrual, setupCoreProtocol, setupWETHBalance } from '../utils/setup';
import { getCalldataForOdos } from '../utils/trader-utils';
import { CoreProtocolBotanix } from '../utils/core-protocols/core-protocol-botanix';

const defaultAccountNumber = '0';
const amountIn = BigNumber.from('1000000000000000000');
const minAmountOut = BigNumber.from('123123123');

describe('ArchTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolBotanix;

  before(async () => {
    const latestBlockNumber = await getRealLatestBlockNumber(true, Network.Botanix);
    core = await setupCoreProtocol({
      blockNumber: latestBlockNumber,
      network: Network.Botanix,
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#contructor', () => {
    it('should work normally', async () => {
    });
  });
});
