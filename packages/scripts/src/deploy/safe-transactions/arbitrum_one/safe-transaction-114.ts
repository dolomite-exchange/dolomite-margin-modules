import {
  TargetCollateralization,
  TargetLiquidationPenalty,
} from '@dolomite-exchange/modules-base/src/utils/constructors/dolomite';
import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { LinearStepFunctionInterestSetter__factory } from '@dolomite-exchange/modules-interest-setters/src/types';
import { getTWAPPriceOracleConstructorParams } from '@dolomite-exchange/modules-oracles/src/oracles-constructors';
import { TWAPPriceOracle__factory } from '@dolomite-exchange/modules-oracles/src/types';
import { parseEther } from 'ethers/lib/utils';
import { ADDRESS_ZERO, Network, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  deployContractAndSave,
  deployLinearInterestSetterAndSave,
  InterestSetterType,
  prettyPrintEncodeAddMarket,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Creates the GrailTWAPPriceOracleV1 contract
 */
async function main() {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const grailTwapPriceOracleAddress = await deployContractAndSave(
    Number(network),
    'TWAPPriceOracle',
    getTWAPPriceOracleConstructorParams(
      core,
      core.tokens.grail!,
      [core.camelotEcosystem!.grailUsdcV3Pool],
    ),
    'GrailTWAPPriceOracleV1',
  );
  const grailTwapPriceOracle = TWAPPriceOracle__factory.connect(grailTwapPriceOracleAddress, core.hhUser1);

  const altcoinInterestSetterAddress = await deployLinearInterestSetterAndSave(
    Number(network),
    InterestSetterType.Altcoin,
    parseEther('0.14'),
    parseEther('0.86'),
  );
  const altcoinInterestSetter = LinearStepFunctionInterestSetter__factory.connect(
    altcoinInterestSetterAddress,
    core.hhUser1,
  );

  await prettyPrintEncodeInsertChainlinkOracle(
    core,
    core.tokens.dpx!,
    '0xc373b9db0707fd451bc56ba5e9b029ba26629df0',
    ADDRESS_ZERO,
  );
  const dpxMaxWei = parseEther('2000');
  await prettyPrintEncodeAddMarket(
    core,
    core.tokens.dpx!,
    core.chainlinkPriceOracle!,
    altcoinInterestSetter,
    TargetCollateralization._150,
    TargetLiquidationPenalty._10,
    dpxMaxWei,
    ZERO_BI,
    false,
  );

  const grailMaxWei = parseEther('500');
  await prettyPrintEncodeAddMarket(
    core,
    core.tokens.grail!,
    grailTwapPriceOracle,
    altcoinInterestSetter,
    TargetCollateralization._150,
    TargetLiquidationPenalty._10,
    grailMaxWei,
    ZERO_BI,
    false,
  );

  await prettyPrintEncodeInsertChainlinkOracle(
    core,
    core.tokens.magic!,
    '0x47e55ccec6582838e173f252d08afd8116c2202d',
    ADDRESS_ZERO,
  );
  const magicMaxWei = parseEther('1250000'); // 1.25M
  await prettyPrintEncodeAddMarket(
    core,
    core.tokens.magic!,
    core.chainlinkPriceOracle!,
    altcoinInterestSetter,
    TargetCollateralization._150,
    TargetLiquidationPenalty._10,
    magicMaxWei,
    ZERO_BI,
    false,
  );

  await prettyPrintEncodeInsertChainlinkOracle(
    core,
    core.tokens.pendle!,
    '0x66853e19d73c0f9301fe099c324a1e9726953433',
    ADDRESS_ZERO,
  );
  const pendleMaxWei = parseEther('1250000'); // 1.25M
  await prettyPrintEncodeAddMarket(
    core,
    core.tokens.pendle!,
    core.chainlinkPriceOracle!,
    altcoinInterestSetter,
    TargetCollateralization._150,
    TargetLiquidationPenalty._10,
    pendleMaxWei,
    ZERO_BI,
    false,
  );
}

main()
  .then(jsonUpload => {
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
