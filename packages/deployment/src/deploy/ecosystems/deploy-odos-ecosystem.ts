import {
  getOdosAggregatorTraderConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/traders';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  if (network !== Network.ArbitrumOne && network !== Network.Base && network !== Network.Mantle) {
    console.warn(`Invalid network for ODOS, found: ${network}`);
    return;
  }

  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  await deployContractAndSave(
    'OdosAggregatorTrader',
    getOdosAggregatorTraderConstructorParams(core),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
