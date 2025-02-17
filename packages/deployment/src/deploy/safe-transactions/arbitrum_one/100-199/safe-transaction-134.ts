import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { getTWAPPriceOracleV1ConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { TWAPPriceOracleV1__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  deployContractAndSave,
  writeFile,
} from '../../../../utils/deploy-utils';
import { DenJsonUpload, EncodedTransaction } from '../../../../utils/dry-run-utils';
import { encodeAddMarket } from '../../../../utils/encoding/add-market-encoder-utils';
import { encodeInsertChainlinkOracle } from '../../../../utils/encoding/oracle-encoder-utils';

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
    'TWAPPriceOracleV1',
    getTWAPPriceOracleV1ConstructorParams(core, core.tokens.jones!, [core.jonesEcosystem!.jonesWethV3Pool]),
    'JonesTWAPPriceOracleV1',
  );
  const jonesTwap = TWAPPriceOracleV1__factory.connect(jonesTwapAddress, core.governance);

  const premiaTwapAddress = await deployContractAndSave(
    'TWAPPriceOracleV1',
    getTWAPPriceOracleV1ConstructorParams(core, core.tokens.premia!, [core.premiaEcosystem!.premiaWethV3Pool]),
    'PremiaTWAPPriceOracleV1',
  );
  const premiaTwap = TWAPPriceOracleV1__factory.connect(premiaTwapAddress, core.governance);

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await encodeInsertChainlinkOracle(
      core as any,
      core.tokens.radiant!,
      ADDRESS_ZERO,
    ),
  );
  transactions.push(
    ...await encodeAddMarket(
      core,
      core.tokens.jones!,
      jonesTwap,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther('100000'), // 100k units
      ZERO_BI,
      true,
    ),
  );
  transactions.push(
    ...await encodeAddMarket(
      core,
      core.tokens.premia!,
      premiaTwap,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._166,
      TargetLiquidationPenalty._15,
      parseEther('500000'), // 500k units
      ZERO_BI,
      true,
    ),
  );
  transactions.push(
    ...await encodeAddMarket(
      core,
      core.tokens.radiant!,
      core.chainlinkPriceOracleV1!,
      core.interestSetters.linearStepFunction14L86U90OInterestSetter,
      TargetCollateralization._125,
      TargetLiquidationPenalty._7,
      parseEther('5000000'), // 5M units
      ZERO_BI,
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
