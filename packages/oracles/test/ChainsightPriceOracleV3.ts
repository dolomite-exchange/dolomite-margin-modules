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
  IERC20,
  IERC20__factory,
} from '../src/types';
import { CoreProtocolBerachain } from 'packages/base/test/utils/core-protocols/core-protocol-berachain';
import { increase } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';
import {
  CHAINSIGHT_SENDER_ADDRESS_MAP,
  CHAINSIGHT_ORACLE_ADDRESS_MAP,
  CHAINSIGHT_KEYS_MAP,
  IBERA_MAP,
  IBGT_MAP,
  HENLO_MAP
} from 'packages/base/src/utils/constants';
import { getChainsightPriceOracleV3ConstructorParams } from '../src/oracles-constructors';

const OTHER_ADDRESS = '0x1234567812345678123456781234567812345678';

const IBGT_PRICE = parseEther('9.13');
const IBGT_PRICE_INVERSE = BigNumber.from('109529020000000000');

describe('ChainsightPriceOracleV3', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachain;
  let oracle: ChainsightPriceOracleV3;

  let ibgt: IERC20;
  let ibera: IERC20;

  before(async () => {
    core = await setupCoreProtocol({
      network: Network.Berachain,
      blockNumber: 2_870_000
    });

    ibgt = IERC20__factory.connect(IBGT_MAP[Network.Berachain].address, core.hhUser1);
    ibera = IERC20__factory.connect(IBERA_MAP[Network.Berachain].address, core.hhUser1);

    oracle = await createContractWithAbi<ChainsightPriceOracleV3>(
      ChainsightPriceOracleV3__factory.abi,
      ChainsightPriceOracleV3__factory.bytecode,
      getChainsightPriceOracleV3ConstructorParams(
        core,
        [ibgt.address, ibera.address],
        [
          CHAINSIGHT_KEYS_MAP[Network.Berachain][ibgt.address].key,
          CHAINSIGHT_KEYS_MAP[Network.Berachain][ibera.address].key
        ],
        [false, false],
      ),
    );

    const tokenInfos: TokenInfo[] = [
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: ibgt.address,
      },
      {
        oracleInfos: [
          { oracle: oracle.address, tokenPair: ADDRESS_ZERO, weight: 100 },
        ],
        decimals: 18,
        token: ibera.address,
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
      expect(await oracle.getKeyByToken(ibgt.address)).to.eq(
        CHAINSIGHT_KEYS_MAP[Network.Berachain][ibgt.address].key
      );
      expect(await oracle.getKeyByToken(ibera.address)).to.eq(
        CHAINSIGHT_KEYS_MAP[Network.Berachain][ibera.address].key
      );
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.DOLOMITE_REGISTRY()).to.eq(core.dolomiteRegistry.address);
    });

    it('should fail when token length is not aligned', async () => {
      await expectThrow(
        createContractWithAbi<ChainsightPriceOracleV3>(
          ChainsightPriceOracleV3__factory.abi,
          ChainsightPriceOracleV3__factory.bytecode,
          [
            CHAINSIGHT_ORACLE_ADDRESS_MAP[Network.Berachain],
            CHAINSIGHT_SENDER_ADDRESS_MAP[Network.Berachain],
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
            CHAINSIGHT_ORACLE_ADDRESS_MAP[Network.Berachain],
            CHAINSIGHT_SENDER_ADDRESS_MAP[Network.Berachain],
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
      expect((await oracle.getPrice(ibgt.address)).value).to.eq(IBGT_PRICE);
      expect((await core.oracleAggregatorV2.getPrice(ibgt.address)).value).to.eq(IBGT_PRICE);
    });

    it('returns the inverse if invertPrice is true', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        ibgt.address,
        CHAINSIGHT_KEYS_MAP[Network.Berachain][ibgt.address].key,
        true,
      );
      expect((await oracle.getPrice(ibgt.address)).value).to.eq(IBGT_PRICE_INVERSE);
    });

    it('reverts when caller is dolomite margin', async () => {
      const doloImpersonator = await impersonate(core.dolomiteMargin.address, true);
      await expectThrow(
        oracle.connect(doloImpersonator).getPrice(ibgt.address),
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
      const chainsight = IChainsightOracle__factory.connect(
        CHAINSIGHT_ORACLE_ADDRESS_MAP[Network.Berachain],
        core.hhUser1
      );
      const data = await chainsight.readAsUint256WithTimestamp(
        CHAINSIGHT_SENDER_ADDRESS_MAP[Network.Berachain],
        CHAINSIGHT_KEYS_MAP[Network.Berachain][ibgt.address].key,
      );
      await expectThrow(
        oracle.getPrice(ibgt.address),
        `ChainsightPriceOracleV3: Chainsight price expired <${ibgt.address.toLowerCase()}, ${data[1]}>`,
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
      expect(await oracle.chainsightOracle()).to.eq(CHAINSIGHT_ORACLE_ADDRESS_MAP[Network.Berachain]);

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
      expect(await oracle.chainsightSender()).to.eq(CHAINSIGHT_SENDER_ADDRESS_MAP[Network.Berachain]);

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
        HENLO_MAP[Network.Berachain].address,
        CHAINSIGHT_KEYS_MAP[Network.Berachain][HENLO_MAP[Network.Berachain].address].key,
        false,
      );
      expect(await oracle.getKeyByToken(HENLO_MAP[Network.Berachain].address)).to.eq(
        CHAINSIGHT_KEYS_MAP[Network.Berachain][HENLO_MAP[Network.Berachain].address].key
      );
      expect(await oracle.getInvertPriceByToken(HENLO_MAP[Network.Berachain].address)).to.eq(false);
    });

    it('can update an existing oracle', async () => {
      await oracle.connect(core.governance).ownerInsertOrUpdateOracleToken(
        ibgt.address,
        BYTES_ZERO,
        true,
      );
      expect(await oracle.getKeyByToken(ibgt.address)).to.eq(BYTES_ZERO);
      expect(await oracle.getInvertPriceByToken(ibgt.address)).to.eq(true);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerInsertOrUpdateOracleToken(
          HENLO_MAP[Network.Berachain].address,
          CHAINSIGHT_KEYS_MAP[Network.Berachain][HENLO_MAP[Network.Berachain].address].key,
          false,
        ),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
