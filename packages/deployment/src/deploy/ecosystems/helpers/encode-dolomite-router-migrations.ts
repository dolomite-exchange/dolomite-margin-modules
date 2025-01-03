import { IDolomiteMargin } from "packages/base/src/types";
import { DeployedVault } from "packages/base/test/utils/ecosystem-utils/deployed-vaults";
import { CoreProtocolType } from "packages/base/test/utils/setup";
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from "packages/deployment/src/utils/deploy-utils";

export async function encodeDolomiteRouterMigrations(
  core: CoreProtocolType<any>,
  depositWithdrawalRouterAddress: string,
  borrowPositionRouterAddress: string,
  genericTraderRouterAddress: string,
  deployedVaults: DeployedVault[],
  transactions: EncodedTransaction[],
) {
  if (!await core.dolomiteMargin.getIsGlobalOperator(depositWithdrawalRouterAddress)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin as IDolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [depositWithdrawalRouterAddress, true],
      ),
    );
  }

  if (!await core.dolomiteMargin.getIsGlobalOperator(borrowPositionRouterAddress)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin as IDolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [borrowPositionRouterAddress, true],
      ),
    );
  }

  if (!await core.dolomiteMargin.getIsGlobalOperator(genericTraderRouterAddress)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin as IDolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [genericTraderRouterAddress, true],
      ),
    );
  }

  for (const deployedVault of deployedVaults) {
    if (!(await deployedVault.factory.isTokenConverterTrusted(depositWithdrawalRouterAddress))) {
      transactions.push(await deployedVault.encodeAddTrustedTokenConverter(core, depositWithdrawalRouterAddress));
    }

    if (!(await deployedVault.factory.isTokenConverterTrusted(borrowPositionRouterAddress))) {
      transactions.push(await deployedVault.encodeAddTrustedTokenConverter(core, borrowPositionRouterAddress));
    }

    if (!(await deployedVault.factory.isTokenConverterTrusted(genericTraderRouterAddress))) {
      transactions.push(await deployedVault.encodeAddTrustedTokenConverter(core, genericTraderRouterAddress));
    }

  }

  // @todo Upgrade generic trader proxy and token vaults for each iso mode vault. As well as the async wrapper/unwrappers?
}
