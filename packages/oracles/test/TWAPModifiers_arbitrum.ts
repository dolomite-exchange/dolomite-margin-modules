import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { MAX_UINT_112_BI, Network, ONE_ETH_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { revertToSnapshotAndCapture, snapshot } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { DOLO_WBERA_KODIAK_POOL_MAP, IBERA_WBERA_KODIAK_POOL_MAP } from 'packages/base/src/utils/constants';
import {
  CamelotV3PriceOracleWithModifiers,
  CamelotV3PriceOracleWithModifiers__factory,
  PancakeV3PriceOracleWithModifiers,
  PancakeV3PriceOracleWithModifiers__factory,
} from '../src/types';
import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import { parseEther } from 'ethers/lib/utils';

const FIFTEEN_MINUTES = BigNumber.from('900');

describe('TWAPModifiers_arbitrum', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let pancakeOracle: PancakeV3PriceOracleWithModifiers;
  let camelotOracle: CamelotV3PriceOracleWithModifiers;

  before(async () => {
    const blockNumber = 478_637_000;
    core = await setupCoreProtocol({
      blockNumber,
      network: Network.ArbitrumOne,
    });

    console.log("jones price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.jones)).value)
    console.log("premia price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.premia)).value)
    console.log("grail price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.grail)).value)

    pancakeOracle = await createContractWithAbi<PancakeV3PriceOracleWithModifiers>(
      PancakeV3PriceOracleWithModifiers__factory.abi,
      PancakeV3PriceOracleWithModifiers__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    camelotOracle = await createContractWithAbi<CamelotV3PriceOracleWithModifiers>(
      CamelotV3PriceOracleWithModifiers__factory.abi,
      CamelotV3PriceOracleWithModifiers__factory.bytecode,
      [core.dolomiteRegistry.address, core.dolomiteMargin.address],
    );

    // JONES
    await camelotOracle.connect(core.governance).ownerSetTokenInfo(
      core.tokens.jones.address,
      {
        pair: "0x0e878029D18cD7F630823439cf389d1601d9dbD9",
        decimals: 18,
        observationInterval: 900,
        minPrice: parseEther('0.00005'), // measured in WETH
        maxPrice: parseEther('0.00015')
      }
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.jones.address,
      decimals: 18,
      oracleInfos: [{ oracle: camelotOracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
    });

    // PREMIA
    await camelotOracle.connect(core.governance).ownerSetTokenInfo(
      core.tokens.premia.address,
      {
        pair: "0xc3e254E39c45c7886A12455cb8207c808486FAC3",
        decimals: 18,
        observationInterval: 900,
        minPrice: parseEther('0.000005'), // measured in WETH
        maxPrice: parseEther('0.00015')
      }
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.premia.address,
      decimals: 18,
      oracleInfos: [{ oracle: camelotOracle.address, tokenPair: core.tokens.weth.address, weight: 100 }],
    });

    // GRAIL
    await camelotOracle.connect(core.governance).ownerSetTokenInfo(
      core.tokens.grail.address,
      {
        pair: "0x8cc8093218bCaC8B1896A1EED4D925F6F6aB289F",
        decimals: 18,
        observationInterval: 900,
        minPrice: parseEther('35'), // measured in WETH
        maxPrice: parseEther('55')
      }
    );
    await core.oracleAggregatorV2.connect(core.governance).ownerInsertOrUpdateToken({
      token: core.tokens.grail.address,
      decimals: 18,
      oracleInfos: [{ oracle: camelotOracle.address, tokenPair: core.tokens.usdc.address, weight: 100 }],
    });

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#jones', () => {
    it('works normally', async () => {
      console.log("jones price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.jones)).value)
    });
  });

  describe('#premia', () => {
    it('works normally', async () => {
      console.log("premia price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.premia)).value)
    });
  });

  describe('#grail', () => {
    it('works normally', async () => {
      console.log("grail price: ", (await core.dolomiteMargin.getMarketPrice(core.marketIds.grail)).value)
    });
  });
});
