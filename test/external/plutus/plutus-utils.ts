import { address } from '@dolomite-exchange/dolomite-margin';
import {
  IPlutusVaultGLPFarm,
  IPlutusVaultGLPRouter,
  PlutusVaultGLPUnwrapperTrader,
  PlutusVaultGLPWrapperTrader,
} from '../../../src/types';
import { impersonate } from '../../utils';
import { CoreProtocol } from '../../utils/setup';
import { createDolomiteCompatibleWhitelistForPlutusDAO } from '../../utils/wrapped-token-utils';

export async function createAndSetPlutusVaultWhitelist(
  core: CoreProtocol,
  routerOrFarm: IPlutusVaultGLPRouter | IPlutusVaultGLPFarm,
  unwrapperTrader: PlutusVaultGLPUnwrapperTrader,
  wrapperTrader: PlutusVaultGLPWrapperTrader,
  dplvGlpToken: { address: address },
) {
  const plutusWhitelist = await routerOrFarm.connect(core.hhUser1).whitelist();
  const dolomiteWhitelist = await createDolomiteCompatibleWhitelistForPlutusDAO(
    core,
    unwrapperTrader,
    wrapperTrader,
    plutusWhitelist,
    dplvGlpToken,
  );

  const owner = await impersonate(await routerOrFarm.owner(), true);
  await routerOrFarm.connect(owner).setWhitelist(dolomiteWhitelist.address);
}
