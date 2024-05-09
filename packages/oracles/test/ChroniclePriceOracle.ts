import { CoreProtocolMantle } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  ChroniclePriceOracle,
  ChroniclePriceOracle__factory,
  IChronicleScribe__factory,
  TestChronicleScribe,
  TestChronicleScribe__factory,
} from '../src/types';
import {
  CustomTestToken
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi, createTestToken } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  Network,
  ONE_DAY_SECONDS,
  TEN_BI,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
  waitTime
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { TokenInfo } from '../src';
import { CHRONICLE_PRICE_SCRIBES_MAP } from 'packages/base/src/utils/constants';
import { getChroniclePriceOracleConstructorParams } from '../src/oracles-constructors';

const METH_PRICE = BigNumber.from('3212902127441006623686');
const BTC_PRICE = BigNumber.from('635989069637405795488920000000000');
const WETH_PRICE = BigNumber.from('3129580341517135879233');

const CHRONICLE_AUTHED_ADDRESS = '0x39abd7819e5632fa06d2ecbba45dca5c90687ee3';

describe('ChroniclePriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;

  let oracle: ChroniclePriceOracle;
  let testScribe: TestChronicleScribe;
  let testToken: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol(await getDefaultCoreProtocolConfig(Network.Mantle));

    testScribe = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await testScribe.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testScribe.setDecimals(18);
    testToken = await createTestToken();

    const scribesMantle: Record<string, string> = CHRONICLE_PRICE_SCRIBES_MAP[Network.Mantle];
    oracle = await createContractWithAbi<ChroniclePriceOracle>(
      ChroniclePriceOracle__factory.abi,
      ChroniclePriceOracle__factory.bytecode,
      getChroniclePriceOracleConstructorParams(
        Object.keys(scribesMantle),
        Object.values(scribesMantle),
        [false, false, false, false],
        core
      ),
    );
    const authedImpersonator = await impersonate(CHRONICLE_AUTHED_ADDRESS, true);
    for (const scribe of Object.values(scribesMantle)) {
      await IChronicleScribe__factory.connect(scribe, authedImpersonator).kiss(oracle.address);
    }

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.meth.address
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 6,
        token: core.tokens.usdc.address
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 8,
        token: core.tokens.wbtc.address
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weth.address
      },
    ];
    for (const tokenInfo of tokenInfos) {
      await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
    }

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should succeed when values are aligned', async () => {
      await createContractWithAbi<ChroniclePriceOracle>(
        ChroniclePriceOracle__factory.abi,
        ChroniclePriceOracle__factory.bytecode,
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
        createContractWithAbi<ChroniclePriceOracle>(
          ChroniclePriceOracle__factory.abi,
          ChroniclePriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChroniclePriceOracle: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChroniclePriceOracle>(
          ChroniclePriceOracle__factory.abi,
          ChroniclePriceOracle__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChroniclePriceOracle: Invalid scribes length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.meth.address);
      expect(price.value).to.eq(METH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(BTC_PRICE);
    });

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
        true
      );
      const tokenInfo: TokenInfo = {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: testToken.address,
      };
      await core.oracleAggregatorV2.ownerInsertOrUpdateToken(tokenInfo);
      await testScribe.setLatestAnswer(parseEther('.5'));
      expect((await oracle.getPrice(testToken.address)).value).to.eq(parseEther('2'));
      expect((await core.oracleAggregatorV2.getPrice(testToken.address)).value).to.eq(WETH_PRICE.mul(2));
    });

    it('reverts when and caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
        false
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'ChroniclePriceOracle: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `ChroniclePriceOracle: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `ChroniclePriceOracle: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
        false
      );
      await testScribe.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      const data = await testScribe.latestRoundData();
      await expectThrow(
        oracle.getPrice(testToken.address),
        `ChroniclePriceOracle: Chronicle price expired <${testToken.address.toLowerCase()}, ${data.updatedAt}>`,
      );
    });
  });

  describe('#ownerSetStalenessThreshold', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS + 1234;
      await oracle.connect(core.governance).ownerSetStalenessThreshold(stalenessThreshold);
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
        oracle.connect(core.governance).ownerSetStalenessThreshold(stalenessThreshold),
        `ChroniclePriceOracle: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.connect(core.governance).ownerSetStalenessThreshold(stalenessThreshold),
        `ChroniclePriceOracle: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testScribe.address,
        false
      );
      expect(await oracle.getScribeByToken(tokenAddress)).to.eq(testScribe.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testScribe.address,
        true
      );
      expect(await oracle.getScribeByToken(tokenAddress)).to.eq(testScribe.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          testScribe.address,
          false
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
