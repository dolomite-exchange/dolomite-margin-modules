import {
  DolomiteRegistryImplementation,
  DolomiteRegistryImplementation__factory,
} from '@dolomite-exchange/modules-base/src/types';
import { createContractWithAbi } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import {
  getRealLatestBlockNumber,
  revertToSnapshotAndCapture,
  snapshot,
} from '@dolomite-exchange/modules-base/test/utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol, setupTestMarket } from '@dolomite-exchange/modules-base/test/utils/setup';
import axios from 'axios';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { RS_ETH_CAMELOT_POOL_MAP } from 'packages/base/src/utils/constants';
import { ADDRESS_ZERO, Network, ONE_ETH_BI } from 'packages/base/src/utils/no-deps-constants';
import { TWAPPriceOracle, TWAPPriceOracle__factory } from 'packages/oracles/src/types';
import { IERC20, PendlePtIsolationModeVaultFactory, PendlePtPriceOracle, PendleRegistry } from '../../src/types';
import {
  createPendlePtIsolationModeTokenVaultV1,
  createPendlePtIsolationModeVaultFactory,
  createPendlePtRsEthPriceOracle,
  createPendleRegistry,
} from '../pendle-ecosystem-utils';

describe('PendlePtRsEthApr2024PriceOracle_integration', () => {
  let snapshotId: string;

  let core: CoreProtocolArbitrumOne;
  let ptOracle: PendlePtPriceOracle;
  let pendleRegistry: PendleRegistry;
  let factory: PendlePtIsolationModeVaultFactory;
  let underlyingToken: IERC20;
  let underlyingMarketId: BigNumber;
  let apiAmountOut: BigNumber;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: await getRealLatestBlockNumber(true, Network.ArbitrumOne),
      network: Network.ArbitrumOne,
    });
    const dolomiteRegistryImplementation = await createContractWithAbi<DolomiteRegistryImplementation>(
      DolomiteRegistryImplementation__factory.abi,
      DolomiteRegistryImplementation__factory.bytecode,
      [],
    );
    await core.dolomiteRegistryProxy.connect(core.governance).upgradeTo(dolomiteRegistryImplementation.address);
    await core.dolomiteRegistry.connect(core.governance).ownerSetChainlinkPriceOracle(
      core.chainlinkPriceOracle!.address,
    );

    underlyingToken = core.tokens.rsEth!;
    const twapPriceOracle = await createContractWithAbi<TWAPPriceOracle>(
      TWAPPriceOracle__factory.abi,
      TWAPPriceOracle__factory.bytecode,
      [core.tokens.rsEth.address, [RS_ETH_CAMELOT_POOL_MAP[Network.ArbitrumOne]], core.dolomiteMargin.address],
    );
    underlyingMarketId = await core.dolomiteMargin.getNumMarkets();
    await setupTestMarket(core, core.tokens.rsEth, false, twapPriceOracle);
    await core.dolomiteMargin.connect(core.governance).ownerSetPriceOracle(underlyingMarketId, twapPriceOracle.address);

    pendleRegistry = await createPendleRegistry(
      core,
      core.pendleEcosystem!.rsEthApr2024.ptRsEthMarket,
      core.pendleEcosystem!.rsEthApr2024.ptOracle,
      core.pendleEcosystem!.syRsEthToken,
    );
    const userVaultImplementation = await createPendlePtIsolationModeTokenVaultV1();
    factory = await createPendlePtIsolationModeVaultFactory(
      core,
      pendleRegistry,
      core.pendleEcosystem!.weEthApr2024.ptWeEthToken,
      userVaultImplementation,
    );
    ptOracle = await createPendlePtRsEthPriceOracle(core, factory, pendleRegistry);
    await ptOracle.connect(core.governance).ownerSetDeductionCoefficient(BigNumber.from('3500000000000000'));
    await setupTestMarket(core, factory, true, ptOracle);

    const BASE_URL = 'https://api-v2.pendle.finance/sdk/api/v1';
    const data = await axios.get(`${BASE_URL}/swapExactPtForToken`, {
      params: {
        chainId: Network.ArbitrumOne.toString(),
        receiverAddr: core.hhUser1.address.toLowerCase(),
        marketAddr: core.pendleEcosystem.rsEthApr2024.ptRsEthMarket.address,
        amountPtIn: ONE_ETH_BI.toString(),
        tokenOutAddr: ADDRESS_ZERO,
        syTokenOutAddr: core.tokens.rsEth.address,
        slippage: '0.0001',
      },
    })
      .then(result => result.data)
      .catch(e => {
        console.log(e);
        return Promise.reject(e);
      });
    apiAmountOut = BigNumber.from(data.data.amountTokenOut).mul((await core.dolomiteMargin.getMarketPrice(0)).value);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('constructor', () => {
    it('should work normally', async () => {
      expect(await ptOracle.DPT_TOKEN()).to.eq(factory.address);
      expect(await ptOracle.REGISTRY()).to.eq(pendleRegistry.address);
      expect(await ptOracle.DOLOMITE_MARGIN()).to.eq(core.dolomiteMargin.address);
      expect(await ptOracle.UNDERLYING_TOKEN()).to.eq(underlyingToken.address);
    });
  });

  describe('#getPrice', () => {
    it('returns the correct value under normal conditions for the dptToken', async () => {
      if (process.env.COVERAGE === 'true') {
        return;
      }
      const price = (await ptOracle.getPrice(factory.address)).value;
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.gte(price.mul(995).div(1000));
      expect(apiAmountOut.div(ONE_ETH_BI)).to.be.lte(price.mul(1005).div(1000));
    });
  });
});
