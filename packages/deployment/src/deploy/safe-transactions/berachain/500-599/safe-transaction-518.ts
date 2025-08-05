import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network, ONE_BI } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumber } from 'ethers';
import { TargetCollateralization, TargetLiquidationPenalty } from 'packages/base/src/utils/constructors/dolomite';
import { getTWAPPriceOracleV2ConstructorParams } from 'packages/oracles/src/oracles-constructors';
import { IAlgebraV3Pool__factory, TWAPPriceOracleV2__factory } from 'packages/oracles/src/types';
import { CHRONICLE_PRICE_SCRIBES_MAP } from '../../../../../../base/src/utils/constants';
import { deployContractAndSave } from '../../../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput, EncodedTransaction } from '../../../../utils/dry-run-utils';
import {
  encodeSetInterestSetter,
  encodeSetIsCollateralOnly,
  encodeSetSingleCollateralWithStrictDebtByMarketId,
  encodeSetSupplyCap,
} from '../../../../utils/encoding/dolomite-margin-core-encoder-utils';
import { encodeInsertChronicleOracleV3, encodeInsertTwapOracle } from '../../../../utils/encoding/oracle-encoder-utils';
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

  const henloTokenPair = IAlgebraV3Pool__factory.connect('0xb8c0ba2d17c4cc1f3d9a25eabd123ad24a009ebe', core.hhUser1);
  const henloOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.henlo, henloTokenPair),
    'HenloTWAPPriceOracleV2',
  );
  const henloOracle = TWAPPriceOracleV2__factory.connect(henloOracleAddress, core.hhUser1);

  const iBeraTokenPair = IAlgebraV3Pool__factory.connect('0xfcb24b3b7e87e3810b150d25d5964c566d9a2b6f', core.hhUser1);
  const iBeraOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracle',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.iBera, iBeraTokenPair),
    'iBeraTWAPPriceOracleV2',
  );
  const iBeraOracle = TWAPPriceOracleV2__factory.connect(iBeraOracleAddress, core.hhUser1);

  const iBgtTokenPair = IAlgebraV3Pool__factory.connect('0x12bf773f18cec56f14e7cb91d82984ef5a3148ee', core.hhUser1);
  const iBgtOracleAddress = await deployContractAndSave(
    'PancakeV3PriceOracleNoTokenCheck',
    getTWAPPriceOracleV2ConstructorParams(core, core.tokens.iBgt, iBgtTokenPair),
    'iBgtTWAPPriceOracleV2',
  );
  const iBgtOracle = TWAPPriceOracleV2__factory.connect(iBgtOracleAddress, core.hhUser1);

  const transactions: EncodedTransaction[] = [
    await encodeSetIsCollateralOnly(core, marketIds.henlo, true),
    await encodeSetSupplyCap(core, marketIds.henlo, ONE_BI),
    ...(await encodeInsertTwapOracle(core, core.tokens.henlo, henloOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.iBera, iBeraOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.iBgt, iBgtOracle, core.tokens.wbera)),

    ...(await encodeInsertTwapOracle(core, core.tokens.diBgt, iBgtOracle, core.tokens.wbera)),
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
      await printPriceForVisualCheck(core, core.tokens.henlo);
      await printPriceForVisualCheck(core, core.tokens.iBera);
      await printPriceForVisualCheck(core, core.tokens.iBgt);
      await printPriceForVisualCheck(core, core.tokens.diBgt);
    },
  };
}

doDryRunAndCheckDeployment(main);
