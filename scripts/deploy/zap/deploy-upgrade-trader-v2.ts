import { ethers } from 'hardhat';
import {
  getMagicGLPUnwrapperTraderV2ConstructorParams,
  getMagicGLPWrapperTraderV2ConstructorParams,
} from '../../../src/utils/constructors/abracadabra';
import {
  getGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getGLPIsolationModeWrapperTraderV2ConstructorParams,
} from '../../../src/utils/constructors/gmx';
import {
  getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams,
  getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams,
} from '../../../src/utils/constructors/plutus';
import { Network } from '../../../packages/base/src/utils/no-deps-constants';
import { setupCoreProtocol } from '../../../packages/base/test/utils/setup';
import { deployContractAndSave, prettyPrintEncodedData } from '../../deploy-utils';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol({ network, blockNumber: 0 });

  await deployContractAndSave(
    Number(network),
    'MagicGLPUnwrapperTraderV2',
    getMagicGLPUnwrapperTraderV2ConstructorParams(core),
  );
  await deployContractAndSave(
    Number(network),
    'MagicGLPWrapperTraderV2',
    getMagicGLPWrapperTraderV2ConstructorParams(core),
  );

  const glpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeTokenVaultV1',
    [],
  );
  const glpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeUnwrapperTraderV2',
    getGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
  );
  const glpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'GLPIsolationModeWrapperTraderV2',
    getGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.gmxEcosystem!.live.dGlp,
      core.gmxEcosystem!.live.gmxRegistry,
    ),
  );

  const plvGlpTokenVaultAddress = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeTokenVaultV1',
    [],
  );
  const plvGlpUnwrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeUnwrapperTraderV2',
    getPlutusVaultGLPIsolationModeUnwrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );
  const plvGlpWrapperV2Address = await deployContractAndSave(
    Number(network),
    'PlutusVaultGLPIsolationModeWrapperTraderV2',
    getPlutusVaultGLPIsolationModeWrapperTraderV2ConstructorParams(
      core,
      core.plutusEcosystem!.live.plutusVaultRegistry,
      core.plutusEcosystem!.live.plvGlpIsolationModeFactory,
    ),
  );

  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      glpUnwrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpUnwrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setIsTokenConverterTrusted(
      glpWrapperV2Address,
      true,
    ),
    'glpIsolationModeFactory.setIsTokenConverterTrusted(glpWrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpUnwrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpUnwrapperV2, true)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetIsTokenConverterTrusted(
      plvGlpWrapperV2Address,
      true,
    ),
    'plvGlpIsolationModeFactory.ownerSetIsTokenConverterTrusted(plvGlpWrapperV2, true)',
  );

  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpUnwrapperTrader(
      plvGlpUnwrapperV2Address,
    ),
    'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForGlpDepositor.populateTransaction.ownerSetPlvGlpWrapperTrader(
      plvGlpWrapperV2Address,
    ),
    'dolomiteWhitelistForGlpDepositor.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpUnwrapperTrader(
      plvGlpUnwrapperV2Address,
    ),
    'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpUnwrapperTrader(plvGlpUnwrapperV2)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.dolomiteWhitelistForPlutusChef.populateTransaction.ownerSetPlvGlpWrapperTrader(
      plvGlpWrapperV2Address,
    ),
    'dolomiteWhitelistForPlutusChef.ownerSetPlvGlpWrapperTrader(plvGlpWrapperV2)',
  );

  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.dGlp.populateTransaction.setUserVaultImplementation(
      glpTokenVaultAddress,
    ),
    'glpIsolationModeFactory.setUserVaultImplementation(glpTokenVault)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plvGlpIsolationModeFactory.populateTransaction.ownerSetUserVaultImplementation(
      plvGlpTokenVaultAddress,
    ),
    'plvGlpIsolationModeFactory.ownerSetUserVaultImplementation(plvGlpTokenVault)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
