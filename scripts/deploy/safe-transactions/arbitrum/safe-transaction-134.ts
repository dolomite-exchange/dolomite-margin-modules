import { getTWAPPriceOracleConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { parseEther } from 'ethers/lib/utils';
import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '../../../../packages/base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '../../../../packages/base/src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '../../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../packages/base/test/utils/setup';
import { TWAPPriceOracle__factory } from '../../../../src/types';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Deploys the new EventEmitterRegistry contract + proxy
 * - Deploys the new DolomiteRegistry implementation contract
 * - Sets the dolomite registry implementation upgrade on the proxy
 * - Sets the event emitter registry on the dolomite registry
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const jonesTwapAddress = await deployContractAndSave(
    Number(network),
    'TWAPPriceOracle',
    getTWAPPriceOracleConstructorParams(core, core.tokens.jones!, [core.jonesEcosystem!.jonesWethV3Pool]),
    'JonesTWAPPriceOracleV1',
  );
  const jonesTwap = TWAPPriceOracle__factory.connect(jonesTwapAddress, core.governance);

  const premiaTwapAddress = await deployContractAndSave(
    Number(network),
    'TWAPPriceOracle',
    getTWAPPriceOracleConstructorParams(core, core.tokens.premia!, [core.premiaEcosystem!.premiaWethV3Pool]),
    'PremiaTWAPPriceOracleV1',
  );
  const premiaTwap = TWAPPriceOracle__factory.connect(premiaTwapAddress, core.governance);

  const radiantUsdChainlinkAggregator = '0x20d0fcab0ecfd078b036b6caf1fac69a6453b352';

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodeInsertChainlinkOracle(
      core,
      core.tokens.radiant!,
      radiantUsdChainlinkAggregator,
      ADDRESS_ZERO,
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.jones!,
      jonesTwap,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther('100000'), // 100k units
      true,
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.premia!,
      premiaTwap,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther('500000'), // 500k units
      true,
    ),
  );
  transactions.push(
    ...await prettyPrintEncodeAddMarket(
      core,
      core.tokens.radiant!,
      core.chainlinkPriceOracle!,
      core.interestSetters.linearStepFunction14L86UInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther('5000000'), // 5M units
      false,
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
