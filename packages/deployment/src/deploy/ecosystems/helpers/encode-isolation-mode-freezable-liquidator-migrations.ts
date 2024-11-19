import { IDolomiteMargin } from 'packages/base/src/types';
import { CoreProtocolType } from 'packages/base/test/utils/setup';
import {
  EncodedTransaction,
  getOldDeploymentVersionNamesByDeploymentKey,
  prettyPrintEncodedDataWithTypeSafety,
  readDeploymentFile,
} from '../../../utils/deploy-utils';

export async function encodeIsolationModeFreezableLiquidatorMigrations(
  core: CoreProtocolType<any>,
  isolationModeFreezableLiquidatorProxyAddress: string,
  transactions: EncodedTransaction[],
) {
  if (!(await core.dolomiteMargin.getIsGlobalOperator(isolationModeFreezableLiquidatorProxyAddress))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomite: core.dolomiteMargin as IDolomiteMargin },
        'dolomite',
        'ownerSetGlobalOperator',
        [isolationModeFreezableLiquidatorProxyAddress, true],
      ),
    );

    const oldFreezableLiquidatorNames = getOldDeploymentVersionNamesByDeploymentKey(
      'IsolationModeFreezableLiquidatorProxy',
      1,
    );
    const oldFreezableLiquidatorAddresses: string[] = [];
    for (let i = 0; i < oldFreezableLiquidatorNames.length; i++) {
      const oldVersion = readDeploymentFile()[oldFreezableLiquidatorNames[i]][core.network]?.address;
      if (oldVersion) {
        oldFreezableLiquidatorAddresses.push(oldVersion);
      }

      if (oldVersion && (await core.dolomiteMargin.getIsGlobalOperator(oldVersion))) {
        transactions.push(
          await prettyPrintEncodedDataWithTypeSafety(
            core,
            { dolomite: core.dolomiteMargin as IDolomiteMargin },
            'dolomite',
            'ownerSetGlobalOperator',
            [oldVersion, false],
          ),
        );
      }
    }

    const numMarkets = await core.dolomiteMargin.getNumMarkets();
    for (let i = 0; i < numMarkets.toNumber(); i++) {
      const liquidators = await core.liquidatorAssetRegistry.getLiquidatorsForAsset(i);
      for (let j = 0; j < oldFreezableLiquidatorAddresses.length; j++) {
        if (liquidators.some((l) => l === oldFreezableLiquidatorAddresses[j])) {
          transactions.push(
            await prettyPrintEncodedDataWithTypeSafety(
              core,
              { registry: core.liquidatorAssetRegistry },
              'registry',
              'ownerRemoveLiquidatorFromAssetWhitelist',
              [i, oldFreezableLiquidatorAddresses[j]],
            ),
            await prettyPrintEncodedDataWithTypeSafety(
              core,
              { registry: core.liquidatorAssetRegistry },
              'registry',
              'ownerAddLiquidatorToAssetWhitelist',
              [i, isolationModeFreezableLiquidatorProxyAddress],
            ),
          );
        }
      }
    }
  }
}
