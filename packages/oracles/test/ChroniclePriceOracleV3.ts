import { CustomTestToken } from '@dolomite-exchange/modules-base/src/types';
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
  waitTime,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { CHRONICLE_PRICE_SCRIBES_MAP, REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import { TokenInfo } from '../src';
import {
  getChroniclePriceOracleV3ConstructorParams,
  getRedstonePriceOracleV3ConstructorParams,
} from '../src/oracles-constructors';
import {
  ChroniclePriceOracleV3,
  ChroniclePriceOracleV3__factory,
  IChronicleScribe__factory,
  RedstonePriceOracleV3,
  RedstonePriceOracleV3__factory,
  TestChronicleScribe,
  TestChronicleScribe__factory,
} from '../src/types';

const METH_PRICE = BigNumber.from('3237493823311432036070');
const METH_ETH_EXCHANGE_RATE = BigNumber.from('1027354527249591449');
const BTC_PRICE = BigNumber.from('635989069637405795488920000000000');
const WETH_PRICE = BigNumber.from('3151291727870000000000');

const CHRONICLE_AUTHED_ADDRESS = '0x39abd7819e5632fa06d2ecbba45dca5c90687ee3';

describe('ChroniclePriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolMantle;

  let oracle: ChroniclePriceOracleV3;
  let redstoneOracle: RedstonePriceOracleV3;
  let testScribe: TestChronicleScribe;
  let testToken: CustomTestToken;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.Mantle));

    testScribe = await createContractWithAbi<TestChronicleScribe>(
      TestChronicleScribe__factory.abi,
      TestChronicleScribe__factory.bytecode,
      [],
    );
    await testScribe.setLatestAnswer(TEN_BI.pow(18).div(10)); // 0.1E
    await testScribe.setDecimals(18);
    testToken = await createTestToken();

    const scribesMantle = CHRONICLE_PRICE_SCRIBES_MAP[Network.Mantle];
    oracle = await createContractWithAbi<ChroniclePriceOracleV3>(
      ChroniclePriceOracleV3__factory.abi,
      ChroniclePriceOracleV3__factory.bytecode,
      getChroniclePriceOracleV3ConstructorParams(
        core,
        Object.keys(scribesMantle),
        Object.keys(scribesMantle).map(k => scribesMantle[k].scribeAddress),
        [false, false, false, false],
      ),
    );
    const authedImpersonator = await impersonate(CHRONICLE_AUTHED_ADDRESS, true);
    for (const scribe of Object.values(scribesMantle)) {
      await IChronicleScribe__factory.connect(scribe.scribeAddress, authedImpersonator).kiss(oracle.address);
    }

    redstoneOracle = await createContractWithAbi<RedstonePriceOracleV3>(
      RedstonePriceOracleV3__factory.abi,
      RedstonePriceOracleV3__factory.bytecode,
      await getRedstonePriceOracleV3ConstructorParams(
        core,
        [core.tokens.weth.address],
        [REDSTONE_PRICE_AGGREGATORS_MAP[Network.Mantle][core.tokens.weth.address]!.aggregatorAddress],
        [false],
      ),
    );

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: redstoneOracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.weth.address,
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: core.tokens.weth.address, weight: 100 },
        ],
        decimals: 18,
        token: core.tokens.meth.address,
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 6,
        token: core.tokens.usdc.address,
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 8,
        token: core.tokens.wbtc.address,
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
      await createContractWithAbi<ChroniclePriceOracleV3>(
        ChroniclePriceOracleV3__factory.abi,
        ChroniclePriceOracleV3__factory.bytecode,
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
        createContractWithAbi<ChroniclePriceOracleV3>(
          ChroniclePriceOracleV3__factory.abi,
          ChroniclePriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChroniclePriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when aggregator length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChroniclePriceOracleV3>(
          ChroniclePriceOracleV3__factory.abi,
          ChroniclePriceOracleV3__factory.bytecode,
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChroniclePriceOracleV3: Invalid scribes length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      expect((await oracle.getPrice(core.tokens.meth.address)).value).to.eq(METH_ETH_EXCHANGE_RATE);
      expect((await core.oracleAggregatorV2.getPrice(core.tokens.meth.address)).value).to.eq(METH_PRICE);
    });

    it('returns the correct value for a token with less than 18 decimals', async () => {
      const price = await oracle.getPrice(core.tokens.wbtc.address);
      expect(price.value).to.eq(BTC_PRICE);
    });

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
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
      await testScribe.setLatestAnswer(parseEther('.5'));
      expect((await oracle.getPrice(testToken.address)).value).to.eq(parseEther('2'));
      expect((await core.oracleAggregatorV2.getPrice(testToken.address)).value).to.eq(WETH_PRICE.mul(2));
    });

    it('reverts when and caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
        false,
      );
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(testToken.address),
        'ChroniclePriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `ChroniclePriceOracleV3: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `ChroniclePriceOracleV3: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        testToken.address,
        testScribe.address,
        false,
      );
      await testScribe.setLatestAnswer(BigNumber.from('20000000000')); // $200
      await waitTime((60 * 60 * 36) + 1); // prices expire in 36 hours by default
      const data = await testScribe.latestRoundData();
      await expectThrow(
        oracle.getPrice(testToken.address),
        `ChroniclePriceOracleV3: Chronicle price expired <${testToken.address.toLowerCase()}, ${data.updatedAt}>`,
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
        `ChroniclePriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.connect(core.governance).ownerSetStalenessThreshold(stalenessThreshold),
        `ChroniclePriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      const tokenAddress = testToken.address;
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testScribe.address,
        false,
      );
      expect(await oracle.getScribeByToken(tokenAddress)).to.eq(testScribe.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      const tokenAddress = core.tokens.wbtc.address;
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        tokenAddress,
        testScribe.address,
        true,
      );
      expect(await oracle.getScribeByToken(tokenAddress)).to.eq(testScribe.address);
      expect(await oracle.getInvertPriceByToken(tokenAddress)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          testToken.address,
          testScribe.address,
          false,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
