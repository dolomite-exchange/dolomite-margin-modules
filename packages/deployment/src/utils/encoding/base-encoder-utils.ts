import { BaseContract, BigNumber, BigNumberish, PopulatedTransaction } from 'ethers';
import { commify, formatEther, FormatTypes, ParamType } from 'ethers/lib/utils';
import fs from 'fs';
import hardhat from 'hardhat';
import { IChainlinkAggregator__factory } from 'packages/oracles/src/types';
import { IERC20, IERC20Metadata__factory } from '../../../../base/src/types';
import { INVALID_TOKEN_MAP } from '../../../../base/src/utils/constants';
import { ADDRESS_ZERO, NetworkType, ONE_BI, TEN_BI, ZERO_BI } from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { CORE_DEPLOYMENT_FILE_NAME, readDeploymentFile } from '../deploy-utils';
import { EncodedTransaction } from '../dry-run-utils';

let mostRecentTokenDecimals: number | undefined = undefined;
const numMarketsKey = 'numMarkets';
const marketIdToMarketNameCache: Record<string, string | undefined> = {};

export function setMostRecentTokenDecimals(_mostRecentTokenDecimals: number) {
  mostRecentTokenDecimals = _mostRecentTokenDecimals;
}

export async function getFormattedMarketName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  marketId: BigNumberish,
): Promise<string> {
  let cachedNumMarkets = marketIdToMarketNameCache[numMarketsKey];
  if (!cachedNumMarkets) {
    cachedNumMarkets = (await core.dolomiteMargin.getNumMarkets()).toString();
    marketIdToMarketNameCache[cachedNumMarkets] = cachedNumMarkets;
  }
  if (BigNumber.from(marketId).gte(cachedNumMarkets)) {
    return '(Unknown)';
  }

  const cachedName = marketIdToMarketNameCache[marketId.toString()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  const tokenAddress = await core.dolomiteMargin.getMarketTokenAddress(marketId);
  const marketName = await getFormattedTokenName(core, tokenAddress);
  marketIdToMarketNameCache[marketId.toString()] = marketName;
  return marketName;
}

const addressToNameCache: Record<string, string | undefined> = {};

export async function getFormattedTokenName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  tokenAddress: string,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return '(None)';
  }

  const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
  try {
    const tokenInfo = INVALID_TOKEN_MAP[core.network][token.address];
    if (tokenInfo) {
      mostRecentTokenDecimals = tokenInfo.decimals;
    } else {
      mostRecentTokenDecimals = await token.decimals();
    }
  } catch (e) {
  }

  const cachedName = addressToNameCache[tokenAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }
  try {
    addressToNameCache[tokenAddress.toLowerCase()] = `(${await token.symbol()})`;
    return addressToNameCache[tokenAddress.toLowerCase()]!;
  } catch (e) {
    addressToNameCache[tokenAddress.toLowerCase()] = '';
    return '';
  }
}

export async function getFormattedChainlinkAggregatorName<T extends NetworkType>(
  core: CoreProtocolType<T>,
  aggregatorAddress: string,
): Promise<string> {
  if (aggregatorAddress === ADDRESS_ZERO) {
    return 'None';
  }

  const cachedName = addressToNameCache[aggregatorAddress.toString().toLowerCase()];
  if (typeof cachedName !== 'undefined') {
    return cachedName;
  }

  const aggregator = IChainlinkAggregator__factory.connect(aggregatorAddress, core.hhUser1);
  try {
    addressToNameCache[aggregatorAddress.toLowerCase()] = `(${await aggregator.description()})`;
    return addressToNameCache[aggregatorAddress.toLowerCase()]!;
  } catch (e) {
    addressToNameCache[aggregatorAddress.toLowerCase()] = '';
    return '';
  }
}

export function isMarketIdParam(paramType: ParamType): boolean {
  return paramType.name.includes('marketId') || paramType.name.includes('MarketId');
}

export function isTokenParam(paramType: ParamType): boolean {
  return (
    (paramType.name.includes('token') || paramType.name.includes('Token')) &&
    !paramType.name.toLowerCase().includes('decimals')
  );
}

export function isChainlinkAggregatorParam(paramType: ParamType): boolean {
  return paramType.name.includes('chainlinkAggregator');
}

export function isMaxWeiParam(paramType: ParamType): boolean {
  return (
    paramType.name.includes('maxWei') ||
    paramType.name.includes('maxSupplyWei') ||
    paramType.name.includes('maxBorrowWei')
  );
}

export function isOwnerFunction(methodName: string, isMultisig: boolean): boolean {
  return (
    methodName.startsWith('owner') ||
    methodName === 'initializeETHMarket' ||
    methodName === 'setGmxRegistry' ||
    methodName === 'setIsTokenConverterTrusted' ||
    methodName === 'setUserVaultImplementation' ||
    methodName === 'upgradeTo' ||
    methodName === 'upgradeToAndCall' ||
    (isMultisig && methodName === 'addOwner') ||
    (isMultisig && methodName === 'changeRequirement') ||
    (isMultisig && methodName === 'changeTimelock') ||
    (isMultisig && methodName === 'removeOver') ||
    (isMultisig && methodName === 'replaceOwner') ||
    (isMultisig && methodName === 'setSelector')
  );
}

export async function isValidAmount(token: IERC20, amount: BigNumberish) {
  const realAmount = BigNumber.from(amount);
  if (realAmount.eq(ZERO_BI) || realAmount.eq('1')) {
    return true;
  }

  const decimals = await IERC20Metadata__factory.connect(token.address, token.signer).decimals();
  const scale = TEN_BI.pow(decimals);
  return realAmount.div(scale).gt(ONE_BI) && realAmount.div(scale).lte(100_000_000);
}

let counter = 1;

export async function prettyPrintEncodedDataWithTypeSafety<
  N extends NetworkType,
  T extends V[K],
  U extends keyof T['populateTransaction'],
  V extends Record<K, BaseContract>,
  K extends keyof V,
>(
  core: CoreProtocolType<N>,
  liveMap: V,
  key: K,
  methodName: U,
  args: Parameters<T['populateTransaction'][U]>,
  options: { skipWrappingCalldataInSubmitTransaction: boolean } = { skipWrappingCalldataInSubmitTransaction: false },
): Promise<EncodedTransaction> {
  const contract = liveMap[key];
  const transaction = await contract.populateTransaction[methodName.toString()](...(args as any));

  if (hardhat.network.name !== 'hardhat') {
    const fragment = contract.interface.getFunction(methodName.toString());
    const mappedArgs: string[] = [];
    for (let i = 0; i < (args as any[]).length; i++) {
      mappedArgs.push(await getReadableArg(core, fragment.inputs[i], (args as any[])[i]));
    }

    const repeatLength = 76 + (counter - 1).toString().length + key.toString().length + methodName.toString().length;
    console.log(''); // add a new line
    console.log(
      `=================================== ${counter++} - ${String(key)}.${String(
        methodName,
      )} ===================================`,
    );
    console.log('Readable:\t', `${String(key)}.${String(methodName)}(\n\t\t\t${mappedArgs.join(' ,\n\t\t\t')}\n\t\t)`);
    console.log(
      'To:\t\t',
      (await getReadableArg(core, ParamType.fromString('address to'), transaction.to)).substring(13),
    );
    console.log('Data:\t\t', transaction.data);
    console.log('='.repeat(repeatLength));
    console.log(''); // add a new line
  }

  const realtimeOwner = await core.dolomiteMargin.owner();
  const skipWrappingCalldataInSubmitTransaction =
    options.skipWrappingCalldataInSubmitTransaction ||
    (realtimeOwner === core.ownerAdapterV1.address && realtimeOwner === transaction.to!);
  if (skipWrappingCalldataInSubmitTransaction) {
    return {
      to: transaction.to!,
      value: transaction.value?.toString() ?? '0',
      data: transaction.data!,
    };
  }

  let outerTransaction: PopulatedTransaction;
  if (realtimeOwner === core.ownerAdapterV1?.address) {
    outerTransaction = await core.ownerAdapterV1.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.data!,
    );
  } else if (realtimeOwner === core.ownerAdapterV2?.address) {
    outerTransaction = await core.ownerAdapterV2.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.data!,
    );
  }else if (realtimeOwner === core.delayedMultiSig?.address) {
    outerTransaction = await core.delayedMultiSig.populateTransaction.submitTransaction(
      transaction.to!,
      transaction.value ?? ZERO_BI,
      transaction.data!,
    );
  } else if (realtimeOwner === core.gnosisSafeAddress) {
    outerTransaction = { ...transaction };
  } else {
    return Promise.reject(new Error(`Unknown owner contract: ${realtimeOwner}`));
  }

  return {
    to: outerTransaction.to!,
    value: outerTransaction.value?.toString() ?? '0',
    data: outerTransaction.data!,
  };
}

export async function getReadableArg<T extends NetworkType>(
  core: CoreProtocolType<T>,
  inputParamType: ParamType,
  arg: any,
  decimals?: number,
  index?: number,
  nestedLevel: number = 3,
): Promise<string> {
  let formattedInputParamName: string;
  if (typeof index !== 'undefined') {
    formattedInputParamName = `${inputParamType.name}[${index}]`;
  } else {
    formattedInputParamName = inputParamType.format(FormatTypes.full);
  }

  if (Array.isArray(arg)) {
    // remove the [] at the end
    const subParamType = ParamType.fromObject({
      ...inputParamType.arrayChildren,
      name: inputParamType.name,
    });
    const formattedArgs = await Promise.all(
      arg.map(async (value, i) => {
        return await getReadableArg(core, subParamType, value, decimals, i, nestedLevel + 1);
      }),
    );
    const tabs = '\t'.repeat(nestedLevel);
    return `${formattedInputParamName} = [\n${tabs}\t${formattedArgs.join(` ,\n${tabs}\t`)}\n${tabs}]`;
  }

  if (isMarketIdParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedMarketName(core, arg)}`;
  }
  if (isTokenParam(inputParamType)) {
    const tokenName = await getFormattedTokenName(core, arg);
    if (tokenName) {
      return `${formattedInputParamName} = ${arg} ${tokenName}`;
    }
  }
  if (isChainlinkAggregatorParam(inputParamType)) {
    return `${formattedInputParamName} = ${arg} ${await getFormattedChainlinkAggregatorName(core, arg)}`;
  }
  if (isMaxWeiParam(inputParamType) && typeof mostRecentTokenDecimals !== 'undefined') {
    const scaleTo18Decimals = BigNumber.from(10).pow(18 - mostRecentTokenDecimals);
    const decimal = commify(formatEther(BigNumber.from(arg).mul(scaleTo18Decimals)));
    return `${formattedInputParamName} = ${arg} (${decimal})`;
  }

  let specialName: string = '';
  if (inputParamType.type === 'address') {
    const chainId = core.config.network;
    const allDeployments = readAllDeploymentFiles();
    Object.keys(allDeployments).forEach((key) => {
      if ((allDeployments as any)[key][chainId]?.address?.toLowerCase() === arg.toLowerCase()) {
        specialName = ` (${key})`;
      }
    });
    if (!specialName) {
      Object.keys(allDeployments).forEach((key) => {
        if ((allDeployments as any)[key][chainId]?.address?.toLowerCase() === arg.toLowerCase()) {
          specialName = ` (${key})`;
        }
      });

      const tokenName = await getFormattedTokenName(core, arg);
      if (tokenName) {
        specialName = ` ${tokenName}`;
      }
    }
  }

  if (typeof arg === 'object' && !BigNumber.isBigNumber(arg)) {
    if (inputParamType.baseType !== 'tuple') {
      return Promise.reject(new Error('Object type is not tuple'));
    }
    let decimals: number | undefined = undefined;
    if (inputParamType.name.toLowerCase().includes('premium')) {
      decimals = 18;
    }
    const values: string[] = [];
    const keys = Object.keys(arg);
    for (let i = 0; i < keys.length; i++) {
      const componentPiece = inputParamType.components[i];
      values.push(
        await getReadableArg(core, componentPiece, arg[componentPiece.name], decimals, index, nestedLevel + 1),
      );
    }
    const tabs = '\t'.repeat(nestedLevel);
    return `${formattedInputParamName} = {\n${tabs}\t${values.join(` ,\n${tabs}\t`)}\n${tabs}}`;
  }

  if (BigNumber.isBigNumber(arg) && typeof decimals !== 'undefined') {
    const multiplier = BigNumber.from(10).pow(18 - decimals);
    specialName = ` (${commify(formatEther(arg.mul(multiplier)))})`;
  }

  return `${formattedInputParamName} = ${arg}${specialName}`;
}

function readAllDeploymentFiles(): Record<string, Record<string, any>> {
  const coreDeployments = JSON.parse(fs.readFileSync(CORE_DEPLOYMENT_FILE_NAME).toString());
  const deployments = readDeploymentFile();
  return {
    ...coreDeployments,
    ...deployments,
  };
}
