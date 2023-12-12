import { BigNumber } from 'ethers/lib/ethers';
import { parseEther } from 'ethers/lib/utils';
import { LinearStepFunctionInterestSetter__factory, TWAPPriceOracle__factory } from '../../../../src/types';
import { getOwnerAddMarketParameters } from '../../../../src/utils/constructors/dolomite';
import { getTWAPPriceOracleConstructorParams } from '../../../../src/utils/constructors/oracles';
import { getAndCheckSpecificNetwork } from '../../../../src/utils/dolomite-utils';
import { ADDRESS_ZERO, Network } from '../../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../../test/utils/setup';
import {
  createFolder,
  deployContractAndSave,
  deployLinearInterestSetterAndSave,
  InterestSetterType,
  prettyPrintEncodedDataWithTypeSafety,
  prettyPrintEncodeInsertChainlinkOracle,
  writeFile,
} from '../../../deploy-utils';

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
  const dpxMarginPremium = BigNumber.from('304347826086956521'); // 150%
  const dpxSpreadPremium = parseEther('1'); // 100% --> 5% + (5% * 1) = 10%
  const dpxMaxWei = parseEther('2000');
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    getOwnerAddMarketParameters(
      core.tokens.dpx!,
      core.chainlinkPriceOracle!,
      altcoinInterestSetter,
      dpxMarginPremium,
      dpxSpreadPremium,
      dpxMaxWei,
      false,
    ),
  );

  const grailMarginPremium = BigNumber.from('304347826086956521'); // 150%
  const grailSpreadPremium = parseEther('1'); // 100% --> 5% + (5% * 1) = 10%
  const grailMaxWei = parseEther('500');
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    getOwnerAddMarketParameters(
      core.tokens.grail!,
      grailTwapPriceOracle,
      altcoinInterestSetter,
      grailMarginPremium,
      grailSpreadPremium,
      grailMaxWei,
      false,
    ),
  );

  await prettyPrintEncodeInsertChainlinkOracle(
    core,
    core.tokens.magic!,
    '0x47e55ccec6582838e173f252d08afd8116c2202d',
    ADDRESS_ZERO,
  );
  const magicMarginPremium = BigNumber.from('304347826086956521'); // 150%
  const magicSpreadPremium = parseEther('1'); // 100% --> 5% + (5% * 1) = 10%
  const magicMaxWei = parseEther('1250000'); // 1.25M
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    getOwnerAddMarketParameters(
      core.tokens.magic!,
      core.chainlinkPriceOracle!,
      altcoinInterestSetter,
      magicMarginPremium,
      magicSpreadPremium,
      magicMaxWei,
      false,
    ),
  );

  await prettyPrintEncodeInsertChainlinkOracle(
    core,
    core.tokens.pendle!,
    '0x66853e19d73c0f9301fe099c324a1e9726953433',
    ADDRESS_ZERO,
  );
  const pendleMarginPremium = BigNumber.from('304347826086956521'); // 150%
  const pendleSpreadPremium = parseEther('1'); // 100% --> 5% + (5% * 1) = 10%
  const pendleMaxWei = parseEther('1250000'); // 1.25M
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerAddMarket',
    getOwnerAddMarketParameters(
      core.tokens.pendle!,
      core.chainlinkPriceOracle!,
      altcoinInterestSetter,
      pendleMarginPremium,
      pendleSpreadPremium,
      pendleMaxWei,
      false,
    ),
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
