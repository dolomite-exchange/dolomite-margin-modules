import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams,
  getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams,
  getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams,
  getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams,
} from '@dolomite-exchange/modules-jones/src/jones-construtors';
import { expect } from 'chai';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
} from '../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../../utils/dry-run-utils';
import getScriptName from '../../../utils/get-script-name';
import Deployments from '../../deployments.json';

/**
 * This script encodes the following transactions:
 * - Deploys new jUSDC V2 Registry, jUSDC V2 Oracle, unwrapper, & wrapper
 * - Disables old unwrapper & wrapper on jUSDC V2
 */
async function main(): Promise<DryRunOutput<Network.ArbitrumOne>> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const jonesUsdcRegistryImplementationAddress = await deployContractAndSave(
    'JonesUSDCRegistry',
    [],
    'JonesUSDCV2RegistryImplementationV3',
  );

  const jonesUsdcOracleAddress = await deployContractAndSave(
    'JonesUSDCWithChainlinkAutomationPriceOracle',
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      core.jonesEcosystem.live.jonesUSDCV2Registry,
      core.jonesEcosystem.live.jUSDCV2IsolationModeFactory,
    ),
    'JonesUSDCV2WithChainlinkAutomationPriceOracleV2',
  );

  const unwrapperForZapAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForZapConstructorParams(
      core,
      core.jonesEcosystem.live.jonesUSDCV2Registry,
      core.jonesEcosystem.live.jUSDCV2IsolationModeFactory,
    ),
    'JonesUSDCV2IsolationModeUnwrapperTraderV3',
  );

  const unwrapperForLiquidationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeUnwrapperTraderV2ForLiquidation',
    getJonesUSDCIsolationModeUnwrapperTraderV2ForLiquidationConstructorParams(
      core,
      core.jonesEcosystem.live.jonesUSDCV2Registry,
      core.jonesEcosystem.live.jUSDCV2IsolationModeFactory,
    ),
    'JonesUSDCV2IsolationModeUnwrapperTraderForLiquidationV3',
  );

  const wrapperAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeWrapperTraderV2',
    getJonesUSDCIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.jonesEcosystem.live.jonesUSDCV2Registry,
      core.jonesEcosystem.live.jUSDCV2IsolationModeFactory,
    ),
    'JonesUSDCV2IsolationModeWrapperTraderV3',
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2RegistryProxy },
      'registry',
      'upgradeTo',
      [jonesUsdcRegistryImplementationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2Registry },
      'registry',
      'ownerSetJUSDC',
      [core.jonesEcosystem.jUSDCV2.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2Registry },
      'registry',
      'ownerSetJUsdcRouter',
      [core.jonesEcosystem.jUSDCRouter.address],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2Registry },
      'registry',
      'ownerSetUnwrapperTraderForZap',
      [unwrapperForZapAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { registry: core.jonesEcosystem.live.jonesUSDCV2Registry },
      'registry',
      'ownerSetUnwrapperTraderForLiquidation',
      [unwrapperForLiquidationAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { dolomite: core.dolomiteMargin },
      'dolomite',
      'ownerSetPriceOracle',
      [core.marketIds.djUsdcV2, jonesUsdcOracleAddress],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCV2IsolationModeUnwrapperTraderV2[network].address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCV2IsolationModeUnwrapperTraderForLiquidationV2[network].address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [Deployments.JonesUSDCV2IsolationModeWrapperTraderV2[network].address, false],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperForZapAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperForLiquidationAddress, true],
    ),
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory: core.jonesEcosystem.live.jUSDCV2IsolationModeFactory },
      'factory',
      'ownerSetIsTokenConverterTrusted',
      [wrapperAddress, true],
    ),
  );

  return {
    core,
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
    },
    invariants: async () => {
      expect(await core.dolomiteMargin.getMarketPriceOracle(core.marketIds.djUsdcV2)).to.eq(jonesUsdcOracleAddress);

      const registry = core.jonesEcosystem.live.jonesUSDCV2Registry;
      expect(await registry.jUSDC()).to.eq(core.jonesEcosystem.jUSDCV2.address);
      expect(await registry.jUSDCRouter()).to.eq(core.jonesEcosystem.jUSDCRouter.address);
      expect(await registry.unwrapperTraderForLiquidation()).to.eq(unwrapperForLiquidationAddress);
      expect(await registry.unwrapperTraderForZap()).to.eq(unwrapperForZapAddress);

      const factory = core.jonesEcosystem.live.jUSDCV2IsolationModeFactory;
      expect(await factory.isTokenConverterTrusted(unwrapperForZapAddress)).to.eq(true);
      expect(await factory.isTokenConverterTrusted(unwrapperForLiquidationAddress)).to.eq(true);
      expect(await factory.isTokenConverterTrusted(wrapperAddress)).to.eq(true);

      expect(
        await factory.isTokenConverterTrusted(Deployments.JonesUSDCV2IsolationModeUnwrapperTraderV2[network].address),
      ).to.eq(false);
      expect(
        await factory.isTokenConverterTrusted(
          Deployments.JonesUSDCV2IsolationModeUnwrapperTraderForLiquidationV2[network].address,
        ),
      ).to.eq(false);
      expect(
        await factory.isTokenConverterTrusted(Deployments.JonesUSDCV2IsolationModeWrapperTraderV2[network].address),
      ).to.eq(false);

      console.log('price', (await core.dolomiteMargin.getMarketPrice(core.marketIds.djUsdcV2)).value.toString());
    },
  };
}

doDryRunAndCheckDeployment(main);
