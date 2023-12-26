import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';

const liquidatorProxyV4OldAddress = '0x7997a5E848fD5AA92E47f4D94011c6c9Aa5bcCdC';

/**
 * This script encodes the following transactions:
 * - Changes the ARB collateralization to 115%
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const eventEmitterRegistryImplementationV2Address = await deployContractAndSave(
    Number(network),
    'EventEmitterRegistry',
    [],
    'EventEmitterRegistryImplementationV2',
  );

  const transactions: EncodedTransaction[] = [];
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
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.gmxEcosystem!.live,
      'glpIsolationModeFactory',
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
        await core.dolomiteMargin.getMarketIdByTokenAddress(core.gmxEcosystem!.live.glpIsolationModeFactory.address),
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
        await core.dolomiteMargin.getMarketIdByTokenAddress(core.gmxEcosystem!.live.glpIsolationModeFactory.address),
        liquidatorProxyV4OldAddress,
      ],
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
