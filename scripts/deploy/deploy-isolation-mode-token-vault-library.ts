import { getAndCheckSpecificNetwork } from '../../src/utils/dolomite-utils';
import { Network } from '../../src/utils/no-deps-constants';
import { deployContractAndSave } from '../deploy-utils';

async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  await deployContractAndSave(
    Number(network),
    'IsolationModeTokenVaultV1ActionsImpl',
    [],
    'IsolationModeTokenVaultV1ActionsImplV2',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
