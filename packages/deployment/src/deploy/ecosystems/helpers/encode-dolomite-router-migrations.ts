import { DeployedVault } from "packages/base/test/utils/ecosystem-utils/deployed-vaults";
import { CoreProtocolType } from "packages/base/test/utils/setup";
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from "packages/deployment/src/utils/deploy-utils";

export async function encodeDolomiteRouterMigrations(
  core: CoreProtocolType<any>,
  routers: string[],
  deployedVaults: DeployedVault[],
  transactions: EncodedTransaction[],
) {
  for (const routerAddress of routers) {
    if (!await core.dolomiteMargin.getIsGlobalOperator(routerAddress)) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          core,
          'dolomiteMargin',
          'ownerSetGlobalOperator',
          [routerAddress, true],
        ),
      );
    }
  }

  for (const deployedVault of deployedVaults) {
    for (const routerAddress of routers) {
      if (!(await deployedVault.factory.isTokenConverterTrusted(routerAddress))) {
        transactions.push(await deployedVault.encodeAddTrustedTokenConverter(core, routerAddress));
      }
    }
  }
}
