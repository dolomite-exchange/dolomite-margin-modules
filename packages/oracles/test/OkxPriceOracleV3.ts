import { CustomTestToken } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceAggregatorByToken } from '@dolomite-exchange/modules-base/src/utils/constants';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS, TEN_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { CoreProtocolXLayer } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { TokenInfo } from '../src';
import { getChainlinkPriceOracleV3ConstructorParams } from '../src/oracles-constructors';
import {
  OkxPriceOracleV3,
  OkxPriceOracleV3__factory,
  TestChainlinkAggregator,
  TestChainlinkAggregator__factory,
} from '../src/types';

const WETH_PRICE = BigNumber.from('3168730000000000000000');
const BTC_PRICE = BigNumber.from('620147200000000000000000000000000');

describe('OkxPriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolXLayer;

  let oracle: OkxPriceOracleV3;
  let testAggregator: TestChainlinkAggregator;
  let testToken: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.XLayer));

    testAggregator = await createContractWithAbi<TestChainlinkAggregator>(
      TestChainlinkAggregator__factory.abi,
      TestChainlinkAggregator__factory.bytecode,
      [],
    );
    testToken = await createTestToken();
    await testAggregator.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testAggregator.setDecimals(18);
    oracle = (await createContractWithAbi<OkxPriceOracleV3>(
      OkxPriceOracleV3__factory.abi,
      OkxPriceOracleV3__factory.bytecode,
      getChainlinkPriceOracleV3ConstructorParams(
        [core.tokens.weth, core.tokens.wbtc],
        [
          getChainlinkPriceAggregatorByToken(core, core.tokens.weth),
          getChainlinkPriceAggregatorByToken(core, core.tokens.wbtc),
        ],
        [false, false],
        core.dolomiteRegistry,
        core.dolomiteMargin,
      ),
    )).connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<OkxPriceOracleV3>(
        OkxPriceOracleV3__factory.abi,
        OkxPriceOracleV3__factory.bytecode,
        [
          [ZERO_ADDRESS],
          [ZERO_ADDRESS],
          [false],
          core.dolomiteRegistry.address,
          core.dolomiteMargin.address,
        ],
      );
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<OkxPriceOracleV3>(
          OkxPriceOracleV3__factory.abi,
          OkxPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'OkxPriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<OkxPriceOracleV3>(
          OkxPriceOracleV3__factory.abi,
          OkxPriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'OkxPriceOracleV3: Invalid aggregators length',
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
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        true,
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
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
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false,
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'OkxPriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `OkxPriceOracleV3: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `OkxPriceOracleV3: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.ownerInsertOrUpdateOracleToken(
        testToken.address,
        testAggregator.address,
        false,
      );
      await testAggregator.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      const data = await testAggregator.latestRoundData();
      await expectThrow(
        oracle.getPrice(testToken.address),
        `OkxPriceOracleV3: OKX price expired <${testToken.address.toLowerCase()}, ${data.updatedAt.toString()}>`,
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
        `OkxPriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.ownerSetStalenessThreshold(stalenessThreshold),
        `OkxPriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        false,
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testAggregator.address,
        true,
      );
      expect(await oracle.getAggregatorByToken(tokenAddress)).to.eq(testAggregator.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          testAggregator.address,
          false,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});