
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  ChainlinkPriceOracleV3,
  ChainlinkPriceOracleV3__factory,
  OracleAggregatorV2,
  OracleAggregatorV2__factory,
  TWAPPriceOracleV2,
  TWAPPriceOracleV2__factory
} from '../src/types';
import { DolomiteRegistryImplementation, DolomiteRegistryImplementation__factory } from '@dolomite-exchange/modules-base/src/types';
import { getChainlinkPriceOracleV3ConstructorParamsFromChainlinkOracleV1, getTWAPPriceOracleV2ConstructorParams } from '../src/oracles-constructors';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_DAY_SECONDS } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { expectThrow } from '@dolomite-exchange/modules-base/test/utils/assertions';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { TokenInfo } from '../src';
import { CoreProtocolBerachainBartio } from 'packages/base/test/utils/core-protocols/core-protocol-berachain-bartio';
import { TestBexPriceOracle } from '../src/types/contracts/test/TestBexPriceOracle';
import { TestBexPriceOracle__factory } from '../src/types/factories/contracts/test/TestBexPriceOracle__factory';

const ARB_WETH_POOL = '0xe51635ae8136aBAc44906A8f230C2D235E9c195F';
const ARB_PRICE_WETH_POOL = BigNumber.from('920176763082082501');

const GRAIL_PRICE_USDC_POOL = BigNumber.from('789325473810421340000');
const GRAIL_PRICE_WETH_POOL = BigNumber.from('792088096763836295510');
const FIFTEEN_MINUTES = BigNumber.from('900');

describe('TWAPPriceOracleV2', () => {
  let snapshotId: string;

  let core: CoreProtocolBerachainBartio;
  let testBexPriceOracle: TestBexPriceOracle;

  before(async () => {
    core = await setupCoreProtocol(getDefaultCoreProtocolConfig(Network.Berachain));

    testBexPriceOracle = await createContractWithAbi<TestBexPriceOracle>(
      TestBexPriceOracle__factory.abi,
      TestBexPriceOracle__factory.bytecode,
      [],
    );

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#getPrice', () => {
    it('should work normally with usdc as output token', async () => {
      // Reverts:
      const price = await testBexPriceOracle.getPrice(core.tokens.wbera.address);
      console.log('price', price.toString());
    });
  });
});
