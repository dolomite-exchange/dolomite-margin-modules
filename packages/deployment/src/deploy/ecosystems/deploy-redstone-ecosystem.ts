import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { REDSTONE_PRICE_AGGREGATORS_MAP } from 'packages/base/src/utils/constants';
import { CoreProtocolTokensMantle } from 'packages/base/test/utils/core-protocols/core-protocol-mantle';
import { getRedstonePriceOracleV3ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { RedstonePriceOracleV3__factory } from 'packages/oracles/src/types';
import {
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeInsertRedstoneOracleV3,
  TRANSACTION_BUILDER_VERSION,
} from '../../utils/deploy-utils';
import { DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

async function main(): Promise<DryRunOutput<Network.Mantle>> {
  const network = await getAndCheckSpecificNetwork(Network.Mantle);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const redstoneAddress = await deployContractAndSave(
    'RedstonePriceOracleV3',
    getRedstonePriceOracleV3ConstructorParams(core, [], [], []),
  );
  (core as any).redstonePriceOracleV3 = RedstonePriceOracleV3__factory.connect(redstoneAddress, core.hhUser1);

  const tokenMap: Omit<CoreProtocolTokensMantle, 'stablecoins'> = { ...core.tokens };
  const tokens = Object.values(tokenMap);
  const transactions: EncodedTransaction[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (REDSTONE_PRICE_AGGREGATORS_MAP[network][tokens[i].address]) {
      transactions.push(
        ...await prettyPrintEncodeInsertRedstoneOracleV3(core, tokens[i]),
      );
    }
  }

  return {
    core,
    invariants: async () => {
      for (let i = 0; i < tokens.length; i++) {
        if (REDSTONE_PRICE_AGGREGATORS_MAP[network][tokens[i].address]) {
          console.log(
            `\tPrice for ${tokens[i].address}: `,
            (await core.oracleAggregatorV2.getPrice(tokens[i].address)).value.toString(),
          );
        }
      }
    },
    scriptName: getScriptName(__filename),
    upload: {
      transactions,
      chainId: network,
      meta: {
        name: 'Redstone Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
