import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import { getChainlinkPriceOracleParams } from '../../../src/utils/constructors/oracles';
import { Network } from '../../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../../deploy-utils';

/**
 * This script encodes the following transactions:
 * - Adds native USDC as a supported network on Arbitrum
 * - Increases the PT-GLP supply cap to 1M units
 */
async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const args = await getChainlinkPriceOracleParams(core);
  const priceOracle = await deployContractAndSave(
    Number(network),
    'ChainlinkPriceOracle',
    args,
  );

  const tokens = args[0];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const marketId = await core.dolomiteMargin.getMarketIdByTokenAddress(token);
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetPriceOracle',
      [marketId, priceOracle],
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
