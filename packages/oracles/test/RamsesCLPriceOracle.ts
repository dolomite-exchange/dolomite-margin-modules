import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  RamsesCLPriceOracle,
  RamsesCLPriceOracle__factory,
} from '../src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, ONE_DAY_SECONDS, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectEvent, expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '../src';

const GRAI_TOKEN = '0x894134a25a5faC1c2C26F1d8fBf05111a3CB9487';
const GRAI_WEETH_POOL = '0xc23F681729AD2E970c2E630CbEf67edFab0c37e0';

const GRAI_PRICE_WE_ETH_POOL = BigNumber.from('988633194952886775');
const FIFTEEN_MINUTES = BigNumber.from('900');

describe('RamsesCLPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let graiWeEthOracle: RamsesCLPriceOracle;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await 208_810_047,
      network: Network.ArbitrumOne,
    });

    graiWeEthOracle = await createContractWithAbi<RamsesCLPriceOracle>(
      RamsesCLPriceOracle__factory.abi,
      RamsesCLPriceOracle__factory.bytecode,
      [
        GRAI_TOKEN,
        GRAI_WEETH_POOL,
        core.dolomiteRegistry.address,
        core.dolomiteMargin.address,
      ]
    );

    const tokenInfo: TokenInfo = {
      oracleInfos: [
        { oracle: graiWeEthOracle.address, tokenPair: core.tokens.weEth.address, weight: 100 },
      ],
      decimals: 18,
      token: GRAI_TOKEN
    };
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken(tokenInfo);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await graiWeEthOracle.TOKEN()).to.eq(GRAI_TOKEN);
      expect(await graiWeEthOracle.TOKEN_DECIMALS_FACTOR()).to.eq(parseEther('1'));
      expect(await graiWeEthOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await graiWeEthOracle.observationInterval()).to.eq(FIFTEEN_MINUTES);
      expect(await graiWeEthOracle.PAIR()).to.eq(GRAI_WEETH_POOL);
    });
  });

  describe('#getPrice', () => {
    it('should work normally', async () => {
      const price = await core.oracleAggregatorV2.getPrice(GRAI_TOKEN);
      expect(price.value).to.eq(GRAI_PRICE_WE_ETH_POOL);
    });

    it('should work normally with token1', async () => {
      const oracle = await createContractWithAbi<RamsesCLPriceOracle>(
        RamsesCLPriceOracle__factory.abi,
        RamsesCLPriceOracle__factory.bytecode,
        [
          core.tokens.weEth.address,
          GRAI_WEETH_POOL,
          core.dolomiteRegistry.address,
          core.dolomiteMargin.address,
        ]
      );
      const weEthPriceInGrai = (await oracle.getPrice(core.tokens.weEth.address)).value;
      const graiPrice = (await core.oracleAggregatorV2.getPrice(GRAI_TOKEN)).value;
      const weEthPriceFromAggregator = (await core.oracleAggregatorV2.getPrice(core.tokens.weEth.address)).value;
      // Approximately equal
      expect(weEthPriceInGrai.mul(graiPrice).div(ONE_ETH_BI))
        .to.be.closeTo(weEthPriceFromAggregator, BigNumber.from('10000000'));
    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        graiWeEthOracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `TWAPPriceOracleV2: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerSetObservationInterval', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS;
      const res = await graiWeEthOracle.connect(core.governance).ownerSetObservationInterval(stalenessThreshold);
      await expectEvent(graiWeEthOracle, res, 'ObservationIntervalUpdated', {
        observationInterval: stalenessThreshold
      });
      expect(await graiWeEthOracle.observationInterval()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        graiWeEthOracle.connect(core.hhUser1).ownerSetObservationInterval(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
