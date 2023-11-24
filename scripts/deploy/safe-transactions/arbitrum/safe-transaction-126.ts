import { BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import {
  IERC20,
  IPendlePtMarket,
  IPendlePtOracle,
  IPendlePtToken,
  IPendleSyToken,
  PendlePtIsolationModeTokenVaultV1__factory,
  PendlePtIsolationModeUnwrapperTraderV2,
  PendlePtIsolationModeUnwrapperTraderV2__factory,
  PendlePtIsolationModeVaultFactory,
  PendlePtIsolationModeVaultFactory__factory,
  PendlePtIsolationModeWrapperTraderV2,
  PendlePtIsolationModeWrapperTraderV2__factory,
  PendlePtPriceOracle,
  PendlePtPriceOracle__factory,
  PendleRegistry__factory,
} from '../../../../src/types';
import {
  getLiquidationPremiumForTargetCollateralization,
  getMarginPremiumForTargetCollateralization,
  getOwnerAddMarketParametersForIsolationMode,
  TargetCollateralization,
  TargetLiquidationPremium,
} from '../../../../src/utils/constructors/dolomite';
import {
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeVaultFactoryConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
  getPendlePtPriceOracleConstructorParams,
  getPendleRegistryConstructorParams,
} from '../../../../src/utils/constructors/pendle';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { CoreProtocol, setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder, DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';
import deployments from '../../../deployments.json';

enum PtName {
  REthJun2025 = 'REthJun2025',
  WstEthJun2024 = 'WstEthJun2024',
  WstEthJun2025 = 'WstEthJun2025',
}

interface PendlePtSystem {
  factory: PendlePtIsolationModeVaultFactory;
  oracle: PendlePtPriceOracle;
  unwrapper: PendlePtIsolationModeUnwrapperTraderV2;
  wrapper: PendlePtIsolationModeWrapperTraderV2;
}

async function deployPendlePtSystem(
  network: Network,
  core: CoreProtocol,
  ptName: string,
  ptMarket: IPendlePtMarket,
  ptOracle: IPendlePtOracle,
  ptToken: IPendlePtToken,
  syToken: IPendleSyToken,
  underlyingToken: IERC20,
): Promise<PendlePtSystem> {
  const libraryName = 'IsolationModeTokenVaultV1ActionsImpl';
  const userVaultImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeTokenVaultV1',
    [],
    `PendlePt${ptName}IsolationModeTokenVaultV1'`,
    { [libraryName]: deployments[libraryName][network as '42161'].address },
  );
  const userVaultImplementation = PendlePtIsolationModeTokenVaultV1__factory.connect(
    userVaultImplementationAddress,
    core.governance,
  );

  const registryImplementationAddress = await deployContractAndSave(
    Number(network),
    'PendleRegistry',
    [],
    'PendleRegistryImplementationV1',
  );
  const registryImplementation = PendleRegistry__factory.connect(registryImplementationAddress, core.governance);
  const registryAddress = await deployContractAndSave(
    Number(network),
    'RegistryProxy',
    await getPendleRegistryConstructorParams(registryImplementation, core, ptMarket, ptOracle, syToken),
    `Pendle${ptName}RegistryProxy`,
  );
  const registry = PendleRegistry__factory.connect(registryAddress, core.governance);

  const factoryAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeVaultFactory',
    getPendlePtIsolationModeVaultFactoryConstructorParams(core, registry, ptToken, userVaultImplementation),
    `PendlePt${ptName}IsolationModeVaultFactory`,
  );
  const factory = PendlePtIsolationModeVaultFactory__factory.connect(factoryAddress, core.governance);

  const unwrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeUnwrapperTraderV2`,
  );

  const wrapperAddress = await deployContractAndSave(
    Number(network),
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(core, registry, underlyingToken, factory),
    `PendlePt${ptName}IsolationModeWrapperTraderV2`,
  );

  const oracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtPriceOracle',
    getPendlePtPriceOracleConstructorParams(core, factory, registry, underlyingToken),
    `PendlePt${ptName}PriceOracle`,
  );
  const oracle = PendlePtPriceOracle__factory.connect(oracleAddress, core.governance);

  return {
    factory,
    oracle,
    unwrapper: PendlePtIsolationModeUnwrapperTraderV2__factory.connect(unwrapperAddress, core.governance),
    wrapper: PendlePtIsolationModeWrapperTraderV2__factory.connect(wrapperAddress, core.governance),
  };
}

async function encodeTransactions(
  core: CoreProtocol,
  factory: PendlePtIsolationModeVaultFactory,
  oracle: PendlePtPriceOracle,
  unwrapper: PendlePtIsolationModeUnwrapperTraderV2,
  wrapper: PendlePtIsolationModeWrapperTraderV2,
  marketId: BigNumberish,
  maxWei: BigNumberish,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerAddMarket',
      getOwnerAddMarketParametersForIsolationMode(
        factory,
        oracle,
        core.alwaysZeroInterestSetter,
        getMarginPremiumForTargetCollateralization(TargetCollateralization._120),
        getLiquidationPremiumForTargetCollateralization(TargetLiquidationPremium._7),
        maxWei,
      ),
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerInitialize',
      [[unwrapper.address, wrapper.address]],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [factory.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4.address],
    ),
  );
  return transactions;
}

/**
 * This script encodes the following transactions:
 * - Creates the rETH June 2025 PT contracts
 * - Creates the wstETH June 2024 PT contracts
 * - Creates the wstETH June 2025 PT contracts
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const rEthSystem = await deployPendlePtSystem(
    network,
    core,
    PtName.REthJun2025,
    core.pendleEcosystem!.rEthJun2025.ptREthMarket,
    core.pendleEcosystem!.rEthJun2025.ptOracle,
    core.pendleEcosystem!.rEthJun2025.ptREthToken,
    core.pendleEcosystem!.syREthToken,
    core.tokens.rEth!,
  );
  const wstEthJun2024System = await deployPendlePtSystem(
    network,
    core,
    PtName.WstEthJun2024,
    core.pendleEcosystem!.wstEthJun2024.ptWstEthMarket,
    core.pendleEcosystem!.wstEthJun2024.ptOracle,
    core.pendleEcosystem!.wstEthJun2024.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );
  const wstEthJun2025System = await deployPendlePtSystem(
    network,
    core,
    PtName.WstEthJun2025,
    core.pendleEcosystem!.wstEthJun2025.ptWstEthMarket,
    core.pendleEcosystem!.wstEthJun2025.ptOracle,
    core.pendleEcosystem!.wstEthJun2025.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );

  let transactions: EncodedTransaction[] = [];
  const rEthMarketId = await core.dolomiteMargin.getNumMarkets();
  const rEthMaxSupplyWei = parseEther('1000');
  transactions = transactions.concat(
    await encodeTransactions(
      core,
      rEthSystem.factory,
      rEthSystem.oracle,
      rEthSystem.unwrapper,
      rEthSystem.wrapper,
      rEthMarketId,
      rEthMaxSupplyWei,
    ),
  );

  const wstEthJun2024MarketId = rEthMarketId.add(1);
  const wstEthJun2024MaxSupplyWei = parseEther('1000');
  transactions = transactions.concat(
    await encodeTransactions(
      core,
      wstEthJun2024System.factory,
      wstEthJun2024System.oracle,
      wstEthJun2024System.unwrapper,
      wstEthJun2024System.wrapper,
      wstEthJun2024MarketId,
      wstEthJun2024MaxSupplyWei,
    ),
  );

  const wstEthJun2025MarketId = wstEthJun2024MarketId.add(1);
  const wstEthJun2025MaxSupplyWei = parseEther('750');
  transactions = transactions.concat(
    await encodeTransactions(
      core,
      wstEthJun2025System.factory,
      wstEthJun2025System.oracle,
      wstEthJun2025System.unwrapper,
      wstEthJun2025System.wrapper,
      wstEthJun2025MarketId,
      wstEthJun2025MaxSupplyWei,
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
