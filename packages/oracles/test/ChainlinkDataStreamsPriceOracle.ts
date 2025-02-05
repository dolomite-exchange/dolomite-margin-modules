import { BYTES_ZERO, Network, ONE_ETH_BI, TEN_BI } from 'packages/base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { setupCoreProtocol, setupLINKBalance } from 'packages/base/test/utils/setup';
import {
  ChainlinkDataStreamsPriceOracle,
  ChainlinkDataStreamsPriceOracle__factory,
  IVerifierProxy,
  IVerifierProxy__factory,
  TestVerifierProxy,
  TestVerifierProxy__factory
} from '../src/types';
import { CHAINLINK_DATA_STREAM_FEEDS_MAP, CHAINLINK_VERIFIER_PROXY_MAP } from 'packages/base/src/utils/constants';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import {
  getBlockTimestamp,
  getLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot
} from 'packages/base/test/utils';
import { expect } from 'chai';
import { expectEvent, expectThrow } from 'packages/base/test/utils/assertions';
import { getLatestChainlinkDataStreamReport, getPriceFromReport, getTestPayloads } from '../src/chainlink-data-streams';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { increase, setNextBlockTimestamp } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import { getChainlinkDataStreamsPriceOracleConstructorParams } from '../src/oracles-constructors';

const STANDARDIZED_USDC_PRICE = BigNumber.from('1000000000000000000000000000000'); // 1 with 30 decimals

describe('ChainlinkDataStreamsPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: ChainlinkDataStreamsPriceOracle;
  let testOracle: ChainlinkDataStreamsPriceOracle;
  let verifierProxy: IVerifierProxy;
  let testVerifierProxy: TestVerifierProxy;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.ArbitrumOne,
      blockNumber: 221_470_000,
    });

    verifierProxy = IVerifierProxy__factory.connect(CHAINLINK_VERIFIER_PROXY_MAP[Network.ArbitrumOne], core.hhUser1);
    testVerifierProxy = await createContractWithAbi<TestVerifierProxy>(
      TestVerifierProxy__factory.abi,
      TestVerifierProxy__factory.bytecode,
      []
    );

    oracle = await createContractWithAbi<ChainlinkDataStreamsPriceOracle>(
      ChainlinkDataStreamsPriceOracle__factory.abi,
      ChainlinkDataStreamsPriceOracle__factory.bytecode,
      getChainlinkDataStreamsPriceOracleConstructorParams(
        core,
        verifierProxy,
        [core.tokens.usdc, core.tokens.usdt],
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']]
      )
    );
    testOracle = await createContractWithAbi<ChainlinkDataStreamsPriceOracle>(
      ChainlinkDataStreamsPriceOracle__factory.abi,
      ChainlinkDataStreamsPriceOracle__factory.bytecode,
      getChainlinkDataStreamsPriceOracleConstructorParams(
        core,
        testVerifierProxy,
        [core.tokens.usdc, core.tokens.usdt],
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']]
      )
    );
    await setupLINKBalance(core, core.governance, parseEther('100'), oracle);
    await core.tokens.link.connect(core.governance).transfer(oracle.address, parseEther('100'));

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.LINK()).to.equal(core.tokens.link.address);
      expect(await oracle.VERIFIER_PROXY()).to.equal(verifierProxy.address);
      expect(await oracle.DOLOMITE_REGISTRY()).to.equal(core.dolomiteRegistry.address);
      expect(await oracle.DOLOMITE_MARGIN()).to.equal(core.dolomiteMargin.address);
      expect(await oracle.stalenessThreshold()).to.equal(10);

      expect(await oracle.tokenToFeedId(core.tokens.usdc.address)).to.equal(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);
      expect(await oracle.tokenToFeedId(core.tokens.usdt.address)).to.equal(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']);
      expect(await oracle.feedIdToToken(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'])).to.equal(core.tokens.usdc.address);
      expect(await oracle.feedIdToToken(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT'])).to.equal(core.tokens.usdt.address);
    });

    it('should fail if invalid array lengths', async () => {
      await expectThrow(
        createContractWithAbi<ChainlinkDataStreamsPriceOracle>(
          ChainlinkDataStreamsPriceOracle__factory.abi,
          ChainlinkDataStreamsPriceOracle__factory.bytecode,
          [
            core.tokens.link.address,
            verifierProxy.address,
            [core.tokens.usdc.address, core.tokens.usdt.address],
            [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ]
        ),
        'ChainlinkDataStreamsPriceOracle: Invalid tokens length'
      );
    });
  });

  describe('#postPrices', () => {
    it('should work normally with real reports', async () => {
      const usdcReport = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);
      await oracle.postPrices([usdcReport.report.fullReport]);
      expect((await oracle.getPrice(core.tokens.usdc.address)).value).to.equal(
        getPriceFromReport(usdcReport).mul(TEN_BI.pow(12))
      );
    });

    it('should fail if price already set', async () => {
      const usdcReport = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']);
      await oracle.postPrices([usdcReport.report.fullReport]);
      // Using call static to replicate being on same block
      await expectThrow(
        oracle.callStatic.postPrices([usdcReport.report.fullReport]),
        'ChainlinkDataStreamsPriceOracle: Price already set'
      );
    });

    it('should work normally with test verifier', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const reports = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']],
        [ONE_ETH_BI, ONE_ETH_BI],
        BigNumber.from(timestamp)
      );
      await setNextBlockTimestamp(timestamp.add(9));
      await testOracle.postPrices(reports);
      expect((await testOracle.getPrice(core.tokens.usdc.address)).value).to.equal(STANDARDIZED_USDC_PRICE);
      expect((await testOracle.getPrice(core.tokens.usdt.address)).value).to.equal(STANDARDIZED_USDC_PRICE);
    });

    it('should fail if feed id is invalid', async () => {
      const daiReport = await getLatestChainlinkDataStreamReport(CHAINLINK_DATA_STREAM_FEEDS_MAP['DAI']);
      await expectThrow(
        oracle.postPrices([daiReport.report.fullReport]),
        'ChainlinkDataStreamsPriceOracle: Invalid feed ID'
      );
    });

    it('should fail if report is old', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const reports = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC'], CHAINLINK_DATA_STREAM_FEEDS_MAP['USDT']],
        [ONE_ETH_BI, ONE_ETH_BI],
        timestamp
      );
      await setNextBlockTimestamp(timestamp.add(10));
      await expectThrow(
        testOracle.postPrices(reports),
        'ChainlinkDataStreamsPriceOracle: Report is too old'
      );
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const reports = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [ONE_ETH_BI],
        BigNumber.from(timestamp)
      );
      await setNextBlockTimestamp(timestamp.add(1));
      await testOracle.postPrices(reports);
      const price = await testOracle.callStatic.getPrice(core.tokens.usdc.address);
      expect(price.value).to.equal(ONE_ETH_BI.mul(TEN_BI.pow(12)));
    });

    it('should fail if price not set', async () => {
      const timestamp = BigNumber.from(await getBlockTimestamp(await getLatestBlockNumber()));
      const reports = getTestPayloads(
        [CHAINLINK_DATA_STREAM_FEEDS_MAP['USDC']],
        [ONE_ETH_BI],
        BigNumber.from(timestamp)
      );
      await setNextBlockTimestamp(timestamp.add(1));
      await testOracle.postPrices(reports);
      await increase(1);
      await expectThrow(
        testOracle.getPrice(core.tokens.usdc.address),
        `ChainlinkDataStreamsPriceOracle: Price not found <${core.tokens.usdc.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerSetStalenessThreshold', () => {
    it('should work normally', async () => {
      expect(await oracle.stalenessThreshold()).to.equal(10);
      const res = await oracle.connect(core.governance).ownerSetStalenessThreshold(20);
      await expectEvent(oracle, res, 'StalenessDurationUpdated', {
        stalenessThreshold: 20
      });
      expect(await oracle.stalenessThreshold()).to.equal(20);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetStalenessThreshold(20),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('should work normally', async () => {
      const res = await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        core.tokens.usdc.address,
        BYTES_ZERO
      );
      await expectEvent(oracle, res, 'TokenInsertedOrUpdated', {
        token: core.tokens.usdc.address,
        feedId: BYTES_ZERO,
      });

      expect(await oracle.tokenToFeedId(core.tokens.usdc.address)).to.equal(BYTES_ZERO);
      expect(await oracle.feedIdToToken(BYTES_ZERO)).to.equal(core.tokens.usdc.address);
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(core.tokens.usdc.address, BYTES_ZERO),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerApproveLink', () => {
    it('should work normally', async () => {
      await oracle.connect(core.governance).ownerApproveLink(core.hhUser2.address, parseEther('100'));
      expect(await core.tokens.link.allowance(oracle.address, core.hhUser2.address)).to.equal(parseEther('100'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerApproveLink(core.hhUser2.address, parseEther('100')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });

  describe('#ownerWithdrawLink', () => {
    it('should work normally', async () => {
      await oracle.connect(core.governance).ownerWithdrawLink(core.hhUser2.address, parseEther('100'));
      expect(await core.tokens.link.balanceOf(core.hhUser2.address)).to.equal(parseEther('100'));
    });

    it('should fail if not called by owner', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerWithdrawLink(core.hhUser2.address, parseEther('100')),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`
      );
    });
  });
});
