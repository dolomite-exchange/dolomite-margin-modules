import { parseEther } from 'ethers/lib/utils';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../deploy-utils';
import { ST_ETH_CHAINLINK_FEED_MAP, ST_ETH_MAP } from '../../../../src/utils/constants';
import { getPendlePtPriceOracleConstructorParams } from '../../../../src/utils/constructors/pendle';

/**
 * This script encodes the following transactions:
 * - Deploys the new EventEmitterRegistry contract + proxy
 * - Deploys the new DolomiteRegistry implementation contract
 * - Sets the dolomite registry implementation upgrade on the proxy
 * - Sets the event emitter registry on the dolomite registry
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const newDolomiteRegistryImplementationAddress = await deployContractAndSave(
    Number(network),
    'DolomiteRegistryImplementation',
    [],
    'DolomiteRegistryImplementationV5',
  );
  const ptREthJun2025OracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtPriceOracle',
    getPendlePtPriceOracleConstructorParams(
      core,
      core.pendleEcosystem!.rEthJun2025.dPtREthJun2025,
      core.pendleEcosystem!.rEthJun2025.pendleRegistry,
      core.tokens.weth,
    ),
    'PendlePtREthJun2025PriceOracle'
  );
  const ptWstEthJun2024OracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtPriceOracle',
    getPendlePtPriceOracleConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.weth,
    ),
    'PendlePtWstEthJun2024PriceOracle'
  );
  const ptWstEthJun2025OracleAddress = await deployContractAndSave(
    Number(network),
    'PendlePtPriceOracle',
    getPendlePtPriceOracleConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.weth,
    ),
    'PendlePtWstEthJun2025PriceOracle'
  );

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistryProxy',
      'upgradeTo',
      [newDolomiteRegistryImplementationAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteRegistry',
      'ownerSetChainlinkPriceOracle',
      [core.chainlinkPriceOracle!.address],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      { chainlinkPriceOracle: core.chainlinkPriceOracle! },
      'chainlinkPriceOracle',
      'ownerInsertOrUpdateOracleToken',
      [
        ST_ETH_MAP[network]!.address, // stETH,
        18,
        ST_ETH_CHAINLINK_FEED_MAP[network]!,
        ADDRESS_ZERO,
      ],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.dPtREthJun2025!, ptREthJun2025OracleAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.dPtWstEthJun2024!, ptWstEthJun2024OracleAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [core.marketIds.dPtWstEthJun2025!, ptWstEthJun2025OracleAddress],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtREthJun2025!, parseEther('1000')],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtWstEthJun2024!, parseEther('1000')],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetMaxWei',
      [core.marketIds.dPtWstEthJun2025!, parseEther('750')],
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
