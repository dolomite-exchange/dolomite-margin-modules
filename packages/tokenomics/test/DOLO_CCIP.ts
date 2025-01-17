import { CoreProtocolArbitrumOne } from 'packages/base/test/utils/core-protocols/core-protocol-arbitrum-one';
import {
  BurnMintTokenPool,
  BurnMintTokenPool__factory,
  DOLO,
  ICCIPOffRamp,
  ICCIPOffRamp__factory,
  ICCIPOnRamp,
  ICCIPOnRamp__factory,
  ICCIPRouter,
  ICCIPRouter__factory,
  IERC20,
  IRegistryModuleOwnerCustom,
  IRegistryModuleOwnerCustom__factory,
  ITokenAdminRegistry,
  ITokenAdminRegistry__factory,
  LockReleaseTokenPool,
  LockReleaseTokenPool__factory
} from '../src/types';
import { setupCoreProtocol } from 'packages/base/test/utils/setup';
import { ADDRESS_ZERO, BYTES_EMPTY, Network, ONE_ETH_BI, ZERO_BI } from 'packages/base/src/utils/no-deps-constants';
import { expect } from 'chai';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { impersonate, revertToSnapshotAndCapture, snapshot } from 'packages/base/test/utils';
import { createDOLO } from './tokenomics-ecosystem-utils';
import { createContractWithAbi } from 'packages/base/src/utils/dolomite-utils';
import { BigNumber, ContractTransaction } from 'ethers';
import { CoreProtocolBase } from 'packages/base/test/utils/core-protocols/core-protocol-base';
import { SignerWithAddressWithSafety } from 'packages/base/src/utils/SignerWithAddressWithSafety';
import { ethers } from 'hardhat';

const EMPTY_RATE_LIMITER_CONFIG = {
  isEnabled: false,
  capacity: 0,
  rate: 0,
};

const CCIP_ROUTER = '0x141fa059441E0ca23ce184B6A78bafD2A517DdE8';
const CCIP_RMN = '0xC311a21e6fEf769344EB1515588B9d535662a145';
const CCIP_TOKEN_ADMIN_REGISTRY = '0x39AE1032cF4B334a1Ed41cdD0833bdD7c7E7751E';
const CCIP_REGISTRY_MODULE_OWNER = '0x818792C958Ac33C01c58D5026cEc91A86e9071d7';
const CCIP_ARB_TO_BASE_ON_RAMP = '0xc1b6287A3292d6469F2D8545877E40A2f75CA9a6';

const CCIP_ROUTER_BASE = '0x881e3A65B4d4a04dD529061dd0071cf975F58bCD';
const CCIP_RMN_BASE = '0xC842c69d54F83170C42C4d556B4F6B2ca53Dd3E8';
const CCIP_TOKEN_ADMIN_REGISTRY_BASE = '0x6f6C373d09C07425BaAE72317863d7F6bb731e37';
const CCIP_REGISTRY_MODULE_OWNER_BASE = '0x1A5f2d0c090dDB7ee437051DA5e6f03b6bAE1A77';
const CCIP_OFF_RAMP_BASE = '0x7D38c6363d5E4DFD500a691Bc34878b383F58d93';

const ARB_CHAIN_SELECTOR = BigNumber.from('4949039107694359620');
const BASE_CHAIN_SELECTOR = BigNumber.from('15971525489660198786');

const DOLO_BASE_ADDRESS = '0x38628490c3043E5D0bbB26d5a0a62fC77342e9d5';
const DOLO_L2_POOL_ADDRESS = '0x05bB67cB592C1753425192bF8f34b95ca8649f09';

describe('DOLO_CCIP', () => {
  let core: CoreProtocolArbitrumOne | CoreProtocolBase;
  let dolo: DOLO;
  let doloBase: DOLO;

  let doloL1TokenPool: LockReleaseTokenPool;
  let doloL2TokenPool: BurnMintTokenPool;

  let onRamp: ICCIPOnRamp;
  let offRamp: ICCIPOffRamp;

  let ccipRouter: ICCIPRouter;
  let tokenAdminRegistry: ITokenAdminRegistry;
  let registryModuleOwnerCustom: IRegistryModuleOwnerCustom;

  let ccipRouterBase: ICCIPRouter;
  let tokenAdminRegistryBase: ITokenAdminRegistry;
  let registryModuleOwnerCustomBase: IRegistryModuleOwnerCustom;

  let snapshotId: string;

  before(async () => {
    core = await setupCoreProtocol({
      blockNumber: 295_821_500,
      network: Network.ArbitrumOne
    });
    dolo = await createDOLO(core, core.hhUser5.address);

    doloL1TokenPool = await createContractWithAbi<LockReleaseTokenPool>(
      LockReleaseTokenPool__factory.abi,
      LockReleaseTokenPool__factory.bytecode,
      [dolo.address, 18, [], CCIP_RMN, false as any, CCIP_ROUTER],
    );
    await doloL1TokenPool.connect(core.hhUser1).transferOwnership(core.governance.address);
    await doloL1TokenPool.connect(core.governance).acceptOwnership();

    tokenAdminRegistry = ITokenAdminRegistry__factory.connect(CCIP_TOKEN_ADMIN_REGISTRY, core.hhUser1);
    registryModuleOwnerCustom = IRegistryModuleOwnerCustom__factory.connect(CCIP_REGISTRY_MODULE_OWNER, core.hhUser1);
    ccipRouter = ICCIPRouter__factory.connect(CCIP_ROUTER, core.hhUser1);
    onRamp = ICCIPOnRamp__factory.connect(CCIP_ARB_TO_BASE_ON_RAMP, core.hhUser1);

    await dolo.connect(core.hhUser5).transfer(core.hhUser1.address, ONE_ETH_BI);

    snapshotId = await snapshot();
  });

  beforeEach(async () => {
    snapshotId = await revertToSnapshotAndCapture(snapshotId);
  });

  describe('#CCIP', () => {
    it('should work normally', async () => {
      // Set up CCIP on ARB
      await registryModuleOwnerCustom.connect(core.governance).registerAdminViaOwner(dolo.address);
      await tokenAdminRegistry.connect(core.governance).acceptAdminRole(dolo.address);
      await tokenAdminRegistry.connect(core.governance).setPool(dolo.address, doloL1TokenPool.address);
      await doloL1TokenPool.connect(core.governance).applyChainUpdates(
        [],
        [{
          remoteChainSelector: BigNumber.from(BASE_CHAIN_SELECTOR),
          remotePoolAddresses: [defaultAbiCoder.encode(['address'], ['0x05bB67cB592C1753425192bF8f34b95ca8649f09'])],
          remoteTokenAddress: defaultAbiCoder.encode(['address'], ['0x38628490c3043E5D0bbB26d5a0a62fC77342e9d5']),
          outboundRateLimiterConfig: EMPTY_RATE_LIMITER_CONFIG,
          inboundRateLimiterConfig: EMPTY_RATE_LIMITER_CONFIG,
        }]
      );

      // Call ccipSend and get event
      await dolo.connect(core.hhUser1).approve(CCIP_ROUTER, ONE_ETH_BI);
      const result = await getFeeAndSendTokens(ccipRouter, BASE_CHAIN_SELECTOR, core.hhUser1, dolo, ONE_ETH_BI);

      expect(await dolo.balanceOf(core.hhUser1.address)).to.equal(ZERO_BI);
      expect(await dolo.balanceOf(doloL1TokenPool.address)).to.equal(ONE_ETH_BI);

      const filter = onRamp.filters.CCIPSendRequested();
      const eventArgs = (await onRamp.queryFilter(filter, result.blockHash))[0].args;

      // Switch to Base and set up CCIP
      core = await setupCoreProtocol({
        blockNumber: 25_124_500,
        network: Network.Base
      });

      doloBase = await createDOLO(core, core.hhUser5.address);
      doloL2TokenPool = await createContractWithAbi<BurnMintTokenPool>(
        BurnMintTokenPool__factory.abi,
        BurnMintTokenPool__factory.bytecode,
        [doloBase.address, 18, [], CCIP_RMN_BASE, CCIP_ROUTER_BASE],
      );
      await doloL2TokenPool.connect(core.hhUser1).transferOwnership(core.governance.address);
      await doloL2TokenPool.connect(core.governance).acceptOwnership();
      await doloBase.connect(core.governance).ownerSetMinter(doloL2TokenPool.address, true);
      expect(doloBase.address).to.equal(DOLO_BASE_ADDRESS, 'Dolo base address is not correct. Update the const');
      expect(doloL2TokenPool.address).to.equal(DOLO_L2_POOL_ADDRESS, 'Dolo L2 pool address is not correct. Update the const');

      tokenAdminRegistryBase = ITokenAdminRegistry__factory.connect(CCIP_TOKEN_ADMIN_REGISTRY_BASE, core.hhUser1);
      registryModuleOwnerCustomBase = IRegistryModuleOwnerCustom__factory.connect(
        CCIP_REGISTRY_MODULE_OWNER_BASE,
        core.hhUser1
      );
      ccipRouterBase = ICCIPRouter__factory.connect(CCIP_ROUTER_BASE, core.hhUser1);
      offRamp = ICCIPOffRamp__factory.connect(CCIP_OFF_RAMP_BASE, core.hhUser1);

      await registryModuleOwnerCustomBase.connect(core.governance).registerAdminViaOwner(doloBase.address);
      await tokenAdminRegistryBase.connect(core.governance).acceptAdminRole(doloBase.address);
      await tokenAdminRegistryBase.connect(core.governance).setPool(doloBase.address, doloL2TokenPool.address);
      await doloL2TokenPool.connect(core.governance).applyChainUpdates(
        [],
        [{
          remoteChainSelector: BigNumber.from(ARB_CHAIN_SELECTOR),
          remotePoolAddresses: [defaultAbiCoder.encode(['address'], [doloL1TokenPool.address])],
          remoteTokenAddress: defaultAbiCoder.encode(['address'], [dolo.address]),
          outboundRateLimiterConfig: EMPTY_RATE_LIMITER_CONFIG,
          inboundRateLimiterConfig: EMPTY_RATE_LIMITER_CONFIG,
        }]
      );

      // impersonate offRamp and execute single message
      const message = eventArgs.message;
      const offRampImpersonator = await impersonate(CCIP_OFF_RAMP_BASE, true);
      await offRamp.connect(offRampImpersonator).executeSingleMessage(
        message,
        [BYTES_EMPTY],
        [message.gasLimit]
      );
      expect(await doloBase.balanceOf(core.hhUser1.address)).to.equal(ONE_ETH_BI);

      // Call ccipSend to send DOLO back to ARB
      await doloBase.connect(core.hhUser1).approve(ccipRouterBase.address, ONE_ETH_BI);
      await getFeeAndSendTokens(ccipRouterBase, ARB_CHAIN_SELECTOR, core.hhUser1, doloBase, ONE_ETH_BI);
      expect(await doloBase.balanceOf(core.hhUser1.address)).to.equal(ZERO_BI);
      expect(await doloBase.balanceOf(doloL2TokenPool.address)).to.equal(ZERO_BI);
    });
  });
});

async function getFeeAndSendTokens(
  ccipRouter: ICCIPRouter,
  destinationChainSelector: BigNumber,
  sender: SignerWithAddressWithSafety,
  token: IERC20,
  amount: BigNumber
): Promise<ContractTransaction> {
  const functionSelector = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('CCIP EVMExtraArgsV2')).slice(0, 10);
  // Set gas limit to 0 as we are only transferring tokens and not calling a contract on the destination chain
  const gasLimit = 0;
  // Allow out of order execution - message can be executed in any order relative to other messages from same sender
  const allowOutOfOrderExecution = true;
  const extraArgs = defaultAbiCoder.encode(
    ['uint256', 'bool'],
    [gasLimit, allowOutOfOrderExecution]
  );
  const encodedExtraArgs = functionSelector + extraArgs.slice(2);

  const fee = await ccipRouter.connect(sender).getFee(
    destinationChainSelector,
    {
      receiver: defaultAbiCoder.encode(['address'], [sender.address]),
      data: '0x',
      tokenAmounts: [{ amount, token: token.address }],
      feeToken: ADDRESS_ZERO,
      extraArgs: '0x'
    }
  );

  return await ccipRouter.connect(sender).ccipSend(
    destinationChainSelector,
    {
      receiver: defaultAbiCoder.encode(['address'], [sender.address]),
      data: '0x',
      tokenAmounts: [{ amount, token: token.address }],
      feeToken: ADDRESS_ZERO,
      extraArgs: encodedExtraArgs
    },
    { value: fee }
  );
}
