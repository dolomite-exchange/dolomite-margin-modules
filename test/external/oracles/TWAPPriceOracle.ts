import { expect } from 'chai';
import { BigNumber } from 'ethers';
import {
  TWAPPriceOracle,
  TWAPPriceOracle__factory,
  TestPair,
  TestPair__factory,
} from '../../../src/types';
import { getTWAPPriceOracleParams } from '../../../src/utils/constructors/oracles';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import {
  Network,
  ONE_DAY_SECONDS,
} from '../../../src/utils/no-deps-constants';
import { getRealLatestBlockNumber, revertToSnapshotAndCapture, snapshot } from '../../utils';
import { expectThrow } from '../../utils/assertions';
import { CoreProtocol, setupCoreProtocol } from '../../utils/setup';

const WETH_PRICE = BigNumber.from('1883923360000000000000');
// const BTC_PRICE = BigNumber.from('299800328339800000000000000000000');
// const USDC_PRICE = BigNumber.from('999937000000000000000000000000');
// const TEST_TOKEN_PRICE = WETH_PRICE.mul(1).div(10);
const FIFTEEN_MINUTES = BigNumber.from('900');

describe('TWAPPriceOracle', () => {
  let snapshotId: string;

  let core: CoreProtocol;
  let oracle: TWAPPriceOracle;

  before(async () => {
    const blockNumber = await getRealLatestBlockNumber(true, Network.ArbitrumOne);
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    oracle = (await createContractWithAbi<TWAPPriceOracle>(
      TWAPPriceOracle__factory.abi,
      TWAPPriceOracle__factory.bytecode,
      [
        core.camelotEcosystem!.grail.address,
        [{pairAddress: core.camelotEcosystem!.grailUsdcV3Pool.address, pairVersion: 1}],
        core.dolomiteMargin.address
      ]
    )).connect(core.governance);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#constructor', () => {
    it('should work normally', async () => {
      expect(await oracle.token()).to.eq(core.camelotEcosystem!.grail.address);
      expect(await oracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await oracle.observationInterval()).to.eq(FIFTEEN_MINUTES);
      expect(await oracle.getPairs()).to.deep.equal([core.camelotEcosystem!.grailUsdcV3Pool.address]);
    });
  });

  describe('#getPrice', () => {
    it('should work normally with usdc as output token', async () => {
      const price = await oracle.getPrice(core.camelotEcosystem!.grail.address);
      console.log(price.value.toString());
    });

    it('should work normally with weth as output token', async () => {
      await oracle.ownerRemovePair(core.camelotEcosystem!.grailUsdcV3Pool.address);
      await oracle.ownerAddPair({ pairAddress: core.camelotEcosystem!.grailWethV3Pool.address, pairVersion: 1});
      const price = await oracle.getPrice(core.camelotEcosystem!.grail.address);
      console.log(price.value.toString());
    });

    it('should work normally with two pairs', async () => {
      await oracle.ownerAddPair({ pairAddress: core.camelotEcosystem!.grailWethV3Pool.address, pairVersion: 1});
      const price = await oracle.getPrice(core.camelotEcosystem!.grail.address);
      console.log(price.value.toString());
    });

    // No pool with GRAIL for this so using ETH and ARB pool
    it('should work normally when output token is token0', async () => {
      const arb = '0x912CE59144191C1204E64559FE8253a0e49E6548';
      const otherOracle = await createContractWithAbi<TWAPPriceOracle>(
        TWAPPriceOracle__factory.abi,
        TWAPPriceOracle__factory.bytecode,
        [
        arb,
        [{pairAddress: '0xe51635ae8136aBAc44906A8f230C2D235E9c195F', pairVersion: 1}],
        core.dolomiteMargin.address
        ]
      );
      const price = await otherOracle.getPrice(arb);
      console.log(price.value.toString());
    });

    // @follow-up Do we want to implement v2 pools
    it('should fail if v2 pool', async () => {

    });

    it('should fail if invalid input token', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).getPrice(core.tokens.weth.address),
        `TWAPPriceOracle: Invalid token <${core.tokens.weth.address.toLowerCase()}>`,
      );
    });

    it('should fail if oracle contains no pairs', async () => {
      await oracle.ownerRemovePair(core.camelotEcosystem!.grailUsdcV3Pool.address);
      await expectThrow(
        oracle.connect(core.hhUser1).getPrice(core.camelotEcosystem!.grail.address),
        'TWAPPriceOracle: Oracle contains no pairs',
      );
    });
  });

  describe('#ownerSetObservationInterval', () => {
    it('works normally', async () => {
      const stalenessThreshold = ONE_DAY_SECONDS;
      await oracle.connect(core.governance).ownerSetObservationInterval(stalenessThreshold);
      expect(await oracle.observationInterval()).to.eq(stalenessThreshold);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerSetObservationInterval(ONE_DAY_SECONDS),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerAddPair', () => {
    it('can add a new pair if token is pair token0', async () => {
      await oracle.ownerRemovePair(core.camelotEcosystem!.grailUsdcV3Pool.address);
      expect(await oracle.getPairs()).to.deep.equal([]);
      await oracle.ownerAddPair({ pairAddress: core.camelotEcosystem!.grailUsdcV3Pool.address, pairVersion: 1});
      expect(await oracle.getPairs()).to.deep.equal([core.camelotEcosystem!.grailUsdcV3Pool.address]);
    });

    it('can add a new pair if token is pair token1', async () => {
      const myPair = await createContractWithAbi<TestPair>(
        TestPair__factory.abi,
        TestPair__factory.bytecode,
        [core.tokens.weth.address, core.camelotEcosystem!.grail.address]
      )
      await oracle.ownerAddPair({ pairAddress: myPair.address, pairVersion: 1});
      expect(await oracle.getPairs()).to.deep.equal([core.camelotEcosystem!.grailUsdcV3Pool.address, myPair.address]);
    });

    it('fails when pair does not contain token address', async () => {
      const myPair = await createContractWithAbi<TestPair>(
        TestPair__factory.abi,
        TestPair__factory.bytecode,
        [core.tokens.weth.address, core.tokens.usdc.address]
      )
      await expectThrow(
        oracle.connect(core.governance).ownerAddPair({ pairAddress: myPair.address, pairVersion: 1}),
        'TWAPPriceOracle: Pair must contain oracle token',
      );
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerAddPair({ pairAddress: core.camelotEcosystem!.grailUsdcV3Pool.address, pairVersion: 1}),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });

  describe('#ownerRemovePair', () => {
    it('can remove a pair', async () => {
      await oracle.ownerRemovePair(core.camelotEcosystem!.grailUsdcV3Pool.address);
      expect(await oracle.getPairs()).to.deep.equal([]);
    });

    it('fails when invoked by non-admin', async () => {
      await expectThrow(
        oracle.connect(core.hhUser1).ownerRemovePair(core.camelotEcosystem!.grailUsdcV3Pool.address),
        `OnlyDolomiteMargin: Caller is not owner of Dolomite <${core.hhUser1.address.toLowerCase()}>`,
      );
    });
  });
});
