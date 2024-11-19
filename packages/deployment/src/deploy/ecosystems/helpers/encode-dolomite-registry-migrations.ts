import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import {
  IDolomiteRegistry,
  IIsolationModeTokenVaultV1__factory,
  RegistryProxy,
} from 'packages/base/src/types';
import { isArraysEqual } from 'packages/base/src/utils';
import { EncodedTransaction, prettyPrintEncodedDataWithTypeSafety } from '../../../utils/deploy-utils';

export async function encodeDolomiteRegistryMigrations(
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteRegistryProxy: RegistryProxy,
  dolomiteAccountRegistryAddress: string,
  dolomiteMigratorAddress: string,
  oracleAggregatorAddress: string,
  registryImplementationAddress: string,
  transactions: EncodedTransaction[],
  core: any,
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
      foundDolomiteAccountRegistryAddress !== dolomiteAccountRegistryAddress;
  } catch (e) {}
  if (needsRegistryDolomiteAccountRegistryEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDolomiteAccountRegistry',
        [dolomiteAccountRegistryAddress],
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
