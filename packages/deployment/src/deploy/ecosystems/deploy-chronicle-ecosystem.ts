import { getAnyNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network, DolomiteNetwork } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { CHRONICLE_PRICE_SCRIBES_MAP } from 'packages/base/src/utils/constants';
import { getChroniclePriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { ChroniclePriceOracleV3__factory, IERC20__factory } from 'packages/oracles/src/types';
import {
  deployContractAndSave,
  TRANSACTION_BUILDER_VERSION,
} from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../utils/dry-run-utils';
import { encodeInsertChronicleOracleV3 } from '../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../utils/get-script-name';

async function main<T extends DolomiteNetwork>(): Promise<DryRunOutput<T>> {
  const rawNetwork = (await getAnyNetwork()) as T;
  if (rawNetwork !== Network.ArbitrumOne && rawNetwork !== Network.Berachain && rawNetwork !== Network.Mantle) {
    return Promise.reject(new Error(`Invalid network: ${rawNetwork}`));
  }
  const network = rawNetwork as Network.ArbitrumOne | Network.Berachain | Network.Mantle;
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const chronicleAddress = await deployContractAndSave(
    'ChroniclePriceOracleV3',
    getChroniclePriceOracleV3ConstructorParams(core, [], [], []),
    'ChroniclePriceOracleV3',
  );
  (core as any).chroniclePriceOracleV3 = ChroniclePriceOracleV3__factory.connect(chronicleAddress, core.hhUser1);

  const tokens = Object.keys(CHRONICLE_PRICE_SCRIBES_MAP[network]).map((t) => IERC20__factory.connect(t, core.hhUser1));
  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (CHRONICLE_PRICE_SCRIBES_MAP[network][tokens[i].address]) {
      transactions.push(...(await encodeInsertChronicleOracleV3(core, tokens[i])));
    }
  }

  return {
    core: core as any,
    invariants: async () => {
      for (let i = 0; i < tokens.length; i++) {
        console.log(
          `\tPrice for ${tokens[i].address}: `,
          (await core.oracleAggregatorV2.getPrice(tokens[i].address)).value.toString(),
        );
      }
    },
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      meta: {
        name: 'Chronicle Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

doDryRunAndCheckDeployment(main);
