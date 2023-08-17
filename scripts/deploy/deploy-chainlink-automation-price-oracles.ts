import { ethers } from 'hardhat';
import { Network } from '../../src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedDataWithTypeSafety } from '../deploy-utils';
import { getPlutusVaultWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/plutus';
import { CHAINLINK_REGISTRY_MAP } from '../../src/utils/constants';
import {
  getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams
} from '../../src/utils/constructors/abracadabra';
import { getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams } from '../../src/utils/constructors/jones';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  const magicGLPWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'MagicGLPWithChainlinkAutomationPriceOracle',
    getMagicGLPWithChainlinkAutomationPriceOracleConstructorParams(core, CHAINLINK_REGISTRY_MAP[network])
  );

  const plvWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'PlutusVaultWithChainlinkAutomationPriceOracle',
    getPlutusVaultWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      CHAINLINK_REGISTRY_MAP[network],
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
      core.plutusEcosystem!.live.plvGlpIsolationModeUnwrapperTraderV1
    )
  );

  const jonesUSDCWithChainlinkAutomationPriceOracle = await deployContractAndSave(
    Number(network),
    'JonesUSDCWithChainlinkAutomationPriceOracle',
    getJonesUSDCWithChainlinkAutomationPriceOracleConstructorParams(
      core,
      CHAINLINK_REGISTRY_MAP[network],
      core.jonesEcosystem!.live.jonesUSDCRegistry,
      core.jonesEcosystem!.live.jUSDCIsolationModeFactory
    )
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.magicGlp!, magicGLPWithChainlinkAutomationPriceOracle]
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.dplvGlp!, plvWithChainlinkAutomationPriceOracle]
  );

  await prettyPrintEncodedDataWithTypeSafety(
    core,
    'dolomiteMargin',
    'ownerSetPriceOracle',
    [core.marketIds.djUSDC!, jonesUSDCWithChainlinkAutomationPriceOracle]
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
