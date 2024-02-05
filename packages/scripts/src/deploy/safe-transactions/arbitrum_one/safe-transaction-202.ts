import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { CoreProtocolArbitrumOne } from '@dolomite-exchange/modules-base/test/utils/core-protocol';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams,
  getPendlePtIsolationModeWrapperTraderV2ConstructorParams,
} from '@dolomite-exchange/modules-pendle/src/pendle-constructors';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';

const old2024Unwrapper = '0x05C5A361431A5b141d9f09D761EA4323B651dfB8';
const old2024Wrapper = '0x30173DbD3A5af41bE2b8462d1D27E18e536D6705';
const old2025Unwrapper = '0x98F1DA067A80b6CEFE1eeeaFF63972d5140550Df';
const old2025Wrapper = '0xb88653715b5E53874bC0A569f48eF2D0c01e4a0E';

async function deployPtWstEthJun2024Updates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2024.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2024.dPtWstEthJun2024,
    ),
    'PendlePtWstEthJun2024IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [old2024Unwrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [old2024Wrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2024,
      'dPtWstEthJun2024',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

async function deployPtWstEthJun2025Updates(core: CoreProtocolArbitrumOne): Promise<EncodedTransaction[]> {
  const unwrapperV4 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeUnwrapperTraderV2',
    getPendlePtIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeUnwrapperTraderV4',
  );
  const wrapperV4 = await deployContractAndSave(
    core.config.networkNumber,
    'PendlePtIsolationModeWrapperTraderV2',
    getPendlePtIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.pendleEcosystem!.wstEthJun2025.pendleRegistry,
      core.tokens.wstEth!,
      core.pendleEcosystem!.wstEthJun2025.dPtWstEthJun2025,
    ),
    'PendlePtWstEthJun2025IsolationModeWrapperTraderV4',
  );
  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [old2025Unwrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [old2025Wrapper, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [unwrapperV4, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.wstEthJun2025,
      'dPtWstEthJun2025',
      'ownerSetIsTokenConverterTrusted',
      [wrapperV4, true],
    ),
  );
  return transactions;
}

/**
 * This script encodes the following transactions:
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2024)
 * - Deploys new unwrapper / wrapper contracts for PT-wstETH (Jun 2025)
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const transactions: EncodedTransaction[] = [
    ...await deployPtWstEthJun2024Updates(core),
    ...await deployPtWstEthJun2025Updates(core),
  ];

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
