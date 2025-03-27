import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  ADDRESS_ZERO,
  BYTES_ZERO,
  Network,
  ONE_DAY_SECONDS,
} from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import {
  impersonate,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { ZERO_ADDRESS } from '@openzeppelin/upgrades/lib/utils/Addresses';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { TokenInfo } from '../src';
import {
  ChainsightPriceOracleV3,
  ChainsightPriceOracleV3__factory,
  IChainsightOracle__factory,
} from '../src/types';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

const CHAINSIGHT_ORACLE_ADDRESS = '0xD5F76a363135A0781295043241f18496dAa31E3d';
const CHAINSIGHT_SENDER_ADDRESS = '0x16D90c83817Cf64d40321018C8FC1E7e62c427da';

const IBGT_ADDRESS = '0xac03CABA51e17c86c921E1f6CBFBdC91F8BB2E6b';
const CHAINSIGHT_KEY_IBGT = '0xb45dccc0c96fe02ddbcd663c80eaaa692f188e4bea2c6101135d358fc9535473';
const IBGT_PRICE = parseEther('9.13');
const IBGT_PRICE_INVERSE = BigNumber.from('109529020000000000');

const IBERA_ADDRESS = '0x9b6761bf2397Bb5a6624a856cC84A3A14Dcd3fe5';
const CHAINSIGHT_KEY_IBERA = '0xae0cd7d9dec07cb743c7d42a0ecc9b659e3a350b5e09e8c8dc353f8ac0083ce4';

const HENLO_ADDRESS = '0xb2F776e9c1C926C4b2e54182Fac058dA9Af0B6A5';
const CHAINSIGHT_KEY_HENLO = '0x9cd823bd88f3bc5680010088a5300e1e999c2b18ca81fd068bd56d6ccb051934';

describe('ChainsightPriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let oracle: ChainsightPriceOracleV3;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 2_870_000
    });

    oracle = await createContractWithAbi<ChainsightPriceOracleV3>(
      ChainsightPriceOracleV3__factory.abi,
      ChainsightPriceOracleV3__factory.bytecode,
      [
        CHAINSIGHT_ORACLE_ADDRESS,
        CHAINSIGHT_SENDER_ADDRESS,
        [IBGT_ADDRESS, IBERA_ADDRESS],
        [CHAINSIGHT_KEY_IBGT, CHAINSIGHT_KEY_IBERA],
        [false, false],
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ],
    );

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: IBGT_ADDRESS,
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: IBERA_ADDRESS,
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
    it('should work normally', async () => {
      expect(await oracle.stalenessThreshold()).to.eq(36 * 60 * 60);
      expect(await oracle.getKeyByToken(IBGT_ADDRESS)).to.eq(CHAINSIGHT_KEY_IBGT);
      expect(await oracle.getKeyByToken(IBERA_ADDRESS)).to.eq(CHAINSIGHT_KEY_IBERA);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainsightPriceOracleV3>(
          ChainsightPriceOracleV3__factory.abi,
          ChainsightPriceOracleV3__factory.bytecode,
          [
            CHAINSIGHT_ORACLE_ADDRESS,
            CHAINSIGHT_SENDER_ADDRESS,
            [ZERO_ADDRESS],
            [BYTES_ZERO, BYTES_ZERO],
            [false, false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChainsightPriceOracleV3: Invalid tokens length',
      );
    });

    it('should fail when key length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainsightPriceOracleV3>(
          ChainsightPriceOracleV3__factory.abi,
          ChainsightPriceOracleV3__factory.bytecode,
          [
            CHAINSIGHT_ORACLE_ADDRESS,
            CHAINSIGHT_SENDER_ADDRESS,
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [BYTES_ZERO, BYTES_ZERO],
            [false],
            core.dolomiteRegistry.address,
            core.dolomiteMargin.address,
          ],
        ),
        'ChainsightPriceOracleV3: Invalid keys length',
      );
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value for a token with 18 decimals', async () => {
      expect((await oracle.getPrice(IBGT_ADDRESS)).value).to.eq(IBGT_PRICE);
      expect((await core.oracleAggregatorV2.getPrice(IBGT_ADDRESS)).value).to.eq(IBGT_PRICE);
    });

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        IBGT_ADDRESS,
        CHAINSIGHT_KEY_IBGT,
        true,
      );
      expect((await oracle.getPrice(IBGT_ADDRESS)).value).to.eq(IBGT_PRICE_INVERSE);
    });

    it('reverts when caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(IBGT_ADDRESS),
        'ChainsightPriceOracleV3: DolomiteMargin cannot call',
      );
    });

    it('reverts when an invalid address is passed in', async () => {
      const ONE_ADDRESS = '0x1000000000000000000000000000000000000000';
      await expectThrow(
        oracle.getPrice(ZERO_ADDRESS),
        `ChainsightPriceOracleV3: Invalid token <${ZERO_ADDRESS}>`,
      );
      await expectThrow(
        oracle.getPrice(ONE_ADDRESS),
        `ChainsightPriceOracleV3: Invalid token <${ONE_ADDRESS}>`,
      );
    });

    it('reverts when the price is expired', async () => {
      await increase(ONE_DAY_SECONDS * 2);
      const chainsight = IChainsightOracle__factory.connect(CHAINSIGHT_ORACLE_ADDRESS, core.hhUser1);
      const data = await chainsight.readAsUint256WithTimestamp(
        CHAINSIGHT_SENDER_ADDRESS,
        CHAINSIGHT_KEY_IBGT,
      );
      await expectThrow(
        oracle.getPrice(IBGT_ADDRESS),
        `ChainsightPriceOracleV3: Chainsight price expired <${IBGT_ADDRESS.toLowerCase()}, ${data[1]}>`,
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
        `ChainsightPriceOracleV3: Staleness threshold too low <${stalenessThreshold.toFixed()}>`,
      );
    });

    it('fails when too high', async () => {
      const stalenessThreshold = (ONE_DAY_SECONDS * 7) + 1;
      await expectThrow(
        oracle.connect(core.governance).ownerSetStalenessThreshold(stalenessThreshold),
        `ChainsightPriceOracleV3: Staleness threshold too high <${stalenessThreshold.toFixed()}>`,
      );
    });
  });

  describe('#ownerSetChainsightOracle', () => {
    it('works normally', async () => {
      expect(await oracle.chainsightOracle()).to.eq(CHAINSIGHT_ORACLE_ADDRESS);

      const res = await oracle.connect(core.governance).ownerSetChainsightOracle(OTHER_ADDRESS);
      await expectEvent(oracle, res, 'ChainsightOracleUpdated', {
        chainsightOracle: OTHER_ADDRESS,
      });
      expect(await oracle.chainsightOracle()).to.eq(OTHER_ADDRESS);

    });

    it('fails when address zero', async () => {
      await expectThrow(
        oracle.connect(core.governance).ownerSetChainsightOracle(ZERO_ADDRESS),
        'ChainsightPriceOracleV3: Invalid chainsight oracle',
      );
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetChainsightOracle(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetChainsightSender', () => {
    it('works normally', async () => {
      expect(await oracle.chainsightSender()).to.eq(CHAINSIGHT_SENDER_ADDRESS);

      const res = await oracle.connect(core.governance).ownerSetChainsightSender(OTHER_ADDRESS);
      await expectEvent(oracle, res, 'ChainsightSenderUpdated', {
        chainsightSender: OTHER_ADDRESS,
      });
      expect(await oracle.chainsightSender()).to.eq(OTHER_ADDRESS);
    });

    it('fails when address zero', async () => {
      await expectThrow(
        oracle.connect(core.governance).ownerSetChainsightSender(ZERO_ADDRESS),
        'ChainsightPriceOracleV3: Invalid chainsight sender',
      );
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetChainsightSender(OTHER_ADDRESS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerInsertOrUpdateOracleToken', () => {
    it('can insert a new oracle', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        HENLO_ADDRESS,
        CHAINSIGHT_KEY_HENLO,
        false,
      );
      expect(await oracle.getKeyByToken(HENLO_ADDRESS)).to.eq(CHAINSIGHT_KEY_HENLO);
      expect(await oracle.getInvertPriceByToken(HENLO_ADDRESS)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        IBGT_ADDRESS,
        BYTES_ZERO,
        true,
      );
      expect(await oracle.getKeyByToken(IBGT_ADDRESS)).to.eq(BYTES_ZERO);
      expect(await oracle.getInvertPriceByToken(IBGT_ADDRESS)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          HENLO_ADDRESS,
          CHAINSIGHT_KEY_HENLO,
          false,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
