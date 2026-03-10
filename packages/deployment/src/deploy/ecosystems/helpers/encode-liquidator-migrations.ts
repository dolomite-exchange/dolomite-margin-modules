import { BigNumberish } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { IAsyncFreezableIsolationModeVaultFactory__factory, ILiquidatorProxyV6, RegistryProxy__factory } from '../../../../../base/src/types';
import { LIQUIDATOR_ADDRESS_MAP } from '../../../../../base/src/utils/constants';
import { DolomiteNetwork } from '../../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../../base/test/utils/setup';
import { EncodedTransaction } from '../../../utils/dry-run-utils';
import { prettyPrintEncodedDataWithTypeSafety } from '../../../utils/encoding/base-encoder-utils';

export async function encodeLiquidatorMigrations<T extends DolomiteNetwork>(
  liquidatorProxyV6: ILiquidatorProxyV6,
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
          await getAllNonAsyncFreezableMarketIds(core), // _initialPartialLiquidationMarketIds
        ],
      ),
    );
  }

  try {
  } catch (e) {
    console.error('');
  }
}

async function getAllNonAsyncFreezableMarketIds<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
): Promise<BigNumberish[]> {
  const marketIds = [];
  const length = await core.dolomiteMargin.getNumMarkets();
  for (let marketId = 0; marketId < length.toNumber(); marketId++) {
    const token = await core.dolomiteMargin.getMarketTokenAddress(marketId);
    try {
      const factory = IAsyncFreezableIsolationModeVaultFactory__factory.connect(token, core.hhUser1);
      await factory.isVaultFrozen('0x000000000000000000000000000000000000dead');
    } catch (e: any) {
      if (e.message.toLowerCase().includes('call revert exception')) {
        marketIds.push(marketId);
      }
    }
  }

  return marketIds;
}
