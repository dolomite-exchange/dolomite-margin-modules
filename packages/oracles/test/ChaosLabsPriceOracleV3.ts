import {
  CustomTestToken,
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  MAX_INT_192_BI,
  Network,
  ONE_BI,
  ONE_DAY_SECONDS,
  TEN_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CHAINLINK_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { TokenInfo } from '../src';
import { getChaosLabsPriceOracleV3ConstructorParams } from '../src/oracles-constructors';
import {
  ChaosLabsPriceOracleV3,
  ChaosLabsPriceOracleV3__factory,
  IChainlinkAggregator__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';

const WETH_PRICE = BigNumber.from('3584904892000000000000');
const BTC_PRICE = BigNumber.from('972186287671300000000000000000000');

describe('ChaosLabsPriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;

  let oracle: ChaosLabsPriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 279_600_000,
      network: Network.ArbitrumOne,
    });

    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testAggregator.setDecimals(18);

    // const glvToken = core.glvEcosystem.glvTokens.wethUsdc.glvToken;
    // const glvTokenAggregator = IChainlinkAggregator__factory.connect(
    //   CHAOS_LABS_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][glvToken.address]!.aggregatorAddress,
    //   core.hhUser1,
    // );
    const ethAggregator = IChainlinkAggregator__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.weth.address]!.aggregatorAddress,
      core.hhUser1,
    );
    const wbtcAggregator = IChainlinkAggregator__factory.connect(
      CHAINLINK_PRICE_AGGREGATORS_MAP[Network.ArbitrumOne][core.tokens.wbtc.address]!.aggregatorAddress,
      core.hhUser1,
    );
    oracle = await createContractWithAbi<ChaosLabsPriceOracleV3>(
      ChaosLabsPriceOracleV3__factory.abi,
      ChaosLabsPriceOracleV3__factory.bytecode,
      getChaosLabsPriceOracleV3ConstructorParams(
        [testToken, core.tokens.weth, core.tokens.wbtc],
        [testAggregator, ethAggregator, wbtcAggregator],
        [false, false, false],
        core.dolomiteRegistry,
        core.dolomiteMargin,
      ),
    );
    oracle = oracle.connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<ChaosLabsPriceOracleV3>(
        ChaosLabsPriceOracleV3__factory.abi,
        ChaosLabsPriceOracleV3__factory.bytecode,
        [[ZERO_ADDRESS], [ZERO_ADDRESS], [false], core.dolomiteRegistry.address, core.dolomiteMargin.address],
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChaosLabsPriceOracleV3>(
          ChaosLabsPriceOracleV3__factory.abi,
          ChaosLabsPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChaosLabsPriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChaosLabsPriceOracleV3>(
          ChaosLabsPriceOracleV3__factory.abi,
          ChaosLabsPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChaosLabsPriceOracleV3: Invalid aggregators length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.weth.address);
      expect(price.value).to.eq(WETH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(BTC_PRICE);
    });

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(testToken.address, testAggregator.address, true);
      const tokenInfo: TokenInfo = {
        oracleInfos: [{ oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
        decimals: 18,
        token: testToken.address,
      };
      await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
      await testAggregator.setLatestAnswer(parseEther('.5'));
      const price = await oracle.getPrice(testToken.address);
      expect(price.value).to.eq(parseEther('2'));
    });

    it('reverts when and caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.ownerInsertOrUpdateOracleToken(testToken.address, testAggregator.address, false);
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'ChaosLabsPriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(oracle.getPrice(ZERO_ADDRESS), `ChaosLabsPriceOracleV3: Invalid token <${ZERO_ADDRESS}>`);
      await expectThrow(oracle.getPrice(ONE_ADDRESS), `ChaosLabsPriceOracleV3: Invalid token <${ONE_ADDRESS}>`);
    });

    it('reverts when the price is expired', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(testToken.address, testAggregator.address, false);
      await testAggregator.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime(60 * 60 * 36 + 1); // prices expire in 36 hours by default
      const data = await testAggregator.latestRoundData();
      await expectThrow(
        oracle.getPrice(testToken.address),
        `ChaosLabsPriceOracleV3: Chaos Labs price expired <${testToken.address.toLowerCase()}, ${data.updatedAt}>`,
      );
    });
  });

  describe('#ownerSetStalenessThreshold', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS + 1234;
      await oracle.ownerSetStalenessThreshold(stalenessThreshold);
      expect(await oracle.stalenessThreshold()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetStalenessThreshold(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });

    it('fails when too low', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS - 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `ChaosLabsPriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS * 7 + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `ChaosLabsPriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.ownerInsertOrUpdateOracleToken(tokenAddress, testAggregator.address, false);
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.ownerInsertOrUpdateOracleToken(tokenAddress, testAggregator.address, true);
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(testToken.address, testAggregator.address, false),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
