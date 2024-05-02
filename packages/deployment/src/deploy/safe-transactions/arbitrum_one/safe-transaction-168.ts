import { IIsolationModeVaultFactory__factory } from '@dolomite-exchange/modules-base/src/types';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish } from 'ethers';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  getTokenVaultLibrary,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';

const genericTraderProxyV1OldAddress = '0x3E647e1242A8CE0cE013cb967fBfF742d7846242';
const liquidatorProxyV4OldAddress = '0x7997a5E848fD5AA92E47f4D94011c6c9Aa5bcCdC';

async function getGlpVaultTransactions(
  core: CoreProtocolArbitrumOne,
  newGlpUserVaultImplementationAddress: string,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'dGlp',
      'setUserVaultImplementation',
      [newGlpUserVaultImplementationAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [
        await core.dolomiteMargin.getMarketIdByTokenAddress(core.gmxEcosystem!.live.dGlp.address),
        core.liquidatorProxyV4!.address,
      ],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerRemoveLiquidatorFromAssetWhitelist',
      [
        await core.dolomiteMargin.getMarketIdByTokenAddress(core.gmxEcosystem!.live.dGlp.address),
        liquidatorProxyV4OldAddress,
      ],
    ),
  );
  return transactions;
}

async function getIsolationModeTokenVaultTransactions(
  core: CoreProtocolArbitrumOne,
  marketId: BigNumberish,
  userVaultImplementationAddress: string,
): Promise<EncodedTransaction[]> {
  const transactions: EncodedTransaction[] = [];
  const factory = IIsolationModeVaultFactory__factory.connect(
    await core.dolomiteMargin.getMarketTokenAddress(marketId),
    core.hhUser1,
  );

  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { factory },
      'factory',
      'ownerSetUserVaultImplementation',
      [userVaultImplementationAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerAddLiquidatorToAssetWhitelist',
      [marketId, core.liquidatorProxyV4!.address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'liquidatorAssetRegistry',
      'ownerRemoveLiquidatorFromAssetWhitelist',
      [marketId, liquidatorProxyV4OldAddress],
    ),
  );
  return transactions;
}

/**
 * This script encodes the following transactions:
 * - Upgrades the Event Emitter Proxy to V2
 * - Sets the Generic Trader Proxy as a global operator of Dolomite Margin
 * - Sets the Liquidator Proxy V4 as a global operator of Dolomite Margin
 * - Sets the Generic Trader Proxy on the Dolomite Registry
 * - Upgrades each Isolation Mode vault to use the new ActionsLib
 * - For each isolation mode asset, resets the Liquidator Asset Registry to use the new Liquidator Proxy V4
 * - Enables auto staking for plvGLP and GMX
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const dolomiteRegistryImplementationAddressV6 = await deployContractAndSave(
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV6',
  );
  const eventEmitterRegistryImplementationV2Address = await deployContractAndSave(
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV2',
  );
  const libraries = getTokenVaultLibrary(core);
  const newGlpUserVaultImplementationAddress = await deployContractAndSave(
    'GLPIsolationModeTokenVaultV2',
    [],
    'GLPIsolationModeTokenVaultV3',
    libraries,
  );
  const plvGlpUserVaultImplementationAddress = await deployContractAndSave(
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
    'PlutusVaultGLPIsolationModeTokenVaultV2',
    libraries,
  );
  const jonesUsdcUserVaultImplementationAddress = await deployContractAndSave(
    'JonesUSDCIsolationModeTokenVaultV1',
    [],
    'JonesUSDCIsolationModeTokenVaultV3',
    libraries,
  );
  const ptGlpUserVaultImplementationAddress = await deployContractAndSave(
    'PendlePtGLPMar2024IsolationModeTokenVaultV1',
    [],
    'PendlePtGLPMar2024IsolationModeTokenVaultV2',
    libraries,
  );
  const ytGlpUserVaultImplementationAddress = await deployContractAndSave(
    'PendleYtGLP2024IsolationModeTokenVaultV1',
    [],
    'PendleYtGLP2024IsolationModeTokenVaultV2',
    libraries,
  );
  const ptREthUserVaultImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtREthJun2025IsolationModeTokenVaultV2',
    libraries,
  );
  const ptWstEthJun2024UserVaultImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWstEthJun2024IsolationModeTokenVaultV2',
    libraries,
  );
  const ptWstEthJun2025UserVaultImplementationAddress = await deployContractAndSave(
    'PendlePtIsolationModeTokenVaultV1',
    [],
    'PendlePtWstEthJun2025IsolationModeTokenVaultV2',
    libraries,
  );
  const vArbUserVaultImplementationAddress = await deployContractAndSave(
    'ARBIsolationModeTokenVaultV1',
    [],
    'ARBIsolationModeTokenVaultV4',
    libraries,
  );
  const gmxUserVaultImplementationAddress = await deployContractAndSave(
    'GMXIsolationModeTokenVaultV1',
    [],
    'GMXIsolationModeTokenVaultV2',
    libraries,
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [dolomiteRegistryImplementationAddressV6],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { eventEmitterRegistryProxy: core.eventEmitterRegistryProxy! },
      'eventEmitterRegistryProxy',
      'upgradeTo',
      [eventEmitterRegistryImplementationV2Address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [genericTraderProxyV1OldAddress, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [liquidatorProxyV4OldAddress, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.genericTraderProxy!.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [core.liquidatorProxyV4!.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetGenericTraderProxy',
      [core.genericTraderProxy!.address],
    ),
  );

  transactions.push(
    ...await getGlpVaultTransactions(core, newGlpUserVaultImplementationAddress),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dplvGlp!,
      plvGlpUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.djUsdcV1!,
      jonesUsdcUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dPtGlpMar2024!,
      ptGlpUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dYtGlp!,
      ytGlpUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dPtREthJun2025!,
      ptREthUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dPtWstEthJun2024!,
      ptWstEthJun2024UserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dPtWstEthJun2025!,
      ptWstEthJun2025UserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dArb!,
      vArbUserVaultImplementationAddress,
    ),
  );
  transactions.push(
    ...await getIsolationModeTokenVaultTransactions(
      core,
      core.marketIds.dGmx!,
      gmxUserVaultImplementationAddress,
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
