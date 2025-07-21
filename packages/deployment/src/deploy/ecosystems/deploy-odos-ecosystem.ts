import {
  getOdosAggregatorTraderConstructorParams,
} from '@dolomite-exchange/modules-base/src/utils/constructors/traders';
import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave, getMaxDeploymentVersionNameByDeploymentKey } from '../../utils/deploy-utils';

async function main() {
  const network = await getAnyNetwork();
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });
  if (!('odosEcosystem' in core)) {
    return Promise.reject(new Error(`Invalid network, found ${network}`));
  }

  await deployContractAndSave(
    'OdosAggregatorTrader',
    getOdosAggregatorTraderConstructorParams(core),
    getMaxDeploymentVersionNameByDeploymentKey('OdosAggregatorTrader', 2),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
