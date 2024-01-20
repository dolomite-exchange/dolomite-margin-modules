import { parseEther } from 'ethers/lib/utils';
import {
  ARBIsolationModeTokenVaultV1__factory,
  ARBIsolationModeVaultFactory__factory,
  ARBRegistry__factory,
  GMXIsolationModeTokenVaultV1__factory,
  GMXIsolationModeVaultFactory__factory,
  SimpleIsolationModeUnwrapperTraderV2__factory,
  SimpleIsolationModeWrapperTraderV2__factory,
} from '../../../../src/types';
import {
  getARBIsolationModeVaultFactoryConstructorParams,
  getARBRegistryConstructorParams,
  getARBUnwrapperTraderV2ConstructorParams,
  getARBWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-arb/src/arb';
import { TargetCollateralization, TargetLiquidationPenalty } from '../../../../packages/base/src/utils/constructors/dolomite';
import {
  getGMXIsolationModeVaultFactoryConstructorParams,
  getGMXUnwrapperTraderV2ConstructorParams,
  getGMXWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-gmx-v2/src/utils/constructors/gmx';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  getTokenVaultLibrary,
  prettyPrintEncodeAddIsolationModeMarket,
  prettyPrintEncodeAddMarket, prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys 3 new Wrapper contracts for PT-wstETH (2024 + 2025) and PT-rETH (2025)
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const arbRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'ARBRegistry',
    [],
    'ARBRegistryImplementationV1',
  );
  const arbRegistryImplementation = ARBRegistry__factory.connect(arbRegistryImplementationAddress, core.hhUser1);
  const arbRegistryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getARBRegistryConstructorParams(arbRegistryImplementation, core),
    'ARBRegistryProxy',
  );
  const arbRegistry = ARBRegistry__factory.connect(arbRegistryAddress, core.hhUser1);

  const arbVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'ARBIsolationModeTokenVaultV1',
    [],
    'ARBIsolationModeTokenVaultV3',
    getTokenVaultLibrary(core),
  );
  const arbVaultImplementation = ARBIsolationModeTokenVaultV1__factory.connect(
    arbVaultImplementationAddress,
    core.hhUser1,
  );
  const arbFactoryAddress = await deployContractAndSave(
    Number(network),
    'ARBIsolationModeVaultFactory',
    getARBIsolationModeVaultFactoryConstructorParams(arbRegistry, arbVaultImplementation, core),
  );
  const arbFactory = ARBIsolationModeVaultFactory__factory.connect(arbFactoryAddress, core.hhUser1);

  const arbUnwrapperAddress = await deployContractAndSave(
    Number(network),
    'SimpleIsolationModeUnwrapperTraderV2',
    getARBUnwrapperTraderV2ConstructorParams(arbFactory, core),
    'ARBIsolationModeUnwrapperTraderV2',
  );
  const arbUnwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(arbUnwrapperAddress, core.hhUser1);

  const arbWrapperAddress = await deployContractAndSave(
    Number(network),
    'SimpleIsolationModeWrapperTraderV2',
    getARBWrapperTraderV2ConstructorParams(arbFactory, core),
    'ARBIsolationModeWrapperTraderV2',
  );
  const arbWrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(arbWrapperAddress, core.hhUser1);

  const gmxRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'GmxRegistryV1',
    [],
  );
  const gmxRegistry = core.gmxEcosystem!.live.gmxRegistry;

  const gmxVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'GMXIsolationModeTokenVaultV1',
    [],
    undefined,
    getTokenVaultLibrary(core),
  );
  const gmxVaultImplementation = GMXIsolationModeTokenVaultV1__factory.connect(
    gmxVaultImplementationAddress,
    core.hhUser1,
  );
  const gmxFactoryAddress = await deployContractAndSave(
    Number(network),
    'GMXIsolationModeVaultFactory',
    getGMXIsolationModeVaultFactoryConstructorParams(gmxRegistry, gmxVaultImplementation, core),
  );
  const gmxFactory = GMXIsolationModeVaultFactory__factory.connect(gmxFactoryAddress, core.hhUser1);

  const gmxUnwrapperAddress = await deployContractAndSave(
    Number(network),
    'SimpleIsolationModeUnwrapperTraderV2',
    getGMXUnwrapperTraderV2ConstructorParams(gmxFactory, core),
    'GMXIsolationModeUnwrapperTraderV2',
  );
  const gmxUnwrapper = SimpleIsolationModeUnwrapperTraderV2__factory.connect(gmxUnwrapperAddress, core.hhUser1);

  const gmxWrapperAddress = await deployContractAndSave(
    Number(network),
    'SimpleIsolationModeWrapperTraderV2',
    getGMXWrapperTraderV2ConstructorParams(gmxFactory, core),
    'GMXIsolationModeWrapperTraderV2',
  );
  const gmxWrapper = SimpleIsolationModeWrapperTraderV2__factory.connect(gmxWrapperAddress, core.hhUser1);

  const dArbMarketId = await core.dolomiteMargin.getNumMarkets();
  const gmxMarketId = dArbMarketId.add(1);
  const dGmxMarketId = gmxMarketId.add(1);
  const gmxUsdPriceAggregator = '0xdb98056fecfff59d032ab628337a4887110df3db';
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistryProxy',
      'upgradeTo',
      [gmxRegistryImplementationAddress],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistry',
      'ownerSetBnGmx',
      [core.gmxEcosystem!.bnGmx.address],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistry',
      'ownerSetGlpVaultFactory',
      [core.gmxEcosystem!.live.dGlp.address],
    )
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'gmxRegistry',
      'ownerSetGmxVaultFactory',
      [gmxFactory.address],
    )
  );
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      arbFactory,
      await core.chainlinkPriceOracle!.getAggregatorByToken(core.tokens.arb!.address),
      ADDRESS_ZERO,
    ),
  );
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.gmx!,
      gmxUsdPriceAggregator,
      ADDRESS_ZERO,
    ),
  );
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      gmxFactory,
      gmxUsdPriceAggregator,
      ADDRESS_ZERO,
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      arbFactory,
      core.chainlinkPriceOracle!,
      arbUnwrapper,
      arbWrapper,
      dArbMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
      parseEther('10000000'), // 10M units of collateral
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.gmx!,
      core.chainlinkPriceOracle!,
      core.interestSetters.linearStepFunction8L92UInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8,
      ONE_BI, // ONE unit of collateral
      true,
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddIsolationModeMarket(
      core,
      gmxFactory,
      core.chainlinkPriceOracle!,
      gmxUnwrapper,
      gmxWrapper,
      dGmxMarketId,
      TargetCollateralization._125,
      TargetLiquidationPenalty._8,
      parseEther('100000'), // 100k units of collateral
    ),
  );

  return {
    transactions,
    chainId: network,
  };
}

main()
  .then(jsonUpload => {
    if (typeof jsonUpload === 'undefined') {
      return;
    }

    const path = require('path');
    const scriptName = path.basename(__filename).slice(0, -3);
    const dir = `${__dirname}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(jsonUpload, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
