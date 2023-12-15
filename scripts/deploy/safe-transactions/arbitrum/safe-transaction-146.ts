import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  DenJsonUpload, deployPendlePtSystem,
  prettyPrintEncodedData, prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';
import { STETH_ETH_CHAINLINK_FEED_MAP, WSTETH_STETH_CHAINLINK_FEED_MAP } from '../../../../src/utils/constants';

/**
 * This script encodes the following transactions:
 * - Deploys 3 new Wrapper contracts for PT-wstETH (2024 + 2025) and PT-rETH (2025)
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const rEthSystem = await deployPendlePtSystem(
    network,
    core,
    'REthJun2025',
    core.pendleEcosystem!.rEthJun2025.ptREthMarket,
    core.pendleEcosystem!.rEthJun2025.ptOracle,
    core.pendleEcosystem!.rEthJun2025.ptREthToken,
    core.pendleEcosystem!.syREthToken,
    core.tokens.rEth!,
  );
  const wstEthJun2024System = await deployPendlePtSystem(
    network,
    core,
    'WstEthJun2024',
    core.pendleEcosystem!.wstEthJun2024.ptWstEthMarket,
    core.pendleEcosystem!.wstEthJun2024.ptOracle,
    core.pendleEcosystem!.wstEthJun2024.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );
  const wstEthJun2025System = await deployPendlePtSystem(
    network,
    core,
    'WstEthJun2025',
    core.pendleEcosystem!.wstEthJun2025.ptWstEthMarket,
    core.pendleEcosystem!.wstEthJun2025.ptOracle,
    core.pendleEcosystem!.wstEthJun2025.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );

  const rEthJun2025IsolationModeWrapperTraderV2Address = '0x071A115Fbb40C36032E9694daE926FfB0ec00C29';
  const wstEthJun2024IsolationModeWrapperTraderV2Address = '0xCa55f7C7929E912e39942D8530f6098EF0f45e59';
  const wstEthJun2025IsolationModeWrapperTraderV2Address = '0x4DE8c302f7e5fFBa18039DC2092108FfaA7883F3';

  const transactions = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptREthJun2025IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [rEthJun2025IsolationModeWrapperTraderV2Address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptWstEthJun2024IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wstEthJun2024IsolationModeWrapperTraderV2Address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptWstEthJun2025IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wstEthJun2025IsolationModeWrapperTraderV2Address, false],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptREthJun2025IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [rEthSystem.wrapper.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptWstEthJun2024IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wstEthJun2024System.wrapper.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core.pendleEcosystem!.live,
      'ptWstEthJun2025IsolationModeFactory',
      'ownerSetIsTokenConverterTrusted',
      [wstEthJun2025System.wrapper.address, true],
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
