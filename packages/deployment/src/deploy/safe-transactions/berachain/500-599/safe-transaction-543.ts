import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, PancakeV3PriceOracleWithModifiers__factory } from 'packages/oracles/src/types';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../../utils/encoding/base-encoder-utils';
import { encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
import getScriptName from '../../../../utils/get-script-name';
import { printPriceForVisualCheck } from '../../../../utils/invariant-utils';

/**
 * This script encodes the following transactions:
 * - Changes oracle providers for HENLO, iBERA, and iBGT
 */
async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({
    network,
    blockNumber: await getRealLatestBlockNumber(true, network),
  });

  const marketIds = core.marketIds;

  const iBeraTokenPair = IAlgebraV3Pool__factory.connect('0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f', core.hhUser1);
  const iBeraOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.iBera, iBeraTokenPair),
    'iBeraTWAPPriceOracleV3',
  );
  const iBeraOracle = PancakeV3PriceOracleWithModifiers__factory.connect(iBeraOracleAddress, core.hhUser1);

  const iBgtTokenPair = IAlgebraV3Pool__factory.connect('0x12bf773f18cec56f14e7cb91d82984ef5a3148ee', core.hhUser1);
  const iBgtOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleWithModifiers',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.iBgt, iBgtTokenPair),
    'iBgtTWAPPriceOracleV3',
  );
  const iBgtOracle = PancakeV3PriceOracleWithModifiers__factory.connect(iBgtOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    ...(await encodeInsertTwapOracle(core, core.tokens.iBera, iBeraOracle, core.tokens.wbera)),
    ...(await encodeInsertTwapOracle(core, core.tokens.iBgt, iBgtOracle, core.tokens.wbera)),
    ...(await encodeInsertTwapOracle(core, core.tokens.diBgt, iBgtOracle, core.tokens.wbera)),

    await prettyPrintEncodedDataWithTypeSafety(core, { iBeraOracle }, 'iBeraOracle', 'ownerSetFloorPrice', [
      parseEther(`${0.95}`),
    ]),

    await prettyPrintEncodedDataWithTypeSafety(core, { iBgtOracle }, 'iBgtOracle', 'ownerSetFloorPrice', [
      parseEther(`${0.94}`),
    ]),
  ];

  return {
    core,
    upload: {
      transactions,
      addExecuteImmediatelyTransactions: true,
      chainId: core.network,
      version: '1.0',
      meta: {
        txBuilderVersion: '1.16.5',
        name: __filename,
      },
    },
    scriptName: getScriptName(__filename),
    invariants: async () => {
      expect(await iBeraOracle.floorPrice()).to.eq(parseEther(`${0.95}`));
      expect(await iBgtOracle.floorPrice()).to.eq(parseEther(`${0.94}`));

      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, core.tokens.diBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);
