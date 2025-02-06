import { BigNumberish, ethers } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import { IERC20, IERC20Metadata__factory } from '../../../base/src/types';
import { INVALID_TOKEN_MAP } from '../../../base/src/utils/constants';
import { NetworkType } from '../../../base/src/utils/no-deps-constants';
import { CoreProtocolBerachain } from '../../../base/test/utils/core-protocols/core-protocol-berachain';
import { CoreProtocolType } from '../../../base/test/utils/setup';

export async function printPriceForVisualCheck(core: CoreProtocolBerachain, token: IERC20) {
  const meta = IERC20Metadata__factory.connect(token.address, token.provider);
  const invalidToken = INVALID_TOKEN_MAP[core.network][token.address];
  const symbol = invalidToken ? invalidToken.symbol : await meta.symbol();
  const decimals = invalidToken ? invalidToken.decimals : await meta.decimals();
  const price = await core.oracleAggregatorV2.getPrice(token.address);
  console.log(`\tPrice for ${symbol}:`, formatUnits(price.value, 36 - decimals));
}

export async function checkMarket(core: CoreProtocolBerachain, marketId: BigNumberish, token: IERC20) {
  let name: string | undefined;
  try {
    const metadata = IERC20Metadata__factory.connect(token.address, token.provider);
    name = await metadata.name();

    const decimals = await metadata.decimals();
    const price = await core.dolomiteMargin.getMarketPrice(marketId);
    console.log(`\tPrice for ${name}:`, ethers.utils.formatUnits(price.value, 36 - decimals));
  } catch (e: any) {
    return Promise.reject(new Error(`Could not get price for ${token.address} (${name}) due to error: ${e.message}`));
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketTokenAddress(marketId)) === token.address,
    `Invalid token for ${name}`,
  );
}

export async function checkIsGlobalOperator<T extends NetworkType>(
  core: CoreProtocolType<T>,
  address: string | { address: string },
) {
  const value = typeof address === 'string' ? address : address.address;
  assertHardhatInvariant(
    await core.dolomiteMargin.getIsGlobalOperator(value),
    `Expected ${value} to be global operator`,
  );
}

export async function checkSupplyCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedAmount: BigNumberish,
) {
  const errorMessage = `Expected market [${marketId}] to have a supply cap of ${expectedAmount.toString()}`;
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    assertHardhatInvariant(
      (await core.dolomiteMargin.getMarketMaxWei(marketId)).value.eq(expectedAmount),
      errorMessage,
    );
    return;
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketMaxSupplyWei(marketId)).value.eq(expectedAmount),
    errorMessage,
  );
}

export async function checkBorrowCap<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
  expectedAmount: BigNumberish,
) {
  const errorMessage = `Expected market [${marketId}] to have a borrow cap of ${expectedAmount.toString()}`;
  if ('ownerSetMaxWei' in core.dolomiteMargin) {
    assertHardhatInvariant(
      (await core.dolomiteMargin.getMarketMaxWei(marketId)).value.eq(expectedAmount),
      errorMessage,
    );
    return;
  }

  assertHardhatInvariant(
    (await core.dolomiteMargin.getMarketMaxBorrowWei(marketId)).value.eq(expectedAmount),
    errorMessage,
  );
}
