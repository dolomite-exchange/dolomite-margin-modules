import axios from 'axios';
import { BaseContract, BigNumber, BigNumberish, ethers, PopulatedTransaction } from 'ethers';
import { commify, formatEther, FormatTypes, ParamType } from 'ethers/lib/utils';
import fs from 'fs';
import hardhat from 'hardhat';
import { IChainlinkAggregator__factory } from 'packages/oracles/src/types';
import { IERC20, IERC20Metadata, IERC20Metadata__factory } from '../../../../base/src/types';
import { INVALID_TOKEN_MAP } from '../../../../base/src/utils/constants';
import { AccountRiskOverrideRiskFeature } from '../../../../base/src/utils/constructors/dolomite';
import {
  ADDRESS_ZERO,
  DolomiteNetwork,
  NETWORK_TO_NETWORK_NAME_MAP,
  ONE_BI,
  TEN_BI,
  ZERO_BI,
} from '../../../../base/src/utils/no-deps-constants';
import { CoreProtocolType } from '../../../../base/test/utils/setup';
import { CORE_DEPLOYMENT_FILE_NAME, readDeploymentFile } from '../deploy-utils';
import { EncodedTransaction } from '../dry-run-utils';

let mostRecentTokenDecimals: number | undefined = undefined;
const numMarketsKey = 'numMarkets';
const marketIdToMarketNameCache: Record<string, string | undefined> = {};

export function setMostRecentTokenDecimals(_mostRecentTokenDecimals: number | undefined) {
  mostRecentTokenDecimals = _mostRecentTokenDecimals;
}

export async function getFormattedMarketName<T extends DolomiteNetwork>(
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

export async function getFormattedTokenName<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  tokenAddress: string,
): Promise<string> {
  if (tokenAddress === ADDRESS_ZERO) {
    return '(None)';
  }

  await fetchTokenDecimals(core, tokenAddress);
  const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
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

async function fetchTokenDecimals<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  tokenAddress: string,
): Promise<void> {
  try {
    const token = IERC20Metadata__factory.connect(tokenAddress, core.hhUser1);
    const tokenInfo = INVALID_TOKEN_MAP[core.network][token.address];
    if (tokenInfo) {
      mostRecentTokenDecimals = tokenInfo.decimals;
    } else {
      mostRecentTokenDecimals = await token.decimals();
    }
  } catch (e) {}
}

export async function getFormattedChainlinkAggregatorName<T extends DolomiteNetwork>(
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

export function isOwnerFunction(methodName: string, isMultiSig: boolean): boolean {
  return (
    methodName.startsWith('owner') ||
    methodName === 'initializeETHMarket' ||
    methodName === 'setGmxRegistry' ||
    methodName === 'setIsTokenConverterTrusted' ||
    methodName === 'setUserVaultImplementation' ||
    methodName === 'upgradeTo' ||
    methodName === 'upgradeToAndCall' ||
    (isMultiSig && methodName === 'addOwner') ||
    (isMultiSig && methodName === 'changeRequirement') ||
    (isMultiSig && methodName === 'changeTimelock') ||
    (isMultiSig && methodName === 'removeOver') ||
    (isMultiSig && methodName === 'replaceOwner') ||
    (isMultiSig && methodName === 'setSelector')
  );
}

export async function isValidAmountForCapForToken(token: IERC20, amount: BigNumberish) {
  const realAmount = BigNumber.from(amount);
  if (realAmount.eq(ZERO_BI) || realAmount.eq('1')) {
    return true;
  }

  const totalSupply = await token.totalSupply();
  const decimals = await IERC20Metadata__factory.connect(token.address, token.signer).decimals();
  const scale = TEN_BI.pow(decimals);
  return (
    // should not be truncated to 0 AND (be less than 100M units or 20% of the total supply)
    realAmount.div(scale).gt(ONE_BI) && (realAmount.div(scale).lte(100_000_000) || realAmount.lte(totalSupply.div(5)))
  );
}

let counter = 1;

export async function prettyPrintEncodedDataWithTypeSafety<
  N extends DolomiteNetwork,
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
  options: {
    skipWrappingCalldataInSubmitTransaction?: boolean;
    submitAndExecuteImmediately?: boolean;
  } = { skipWrappingCalldataInSubmitTransaction: false, submitAndExecuteImmediately: false },
): Promise<EncodedTransaction> {
  const contract = liveMap[key];
  const transaction = await contract.populateTransaction[methodName.toString()](...(args as any));

  if (hardhat.network.name !== 'hardhat') {
    let decimals: number | undefined;
    try {
      contract.interface.getFunction('decimals');
      decimals = await (contract as any as IERC20Metadata).decimals();
    } catch (e) {}

    const fragment = contract.interface.getFunction(methodName.toString());
    const mappedArgs: string[] = [];
    for (let i = 0; i < (args as any[]).length; i++) {
      mappedArgs.push(
        await getReadableArg(core, fragment.inputs[i], (args as any[])[i], methodName.toString(), args, decimals),
      );
    }

    const repeatLength = 76 + (counter - 1).toString().length + key.toString().length + methodName.toString().length;
    const toArg = await getReadableArg(core, ParamType.fromString('address to'), transaction.to, undefined, args);
    console.log(''); // add a new line
    console.log(
      `=================================== ${counter++} - ${String(key)}.${String(
        methodName,
      )} ===================================`,
    );
    console.log('Readable:\t', `${String(key)}.${String(methodName)}(\n\t\t\t${mappedArgs.join(' ,\n\t\t\t')}\n\t\t)`);
    console.log('To:\t\t', toArg.substring(13));
    console.log('Data:\t\t', transaction.data);
    console.log('='.repeat(repeatLength));
    console.log(''); // add a new line
  }

  // Reset the most recent token decimals between calls
  setMostRecentTokenDecimals(undefined);

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
    if (options.submitAndExecuteImmediately) {
      outerTransaction = await core.ownerAdapterV1.populateTransaction.submitTransactionAndExecute(
        transaction.to!,
        transaction.data!,
      );
    } else {
      outerTransaction = await core.ownerAdapterV1.populateTransaction.submitTransaction(
        transaction.to!,
        transaction.data!,
      );
    }
  } else if (realtimeOwner === core.ownerAdapterV2?.address) {
    if (options.submitAndExecuteImmediately) {
      outerTransaction = await core.ownerAdapterV2.populateTransaction.submitTransactionAndExecute(
        transaction.to!,
        transaction.data!,
      );
    } else {
      outerTransaction = await core.ownerAdapterV2.populateTransaction.submitTransaction(
        transaction.to!,
        transaction.data!,
      );
    }
  } else if (realtimeOwner === core.delayedMultiSig?.address) {
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

export async function getReadableArg<T extends DolomiteNetwork>(
  core: CoreProtocolType<T>,
  inputParamType: ParamType,
  arg: any,
  methodName: string | undefined,
  args: any[],
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

  if (
    methodName === 'ownerSetRiskFeatureByMarketId' &&
    args[1] === AccountRiskOverrideRiskFeature.SINGLE_COLLATERAL_WITH_STRICT_DEBT &&
    typeof arg === 'string' &&
    arg.startsWith('0x')
  ) {
    const decimalType = 'tuple(uint256 value)';
    const tupleType = ParamType.fromString(
      `tuple singleCollateralRiskStructs(uint256[] debtMarketIds, ${decimalType} marginRatioOverride, ${decimalType} liquidationRewardOverride)[]`,
    );
    const decodedValue = ethers.utils.defaultAbiCoder.decode([tupleType], arg)[0].map((tuples: any[]) => {
      return tuples.reduce((acc: any, v: any, i: number) => {
        if (i === 0) {
          acc.debtMarketIds = v.map((a: any) => a.toString());
        } else if (i === 1) {
          acc.marginRatioOverride = v.value;
        } else if (i === 2) {
          acc.liquidationRewardOverride = v.value;
        } else {
          throw new Error(`Invalid index, found: ${i}`);
        }

        return acc;
      }, {} as any);
    });
    return getReadableArg(core, tupleType, decodedValue, undefined, args, undefined, index, nestedLevel);
  }
  if (methodName === 'ownerAddRoleToAddressFunctionSelectors' && typeof arg === 'string' && arg.length === 10) {
    // We're dealing with a function selector
    const chain = hardhat.userConfig.etherscan?.customChains?.find(
      (c) => c.chainId === parseInt(core.config.network, 10),
    );
    if (typeof hardhat.userConfig.etherscan?.apiKey === 'string') {
      throw new Error('Invalid API key field on etherscan object');
    }
    const apiKey = hardhat.userConfig.etherscan?.apiKey?.[NETWORK_TO_NETWORK_NAME_MAP[core.config.network]];

    if (chain && apiKey) {
      const baseUrl = chain.urls.apiURL;
      const response = await axios.get(`${baseUrl}?module=contract&action=getabi&address=${args[1]}&apikey=${apiKey}`);
      if (response.data.status === '1') {
        const abi = JSON.parse(response.data.result);
        const functionName = new ethers.utils.Interface(abi).getFunction(arg).name;
        return `${formattedInputParamName} = ${arg} (${functionName})`;
      }
    }
  }

  if (Array.isArray(arg)) {
    // remove the [] at the end
    const subParamType = ParamType.fromObject({
      ...inputParamType.arrayChildren,
      name: inputParamType.name,
    });
    const formattedArgs = await Promise.all(
      arg.map(async (value, i) => {
        return await getReadableArg(core, subParamType, value, methodName, args, decimals, i, nestedLevel + 1);
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
    if (arg.toLowerCase() === core.gnosisSafeAddress.toLowerCase()) {
      specialName = ' (Dolomite Foundation Safe)';
    }

    if (!specialName) {
      const allDeployments = readAllDeploymentFiles();
      Object.keys(allDeployments).forEach((key) => {
        if ((allDeployments as any)[key][chainId]?.address?.toLowerCase() === arg.toLowerCase()) {
          specialName = ` (${key})`;
        }
      });
      await fetchTokenDecimals(core, arg);
    }

    if (!specialName) {
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
    if (
      inputParamType.name.toLowerCase().includes('premium') ||
      inputParamType.name.toLowerCase().includes('ratio') ||
      inputParamType.name.toLowerCase().includes('spread')
    ) {
      decimals = 18;
    }
    const values: string[] = [];
    const keys = Object.keys(arg);
    for (let i = 0; i < keys.length; i++) {
      const componentPiece = inputParamType.components[i];
      values.push(
        await getReadableArg(
          core,
          componentPiece,
          arg[componentPiece.name],
          methodName,
          args,
          decimals,
          index,
          nestedLevel + 1,
        ),
      );
    }
    const tabs = '\t'.repeat(nestedLevel);
    return `${formattedInputParamName} = {\n${tabs}\t${values.join(` ,\n${tabs}\t`)}\n${tabs}}`;
  }

  if (BigNumber.isBigNumber(arg) && typeof decimals !== 'undefined') {
    const multiplier = BigNumber.from(10).pow(18 - decimals);
    specialName = ` (${commify(formatEther(arg.mul(multiplier)))})`;
  } else if (
    BigNumber.isBigNumber(arg) &&
    (formattedInputParamName.includes('marginRatio') || formattedInputParamName.includes('liquidationReward'))
  ) {
    specialName = ` (${commify(formatEther(arg))})`;
  } else if ((inputParamType.type === 'uint256' || inputParamType.type === 'uint128') && mostRecentTokenDecimals) {
    const multiplier = BigNumber.from(10).pow(18 - mostRecentTokenDecimals);
    const formattedNumber = commify(formatEther(BigNumber.from(arg).mul(multiplier)));
    specialName = ` (${formattedNumber}) (${mostRecentTokenDecimals} decimals)`;
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
