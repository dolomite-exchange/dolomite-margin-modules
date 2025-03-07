import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import CoreDeployments from '@dolomite-margin/dist/migrations/deployed.json';
import {
  GenericTraderProxyV2,
  IDolomiteRegistry,
  IIsolationModeTokenVaultV1__factory,
  RegistryProxy,
} from 'packages/base/src/types';
import { isArraysEqual } from 'packages/base/src/utils';
import { NetworkType } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../../base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeDolomiteRegistryMigrations<T extends NetworkType>(
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteRegistryProxy: RegistryProxy,
  borrowPositionProxyAddress: string,
  dolomiteAccountRegistryProxy: RegistryProxy,
  dolomiteMigratorAddress: string,
  genericTraderProxyV2: GenericTraderProxyV2,
  oracleAggregatorAddress: string,
  registryImplementationAddress: string,
  transactions: EncodedTransaction[],
  core: CoreProtocolType<T>,
) {
  if ((await dolomiteRegistryProxy.implementation()) !== registryImplementationAddress) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistryProxy },
        'dolomiteRegistryProxy',
        'upgradeTo',
        [registryImplementationAddress],
      ),
    );
  }

  let needsRegistryDolomiteAccountRegistryEncoding = true;
  try {
    const foundDolomiteAccountRegistryAddress = await dolomiteRegistry.dolomiteAccountRegistry();
    needsRegistryDolomiteAccountRegistryEncoding =
      foundDolomiteAccountRegistryAddress !== dolomiteAccountRegistryProxy.address;
  } catch (e) {}
  if (needsRegistryDolomiteAccountRegistryEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDolomiteAccountRegistry',
        [dolomiteAccountRegistryProxy.address],
      ),
    );
  }

  let needsRegistryBorrowPositionProxyEncoding = true;
  try {
    const foundBorrowPositionProxyAddress = await dolomiteRegistry.borrowPositionProxy();
    needsRegistryBorrowPositionProxyEncoding = foundBorrowPositionProxyAddress !== borrowPositionProxyAddress;
  } catch (e) {}
  if (needsRegistryBorrowPositionProxyEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetBorrowPositionProxy',
        [borrowPositionProxyAddress],
      ),
    );
  }

  let needsRegistryGenericTraderProxyV2Encoding = true;
  try {
    const foundGenericTraderProxyV2Address = await dolomiteRegistry.genericTraderProxy();
    needsRegistryGenericTraderProxyV2Encoding = foundGenericTraderProxyV2Address !== genericTraderProxyV2.address;
  } catch (e) {}
  if (needsRegistryGenericTraderProxyV2Encoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetGenericTraderProxy',
        [genericTraderProxyV2.address],
      ),
    );
  }

  if (!(await core.dolomiteMargin.getIsGlobalOperator(genericTraderProxyV2.address))) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetGlobalOperator',
        [genericTraderProxyV2.address, true],
      ),
    );
  }

  const genericTraderProxyV1Address = CoreDeployments.GenericTraderProxyV1[core.network].address;
  if (await core.dolomiteMargin.getIsGlobalOperator(genericTraderProxyV1Address)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteMargin: core.dolomiteMargin },
        'dolomiteMargin',
        'ownerSetGlobalOperator',
        [genericTraderProxyV1Address, false],
      ),
    );
  }

  let needsRegistryMigratorEncoding = true;
  let needsRegistryOracleAggregatorEncoding = true;
  try {
    const foundDolomiteMigratorAddress = await dolomiteRegistry.dolomiteMigrator();
    const foundOracleAggregatorAddress = await dolomiteRegistry.oracleAggregator();
    if (foundDolomiteMigratorAddress === ADDRESS_ZERO && foundOracleAggregatorAddress === ADDRESS_ZERO) {
      needsRegistryMigratorEncoding = false;
      needsRegistryOracleAggregatorEncoding = false;
      await dolomiteRegistry.lazyInitialize(dolomiteMigratorAddress, oracleAggregatorAddress);
    } else if (
      foundDolomiteMigratorAddress === dolomiteMigratorAddress &&
      foundOracleAggregatorAddress === oracleAggregatorAddress
    ) {
      needsRegistryMigratorEncoding = false;
      needsRegistryOracleAggregatorEncoding = false;
    } else if (foundDolomiteMigratorAddress === dolomiteMigratorAddress) {
      needsRegistryMigratorEncoding = false;
    } else if (foundOracleAggregatorAddress === oracleAggregatorAddress) {
      needsRegistryOracleAggregatorEncoding = false;
    }
  } catch (e) {}
  if (needsRegistryMigratorEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDolomiteMigrator',
        [dolomiteMigratorAddress],
      ),
    );
  }
  if (needsRegistryOracleAggregatorEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetOracleAggregator',
        [oracleAggregatorAddress],
      ),
    );
  }

  let selectors: string[];
  try {
    selectors = await dolomiteRegistry.isolationModeMulticallFunctions();
  } catch (e) {
    selectors = [];
  }
  const functionNames = [
    'depositIntoVaultForDolomiteMargin',
    'withdrawFromVaultForDolomiteMargin',
    'openBorrowPosition',
    'openMarginPosition',
    'transferIntoPositionWithUnderlyingToken',
    'transferIntoPositionWithOtherToken',
    'transferFromPositionWithUnderlyingToken',
    'transferFromPositionWithOtherToken',
    'swapExactInputForOutput',
    'closeBorrowPositionWithUnderlyingVaultToken',
    'closeBorrowPositionWithOtherTokens',
  ];
  const expectedSelectors = functionNames
    .map((name) => IIsolationModeTokenVaultV1__factory.createInterface().getSighash(name))
    .sort((a, b) => parseInt(a, 16) - parseInt(b, 16));
  if (!isArraysEqual(selectors, expectedSelectors)) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetIsolationModeMulticallFunctions',
        [expectedSelectors],
      ),
    );
  }
}
