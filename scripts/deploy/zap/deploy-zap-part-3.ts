import { ethers } from 'hardhat';
import { Network } from '../../../src/utils/no-deps-constants';
import { getDefaultCoreProtocolConfig, setupCoreProtocol } from '../../../test/utils/setup';
import { prettyPrintEncodedData } from '../../deploy-utils';

const oldLiquidatorAddress = '0xac66E962A1C52B8a3B32AF432a60fFDBc99ebD0b';

async function main() {
  const network = (await ethers.provider.getNetwork()).chainId.toString() as Network;
  const core = await setupCoreProtocol(getDefaultCoreProtocolConfig(network));

  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerRemoveLiquidatorFromAssetWhitelist(
      core.marketIds.dPtGlp!,
      oldLiquidatorAddress,
    ),
    'liquidatorAssetRegistry.ownerRemoveLiquidatorFromAssetWhitelist(dPtGlp, oldLiquidator)',
  );
  await prettyPrintEncodedData(
    core.liquidatorAssetRegistry.populateTransaction.ownerAddLiquidatorToAssetWhitelist(
      core.marketIds.dPtGlp!,
      core.liquidatorProxyV4.address,
    ),
    'liquidatorAssetRegistry.ownerAddLiquidatorToAssetWhitelist(dPtGlp, newLiquidator)',
  );

  await prettyPrintEncodedData(
    core.gmxEcosystem!.live.gmxRegistry.populateTransaction.ownerSetDolomiteRegistry(
      core.dolomiteRegistry.address,
    ),
    'gmxRegistry.ownerSetDolomiteRegistry(dolomiteRegistryProxy)',
  );
  await prettyPrintEncodedData(
    core.jonesEcosystem!.live.jonesUSDCRegistry.populateTransaction.ownerSetDolomiteRegistry(
      core.dolomiteRegistry.address,
    ),
    'jonesUSDCRegistry.ownerSetDolomiteRegistry(dolomiteRegistryProxy)',
  );
  await prettyPrintEncodedData(
    core.pendleEcosystem!.live.pendleGLP2024Registry.populateTransaction.ownerSetDolomiteRegistry(
      core.dolomiteRegistry.address,
    ),
    'pendlePtGLP2024Registry.ownerSetDolomiteRegistry(dolomiteRegistryProxy)',
  );
  await prettyPrintEncodedData(
    core.plutusEcosystem!.live.plutusVaultRegistry.populateTransaction.ownerSetDolomiteRegistry(
      core.dolomiteRegistry.address,
    ),
    'plutusVaultRegistry.ownerSetDolomiteRegistry(dolomiteRegistryProxy)',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
