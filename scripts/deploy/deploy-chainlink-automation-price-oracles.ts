import { ethers } from 'hardhat';
import {
  getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams,
} from '../../src/utils/constructors/abracadabra';
import { getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/jones';
import { getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/plutus';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const magicGLPWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'MagicGLPWithChainlinkAutomationPriceOracle',
    getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(core),
  );

  const plvGlpWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPWithChainlinkAutomationPriceOracle',
    getPlutusVaultGLPWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      core.plutusEcosystem!.live.plvGlpIsolationModeUnwrapperTraderV1,
    ),
  );

  const jonesUSDCWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'JonesUSDCWithChainlinkAutomationPriceOracle',
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory,
    ),
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.magicGlp!, magicGLPWithChainlinkAutomationPriceOracle],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.dplvGlp!, plvGlpWithChainlinkAutomationPriceOracle],
  );
  await prettyPrintEncodedDataWithTypeSafety(
    core,
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.djUSDC!, jonesUSDCWithChainlinkAutomationPriceOracle],
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
