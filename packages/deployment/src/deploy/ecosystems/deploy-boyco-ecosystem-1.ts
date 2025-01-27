import { getAndCheckSpecificNetwork } from '@dolomite-exchange/modules-base/src/utils/dolomite-utils';
import { Network } from '@dolomite-exchange/modules-base/src/utils/no-deps-constants';
import { getRealLatestBlockNumber } from '@dolomite-exchange/modules-base/test/utils';
import { setupCoreProtocol } from '@dolomite-exchange/modules-base/test/utils/setup';
import { BigNumberish, ethers } from 'ethers';
import { assertHardhatInvariant } from 'hardhat/internal/core/errors';
import {
  DolomiteERC4626,
  IDepositExecutor__factory,
  IERC20,
  IERC20Metadata__factory, IERC4626, IERC4626__factory,
} from '../../../../base/src/types';
import { TRANSACTION_BUILDER_VERSION } from '../../utils/deploy-utils';
import { doDryRunAndCheckDeployment, DryRunOutput } from '../../utils/dry-run-utils';
import getScriptName from '../../utils/get-script-name';

const UNLOCK_TIMESTAMP_1M = 1741267800;
const UNLOCK_TIMESTAMP_3M = 1746534600;

async function main(): Promise<DryRunOutput<Network.Berachain>> {
  const network = await getAndCheckSpecificNetwork(Network.Berachain);
  const core = await setupCoreProtocol({ network, blockNumber: await getRealLatestBlockNumber(true, network) });

  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, core.hhUser1.provider);
  const depositExecutor = IDepositExecutor__factory.connect('0xEC1F64Cd852c65A22bCaA778b2ed76Bc5502645C', signer);
  console.log('\tExecuting from:', signer.address);

  const tokens = core.tokens;
  const dTokens = core.dolomiteTokens;
  const boycoMarkets: [string, BigNumberish, DolomiteERC4626 | IERC4626, IERC20][] = [
    [
      '0x1e0a98a276ba873cfa427e247c7d0e438f604a54fcb36481063e1220af021faf',
      UNLOCK_TIMESTAMP_3M,
      dTokens.usdc!,
      tokens.usdc,
    ],
    [
      '0xa588ad19850cf2a111c3c727033da8e557abc94de70fce2d2b2f2f78140f15e5',
      UNLOCK_TIMESTAMP_3M,
      dTokens.usde,
      tokens.usde,
    ],
    [
      '0x092c0c4d8d124fc29364e8cd8417198c4bbe335e3f6c4b1f79215a3457b4831a',
      UNLOCK_TIMESTAMP_3M,
      dTokens.sUsde,
      tokens.sUsde,
    ],
    [
      '0xbe5cd829fcb3cdfe8224ad72fc3379198d38da26131c5b7ab6664c8f56a9730d',
      UNLOCK_TIMESTAMP_3M,
      dTokens.nect,
      tokens.nect,
    ],
    [
      '0x42a09eccabf1080c40a24522e9e8adbee5a0ad907188c9b6e50ba26ba332eac3',
      UNLOCK_TIMESTAMP_3M,
      dTokens.sbtc,
      tokens.sbtc,
    ],
    [
      '0xd10bdc88272e0958baa62a4ae2bfce1d8feed639a93e03c0aa5cec7adfbdf2c3',
      UNLOCK_TIMESTAMP_1M,
      dTokens.uniBtc,
      tokens.uniBtc,
    ],
    [
      '0xb1d5ccc4388fe639f8d949061bc2de95ecb1efb11c5ceb93bdb71caab58c8aa3',
      UNLOCK_TIMESTAMP_3M,
      dTokens.solvBtc,
      tokens.solvBtc,
    ],
    [
      '0x2a3a73ba927ec6bbf0e2e12e21a32e274a295389ce9d6ae2b32435d12c597c2c',
      UNLOCK_TIMESTAMP_1M,
      dTokens.solvBtcBbn,
      tokens.solvBtcBbn,
    ],
    [
      '0xff917303af9337534eece4b88948d609980b66ca0b41875da782aec4858cade5',
      UNLOCK_TIMESTAMP_1M,
      dTokens.pumpBtc,
      tokens.pumpBtc,
    ],
    [
      '0xb27f671bc0dd8773a25136253acd72150dd59e50e44dc8439e9dc5c84c2b19f6',
      UNLOCK_TIMESTAMP_3M,
      dTokens.stone,
      tokens.stone,
    ],
    [
      '0x258ac521d801d5112a484ad1b82e6fd2efc24aba29e5cd3d56db83f4a173dc90',
      UNLOCK_TIMESTAMP_1M,
      dTokens.beraEth,
      tokens.beraEth,
    ],
    [
      '0x5bac1cacdd36b3d95a7f9880a264f8481ab56d3d1a53993de084c6fa5febcc15',
      UNLOCK_TIMESTAMP_1M,
      dTokens.ylStEth,
      tokens.ylStEth,
    ],
    [
      '0x0194c329e2b9712802c37d3f17502bcefce2e128933f24f4fe847dfc7e5e8965',
      UNLOCK_TIMESTAMP_1M,
      dTokens.ylBtcLst,
      tokens.ylBtcLst,
    ],
    [
      '0x6306bfce6bff30ec4efcea193253c43e057f1474007d0d2a5a0c2938bd6a9b81',
      UNLOCK_TIMESTAMP_1M,
      dTokens.ylPumpBtc,
      tokens.ylPumpBtc,
    ],
    [
      '0xc6887dddd833a3d585c7941cd31b0f8ff3ec5903d49cd5e7ac450b46532d3e79',
      UNLOCK_TIMESTAMP_1M,
      dTokens.stBtc,
      tokens.stBtc,
    ],
    [
      '0x86a5077c6a9190cde78ec75b8888c46ed0a3d1289054127a955a2af544633cf3',
      UNLOCK_TIMESTAMP_1M,
      dTokens.usda,
      tokens.usda,
    ],
    [
      '0x2dd74f8f8a8d7f27b2a82a6edce57b201f9b4a3c4780934caf99363115e48be6',
      UNLOCK_TIMESTAMP_1M,
      dTokens.sUsda,
      tokens.sUsda,
    ],
    [
      '0xc90525132d909f992363102ebd6298d95b1f312acdb9421fd1f7ac0c0dd78d3f',
      UNLOCK_TIMESTAMP_1M,
      dTokens.rswEth,
      tokens.rswEth,
    ],
    [
      '0x415f935bbb9bf1bdc1f49f2ca763d5b2406efbf9cc949836880dd5bbd054db95',
      UNLOCK_TIMESTAMP_3M,
      dTokens.rsEth,
      tokens.rsEth,
    ],
    // Infrared markets are taken from here: https://gist.github.com/red4626/b9f39a86ed1164d3bd666f3cdc32e426
    [
      '0x9778047cb8f3740866882a97a186dff42743bebb3ad8010edbf637ab0e37751f',
      UNLOCK_TIMESTAMP_3M,
      IERC4626__factory.connect('0xb13A7D1361bd6f6734078654047daAE210f2d4D4', signer), // Infrared HONEY
      dTokens.honey,
    ],
    [
      '0x9c7bd5b59ebcb9a9e6787b9b174a98a69e27fa5a4fe98270b461a1b9b1b1aa3e',
      UNLOCK_TIMESTAMP_3M,
      IERC4626__factory.connect('0x01b775b353176bb1b9075C5d344c2B689285282a', signer), // Infrared USDT
      dTokens.usdt,
    ],
    [
      '0x0a7565b14941c6a3dde083fb7a857e27e12c55fa34f709c37586ec585dbe7f3f',
      UNLOCK_TIMESTAMP_3M,
      IERC4626__factory.connect('0x778e9294Af38DFc8B92e8969953eB559b47e896E', signer), // Infrared WETH
      dTokens.weth!,
    ],
    [
      '0xa6905c68ad66ea9ce966aa1662e1417df08be333ab8ec04507e0f0301d3a78e9',
      UNLOCK_TIMESTAMP_3M,
      IERC4626__factory.connect('0x7de65E4fcc6a0b411B90a24CC33741AB3CD00262', signer), // Infrared WBTC
      dTokens.wbtc,
    ],
  ];

  for (const boycoMarket of boycoMarkets) {
    const underlyingToken = await boycoMarket[2].asset();
    assertHardhatInvariant(
      underlyingToken === boycoMarket[3].address,
      `Invalid dToken for market: ${boycoMarket[3].address}`,
    );

    const name = await IERC20Metadata__factory.connect(boycoMarket[2].address, signer).name();
    console.log('\tInitializing Boyco market for ', name);
    const result = await depositExecutor.initializeCampaign(boycoMarket[0], boycoMarket[1], boycoMarket[2].address, {
      weirollState: [],
      weirollCommands: [],
    });
    console.log(`\tFinished initializing ${name}:`, result.hash);
    console.log();
  }

  return {
    core: core as any,
    invariants: async () => {},
    scriptName: getScriptName(__filename),
    upload: {
      transactions: [],
      chainId: network,
      meta: {
        name: 'Boyco Ecosystem',
        txBuilderVersion: TRANSACTION_BUILDER_VERSION,
      },
    },
  };
}

doDryRunAndCheckDeployment(main);
