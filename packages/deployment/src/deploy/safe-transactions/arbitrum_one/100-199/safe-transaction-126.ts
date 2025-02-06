import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { parseEther } from 'ethers/lib/utils';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  deployPendlePtSystem,
  writeFile,
} from '../../../../utils/deploy-utils';
import { DenJsonUpload, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodeAddIsolationModeMarket } from '../../../../utils/encoding/add-market-encoder-utils';

enum PtName {
  REthJun2025 = 'REthJun2025',
  WstEthJun2024 = 'WstEthJun2024',
  WstEthJun2025 = 'WstEthJun2025',
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
    core,
    PtName.REthJun2025,
    core.pendleEcosystem!.rEthJun2025.rEthMarket,
    core.pendleEcosystem!.rEthJun2025.ptOracle,
    core.pendleEcosystem!.rEthJun2025.ptREthToken,
    core.pendleEcosystem!.syREthToken,
    core.tokens.rEth!,
  );
  const wstEthJun2024System = await deployPendlePtSystem(
    core,
    PtName.WstEthJun2024,
    core.pendleEcosystem!.wstEthJun2024.wstEthMarket,
    core.pendleEcosystem!.wstEthJun2024.ptOracle,
    core.pendleEcosystem!.wstEthJun2024.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );
  const wstEthJun2025System = await deployPendlePtSystem(
    core,
    PtName.WstEthJun2025,
    core.pendleEcosystem!.wstEthJun2025.wstEthMarket,
    core.pendleEcosystem!.wstEthJun2025.ptOracle,
    core.pendleEcosystem!.wstEthJun2025.ptWstEthToken,
    core.pendleEcosystem!.syWstEthToken,
    core.tokens.wstEth!,
  );

  let transactions: EncodedTransaction[] = [];
  const rEthMarketId = await core.dolomiteMargin.getNumMarkets();
  const rEthMaxSupplyWei = parseEther('1000');
  transactions = transactions.concat(
    await prettyPrintEncodeAddIsolationModeMarket(
      core,
      rEthSystem.factory,
      rEthSystem.oracle,
      rEthSystem.unwrapper,
      rEthSystem.wrapper,
      rEthMarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
      rEthMaxSupplyWei,
    ),
  );

  const wstEthJun2024MarketId = rEthMarketId.add(1);
  const wstEthJun2024MaxSupplyWei = parseEther('1000');
  transactions = transactions.concat(
    await prettyPrintEncodeAddIsolationModeMarket(
      core,
      wstEthJun2024System.factory,
      wstEthJun2024System.oracle,
      wstEthJun2024System.unwrapper,
      wstEthJun2024System.wrapper,
      wstEthJun2024MarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
      wstEthJun2024MaxSupplyWei,
    ),
  );

  const wstEthJun2025MarketId = wstEthJun2024MarketId.add(1);
  const wstEthJun2025MaxSupplyWei = parseEther('750');
  transactions = transactions.concat(
    await prettyPrintEncodeAddIsolationModeMarket(
      core,
      wstEthJun2025System.factory,
      wstEthJun2025System.oracle,
      wstEthJun2025System.unwrapper,
      wstEthJun2025System.wrapper,
      wstEthJun2025MarketId,
      TargetCollateralization._120,
      TargetLiquidationPenalty._7,
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
