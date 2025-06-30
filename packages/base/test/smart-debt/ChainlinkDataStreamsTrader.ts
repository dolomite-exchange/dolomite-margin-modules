import { setupCoreProtocol, setupLINKBalance } from '../utils/setup';
import { ADDRESS_ZERO, BYTES_ZERO, MAX_UINT_256_BI, Network, ONE_BI, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '../utils/core-protocols/core-protocol-arbitrum-one';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../utils';
import { createAndUpgradeDolomiteRegistry } from '../utils/dolomite';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { expectEvent, expectThrow } from '../utils/assertions';
import {
  IVerifierProxy,
  IVerifierProxy__factory,
  TestChainlinkDataStreamsTrader,
  TestChainlinkDataStreamsTrader__factory
} from 'packages/base/src/types';
import { BigNumber } from 'ethers';
import { CHAINLINK_DATA_STREAM_FEEDS_MAP, CHAINLINK_VERIFIER_PROXY_MAP } from 'packages/base/src/utils/constants';
import { getAskPriceFromReport, getBidPriceFromReport, getLatestChainlinkDataStreamReport, getPriceFromReport } from 'packages/oracles/src/chainlink-data-streams';

const CHAINLINK_REWARD_MANAGER = '0x525a8b8e83a8168c599f6160f6303002c19087a9';

describe('ChainlinkDataStreamsTrader', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let trader: TestChainlinkDataStreamsTrader;
  let verifierProxy: IVerifierProxy;

  before(async () => {
    // core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.ArbitrumOne));
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne)
    });
    await createAndUpgradeDolomiteRegistry(core);

    verifierProxy = IVerifierProxy__factory.connect(CHAINLINK_VERIFIER_PROXY_MAP[Network.ArbitrumOne]!, core.hhUser1);
    trader = await createContractWithAbi<TestChainlinkDataStreamsTrader>(
      TestChainlinkDataStreamsTrader__factory.abi,
      TestChainlinkDataStreamsTrader__factory.bytecode,
      [
        [core.tokens.usdc.address, core.tokens.usdt.address],
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']],
        core.tokens.link.address,
        verifierProxy.address,
        core.config.network,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address
      ]
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await trader.LINK()).to.equal(core.tokens.link.address);
      expect(await trader.VERIFIER_PROXY()).to.equal(verifierProxy.address);
    });
  });

  describe('#__ChainlinkDataStreamsTrader__initialize', () => {
    it('should work normally', async () => {
      expect(await core.tokens.link.allowance(trader.address, CHAINLINK_REWARD_MANAGER)).to.equal(MAX_UINT_256_BI);
    });

    it('should fail if tokenIds length is not equal to feedIds length', async () => {
      await expectThrow(
        createContractWithAbi<TestChainlinkDataStreamsTrader>(
          TestChainlinkDataStreamsTrader__factory.abi,
          TestChainlinkDataStreamsTrader__factory.bytecode,
          [
            [core.tokens.usdc.address, core.tokens.usdt.address],
            [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
            core.tokens.link.address,
            verifierProxy.address,
            core.config.network,
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address
          ]
        ),
        'ChainlinkDataStreamsTrader: Invalid tokens length'
      );
    });
  });

  // postPrices tests have to be run on latest block number
  describe('#postPrices', () => {
    it('should work normally', async () => {
      await setupLINKBalance(core, core.hhUser1, parseEther('100'), core.dolomiteMargin);
      await core.tokens.link.transfer(trader.address, parseEther('100'));

      const result = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);
      await trader.connect(core.governance).postPrices([result.report.fullReport]);

      const latestReport = await trader.getLatestReport(core.tokens.usdc.address);
      expect(latestReport.timestamp).to.equal(result.report.observationsTimestamp);
      expect(latestReport.bid).to.equal(getBidPriceFromReport(result));
      expect(latestReport.ask).to.equal(getAskPriceFromReport(result));
      expect(latestReport.benchmarkPrice).to.equal(getPriceFromReport(result));
    });

    it('should not update if timestamp is not greater than latest report', async () => {
      await setupLINKBalance(core, core.hhUser1, parseEther('100'), core.dolomiteMargin);
      await core.tokens.link.transfer(trader.address, parseEther('100'));

      const result1 = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);
      await new Promise(resolve => setTimeout(resolve, 10000));
      const result2 = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);

      await trader.connect(core.governance).postPrices([result2.report.fullReport]);
      let latestReport = await trader.getLatestReport(core.tokens.usdc.address);
      expect(latestReport.timestamp).to.equal(result2.report.observationsTimestamp);

      await trader.connect(core.governance).postPrices([result1.report.fullReport]);
      latestReport = await trader.getLatestReport(core.tokens.usdc.address);
      expect(latestReport.timestamp).to.equal(result2.report.observationsTimestamp);
    });

    it('should fail if report is not from valid feed', async () => {
      await setupLINKBalance(core, core.hhUser1, parseEther('100'), core.dolomiteMargin);
      await core.tokens.link.transfer(trader.address, parseEther('100'));
      await trader.connect(core.governance).ownerRemoveTokenFeed(core.tokens.usdc.address);
      const result = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);

      await expectThrow(
        trader.connect(core.governance).postPrices([result.report.fullReport]),
        'ChainlinkDataStreamsTrader: Invalid feed ID'
      );
    });
  });

  describe('#ownerInsertOrUpdateTokenFeed', () => {
    it('should work normally for inserting new token feed', async () => {
      const newToken = core.tokens.weth.address;
      const newFeedId = '0x1234567890123456789012345678901234567890123456789012345678901234';

      expect(await trader.tokenToFeedId(core.tokens.weth.address)).to.equal(BYTES_ZERO);
      expect(await trader.feedIdToToken(newFeedId)).to.equal(ADDRESS_ZERO);

      const res = await trader.connect(core.governance).ownerInsertOrUpdateTokenFeed(newToken, newFeedId);
      await expectEvent(trader, res, 'TokenFeedInsertedOrUpdated', {
        _token: newToken,
        _feedId: newFeedId
      });

      expect(await trader.tokenToFeedId(newToken)).to.equal(newFeedId);
      expect(await trader.feedIdToToken(newFeedId)).to.equal(newToken);
    });

    it('should work normally for updating existing token feed', async () => {
      const existingToken = core.tokens.usdc.address;
      const existingFeedId = CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'];
      const newFeedId = '0x1234567890123456789012345678901234567890123456789012345678901234';

      expect(await trader.tokenToFeedId(existingToken)).to.equal(existingFeedId);
      expect(await trader.feedIdToToken(existingFeedId)).to.equal(existingToken);

      const res = await trader.connect(core.governance).ownerInsertOrUpdateTokenFeed(existingToken, newFeedId);
      await expectEvent(trader, res, 'TokenFeedInsertedOrUpdated', {
        _token: existingToken,
        _feedId: newFeedId
      });

      expect(await trader.tokenToFeedId(existingToken)).to.equal(newFeedId);
      expect(await trader.feedIdToToken(newFeedId)).to.equal(existingToken);
      expect(await trader.feedIdToToken(existingFeedId)).to.equal(ADDRESS_ZERO);
    });

    it('should fail if not called by owner', async () => {
      const newToken = core.tokens.weth.address;
      const newFeedId = '0x1234567890123456789012345678901234567890123456789012345678901234';

      await expectThrow(
        trader.connect(core.hhUser1).ownerInsertOrUpdateTokenFeed(newToken, newFeedId),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerRemoveTokenFeed', () => {
    it('should work normally', async () => {
      const token = core.tokens.usdc.address;
      const feedId = CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'];
      expect(await trader.tokenToFeedId(token)).to.equal(feedId);
      expect(await trader.feedIdToToken(feedId)).to.equal(token);

      const res = await trader.connect(core.governance).ownerRemoveTokenFeed(token);
      await expectEvent(trader, res, 'TokenFeedRemoved', {
        _token: token
      });
      expect(await trader.tokenToFeedId(token)).to.equal(BYTES_ZERO);
      expect(await trader.feedIdToToken(feedId)).to.equal(ADDRESS_ZERO);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerRemoveTokenFeed(core.tokens.usdc.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerApproveLink', () => {
    it('should work normally', async () => {
      const amount = parseEther('100');
      expect(await core.tokens.link.allowance(trader.address, core.hhUser1.address)).to.equal(ZERO_BI);

      await trader.connect(core.governance).ownerApproveLink(core.hhUser1.address, amount);
      expect(await core.tokens.link.allowance(trader.address, core.hhUser1.address)).to.equal(amount);
    });

    it('should work normally for zero amount', async () => {
      await trader.connect(core.governance).ownerApproveLink(core.hhUser1.address, ZERO_BI);
      expect(await core.tokens.link.allowance(trader.address, core.hhUser1.address)).to.equal(ZERO_BI);
    });

    it('should work normally for max amount', async () => {
      await trader.connect(core.governance).ownerApproveLink(core.hhUser1.address, MAX_UINT_256_BI);
      expect(await core.tokens.link.allowance(trader.address, core.hhUser1.address)).to.equal(MAX_UINT_256_BI);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerApproveLink(core.hhUser1.address, ONE_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerWithdrawLink', () => {
    it('should work normally', async () => {
      const amount = parseEther('10');

      // Transfer some LINK to the trader first
      await setupLINKBalance(core, core.hhUser1, amount, core.dolomiteMargin);
      await core.tokens.link.transfer(trader.address, amount);
      expect(await core.tokens.link.balanceOf(trader.address)).to.equal(amount);
      expect(await core.tokens.link.balanceOf(core.hhUser5.address)).to.equal(ZERO_BI);

      await trader.connect(core.governance).ownerWithdrawLink(core.hhUser5.address, amount);
      expect(await core.tokens.link.balanceOf(trader.address)).to.equal(ZERO_BI);
      expect(await core.tokens.link.balanceOf(core.hhUser5.address)).to.equal(amount);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        trader.connect(core.hhUser1).ownerWithdrawLink(core.hhUser1.address, ONE_BI),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#_safeInt192ToUint256', () => {
    it('should work normally for positive values', async () => {
      const positiveValue = BigNumber.from('1000000000000000000'); // 1e18
      const result = await trader.testSafeInt192ToUint256(positiveValue);
      expect(result).to.equal(positiveValue);
    });

    it('should work normally for zero', async () => {
      const result = await trader.testSafeInt192ToUint256(ZERO_BI);
      expect(result).to.equal(ZERO_BI);
    });

    it('should work normally for maximum positive int192', async () => {
      const maxInt192 = BigNumber.from('2').pow(191).sub(1); // 2^191 - 1
      const result = await trader.testSafeInt192ToUint256(maxInt192);
      expect(result).to.equal(maxInt192);
    });

    it('should fail for negative values', async () => {
      const negativeValue = BigNumber.from('-1000000000000000000');
      await expectThrow(
        trader.testSafeInt192ToUint256(negativeValue),
        'ChainlinkDataStreamsTrader: Value is negative'
      );
    });

    it('should fail for minimum negative int192', async () => {
      const minInt192 = BigNumber.from('-2').pow(191); // -2^191
      await expectThrow(
        trader.testSafeInt192ToUint256(minInt192),
        'ChainlinkDataStreamsTrader: Value is negative'
      );
    });
  });

  describe('#_standardizeNumberOfDecimals', () => {
    it('should work normally for USDC (6 decimals)', async () => {
      const tokenDecimals = 6;
      const value = ONE_ETH_BI; // $1 from data stream report
      const valueDecimals = 18; // Data streams reports are in 18 decimals

      const result = await trader.testStandardizeNumberOfDecimals(tokenDecimals, value, valueDecimals);
      expect(result).to.equal(BigNumber.from(10).pow(30));
    });

    it('should work normally for WETH (18 decimals) to 36 decimals', async () => {
      const tokenDecimals = 18;
      const value = parseEther('2000'); // $2000 from data stream report
      const valueDecimals = 18; // Data streams reports are in 18 decimals

      const result = await trader.testStandardizeNumberOfDecimals(tokenDecimals, value, valueDecimals);
      expect(result).to.equal(parseEther('2000'));
    });
  });
});
