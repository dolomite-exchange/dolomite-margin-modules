import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { deployContractAndSave } from '../../utils/deploy-utils';
import { getChroniclePriceOracleConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { CHRONICLE_PRICE_SCRIBES_MAP } from 'packages/base/src/utils/constants';

async function main() {
  const network = await getAnyNetwork();
  if (network !== Network.Mantle) {
    console.warn(`Invalid network for ODOS, found: ${network}`);
    return;
  }

  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const tokens = [core.tokens.meth.address];
  const scribes = [CHRONICLE_PRICE_SCRIBES_MAP[Network.Mantle][core.tokens.meth.address]];
  const invertPrices = [false];
  await deployContractAndSave(
    'ChroniclePriceOracle',
    getChroniclePriceOracleConstructorParams(tokens, scribes, invertPrices, core),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
