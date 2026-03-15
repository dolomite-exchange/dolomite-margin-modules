import { BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ILiquidatorProxyV6, LiquidatorProxyV6, RegistryProxy__factory } from '../../../../../base/src/types';
import { LIQUIDATOR_ADDRESS_MAP } from '../../../../../base/src/utils/constants';
import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../../base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { getIsPartialLiquidationSupported } from '../../../utils/encoding/add-market-encoder-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeLiquidatorMigrations<T extends DolomiteNetwork>(
  liquidatorProxyV6: LiquidatorProxyV6,
  liquidatorProxyV6Implementation: ILiquidatorProxyV6,
  transactions: EncodedTransaction[],
  core: CoreProtocolType<T>,
) {
  const proxy = RegistryProxy__factory.connect(liquidatorProxyV6.address, core.hhUser1);
  if ((await proxy.implementation()) !== liquidatorProxyV6Implementation.address) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(core, { liquidatorProxy: proxy }, 'liquidatorProxy', 'upgradeTo', [
        liquidatorProxyV6Implementation.address,
      ]),
    );
  }

  let version = 1;
  try {
    version = await liquidatorProxyV6.version();
  } catch (e) {
    console.debug('Could not retrieve version for LiquidatorProxyV6. Defaulting to V1...');
  }

  if (version < 2) {
    transactions.push(
      await prettyPrintEncodedDataWithTypeSafety(
        core,
        { liquidatorProxyV6 },
        'liquidatorProxyV6',
        'ownerInitializeV2',
        [
          { value: parseEther('0.10') }, // _dolomiteRake
          { value: parseEther('0.95') }, // _partialLiquidationThreshold
          LIQUIDATOR_ADDRESS_MAP[core.network], // _initialPartialLiquidator
          await getAllSupportedPartialLiquidationMarketIds(core), // _initialPartialLiquidationMarketIds
        ],
      ),
    );
  } else {
    const marketIdsForPartialLiquidation = await getAllSupportedPartialLiquidationMarketIds(core);
    if (marketIdsForPartialLiquidation.length > 0) {
      transactions.push(
        await prettyPrintEncodedDataWithTypeSafety(
          core,
          { liquidatorProxyV6 },
          'liquidatorProxyV6',
          'ownerSetMarketToPartialLiquidationSupported',
          [marketIdsForPartialLiquidation, marketIdsForPartialLiquidation.map(() => true)],
        ),
      );
    }
  }

  try {
  } catch (e) {
    console.error('');
  }
}

async function getAllSupportedPartialLiquidationMarketIds<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<BigNumberish[]> {
  const marketIdMap: Record<string, boolean> = {};
  const length = await core.dolomiteMargin.getNumMarkets();
  for (let marketId = 0; marketId < length.toNumber(); marketId++) {
    const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
    if (await getIsPartialLiquidationSupported(core, tokenAddress)) {
      marketIdMap[marketId] = true;
    }
  }

  const marketIds = Object.keys(marketIdMap);
  for (const marketId of marketIds) {
    try {
      if (await core.liquidatorProxyV6.isPartialLiquidationSupportedByMarketId(marketId)) {
        delete marketIdMap[marketId];
      }
    } catch (e) {}
  }

  return Object.keys(marketIdMap);
}
