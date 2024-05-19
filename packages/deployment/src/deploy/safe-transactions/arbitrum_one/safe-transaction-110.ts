import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import {
  getOARBConstructorParams,
  getVesterExploderConstructorParams,
  getVesterImplementationConstructorParams,
  getVesterV1ProxyConstructorParams,
} from '@dolomite-exchange/modules-liquidity-mining/src/liquidity-mining-constructors';
import {
  OARB,
  OARB__factory,
  VesterImplementationV1,
  VesterImplementationV1__factory,
} from '@dolomite-exchange/modules-liquidity-mining/src/types';
import { Network } from 'packages/base/src/utils/no-deps-constants';
import {
  createFolder,
  DenJsonUpload,
  deployContractAndSave,
  EncodedTransaction,
  prettyPrintEncodedDataWithTypeSafety,
  writeFile,
} from '../../../utils/deploy-utils';

/**
 * This script encodes the following transactions:
 * - Creates the VesterImplementationV1V1 contract
 * - Creates the VesterProxy contract
 */
async function main(): Promise<DenJsonUpload> {
  const network = await getAndCheckSpecificNetwork(Network.ArbitrumOne);
  const core = await setupCoreProtocol({ network, blockNumber: 0 });
  const oARBAddress = await deployContractAndSave(
    'OARB',
    getOARBConstructorParams(core),
  );
  const oARB = OARB__factory.connect(oARBAddress, core.hhUser1);
  const vesterProxy = await createVesterProxy(core, network, oARB);
  const vesterExploderAddress = await deployContractAndSave(
    'VesterExploder',
    getVesterExploderConstructorParams(core, vesterProxy),
  );

  const transactions: EncodedTransaction[] = [];
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [vesterProxy.address, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      [vesterExploderAddress, true],
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      ['0xA8e31F2B9e4c91f41A19f82beDEFca86d8B2efcd', false], // old vester proxy
    ),
  );
  transactions.push(
    await prettyPrintEncodedDataWithTypeSafety(
      core,
      core,
      'dolomiteMargin',
      'ownerSetGlobalOperator',
      ['0xC34C2FC2d1B6514fe9998D966Dc843748E7E503a', false], // old vester exploder
    ),
  );

  return {
    transactions,
    chainId: network,
  };
}

async function createVesterProxy(
  core: CoreProtocolArbitrumOne,
  network: Network,
  oARB: OARB,
): Promise<VesterImplementationV1> {
  const vesterImplementationAddress = await deployContractAndSave(
    'VesterImplementationV1',
    getVesterImplementationConstructorParams(core),
    'VesterImplementationV1V1',
  );
  const vesterImplementation = VesterImplementationV1__factory.connect(
    vesterImplementationAddress,
    core.hhUser1,
  );
  const vesterProxyAddress = await deployContractAndSave(
    'VesterProxy',
    await getVesterV1ProxyConstructorParams(
      core,
      vesterImplementation,
      oARB,
      'ipfs://QmXHoyi1mahGiyLNJPThJssjzRWnQsz2FNpe8cJqH7KQv3',
    ),
  );

  return VesterImplementationV1__factory.connect(vesterProxyAddress, core.hhUser1);
}

main()
  .then(jsonUpload => {
    const path = require('path');
    const scriptName = path.basename(__filename).slice(0, -3);
    const dir = `${__dirname}/output`;
    createFolder(dir);
    writeFile(`${dir}/${scriptName}.json`, JSON.stringify(jsonUpload, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
