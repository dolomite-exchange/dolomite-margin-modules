import { ADDRESS_ZERO } from '@dolomite-exchange/zap-sdk/dist/src/lib/Constants';
import CoreDeployments from '@dolomite-margin/dist/migrations/deployed.json';
import {
  GenericTraderProxyV2,
  IDolomiteRegistry,
  IIsolationModeTokenVaultV1__factory,
  ILiquidatorProxyV6,
  RegistryProxy,
} from 'packages/base/src/types';
import { isArraysEqual } from 'packages/base/src/utils';
import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../../base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';
import { encodeSetGlobalOperatorIfNecessary } from '../../../utils/encoding/dolomite-margin-core-encoder-utils';

export async function encodeDolomiteRegistryMigrations<T extends DolomiteNetwork>(
  dolomiteRegistry: IDolomiteRegistry,
  dolomiteRegistryProxy: RegistryProxy,
  borrowPositionProxyAddress: string,
  dolomiteAccountRegistryProxy: RegistryProxy,
  dolomiteMigratorAddress: string,
  genericTraderProxyV2: GenericTraderProxyV2,
  liquidatorProxyV6: ILiquidatorProxyV6,
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

  let needsTreasuryEncoding = true;
  try {
    const foundTreasury = await dolomiteRegistry.treasury();
    needsTreasuryEncoding = foundTreasury !== core.gnosisSafeAddress;
  } catch (e) {}
  if (needsTreasuryEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetTreasury',
        [core.gnosisSafeAddress],
      ),
    );
  }

  let needsDaoEncoding = true;
  try {
    const foundDao = await dolomiteRegistry.dao();
    needsDaoEncoding = foundDao !== (core.daoAddress ?? core.gnosisSafeAddress);
  } catch (e) {}
  if (needsDaoEncoding) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { dolomiteRegistry },
        'dolomiteRegistry',
        'ownerSetDao',
        [core.daoAddress ?? core.gnosisSafeAddress],
      ),
    );
  }

  const genericTraderProxyV1Address = CoreDeployments.GenericTraderProxyV1[core.network].address;
  transactions.push(
    ...await encodeSetGlobalOperatorIfNecessary(
      core,
      genericTraderProxyV1Address,
      false,
    ),
    ...await encodeSetGlobalOperatorIfNecessary(
      core,
      genericTraderProxyV2,
      true,
    ),
    ...await encodeSetGlobalOperatorIfNecessary(
      core,
      liquidatorProxyV6,
      true,
    ),
  );

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
