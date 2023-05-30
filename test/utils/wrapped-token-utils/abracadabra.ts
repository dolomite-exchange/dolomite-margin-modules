import {
  MagicGLPPriceOracle,
  MagicGLPPriceOracle__factory,
  MagicGLPUnwrapperTrader,
  MagicGLPUnwrapperTrader__factory,
  MagicGLPWrapperTrader,
  MagicGLPWrapperTrader__factory,
} from '../../../src/types';
import {
  getMagicGLPPriceOracleConstructorParams,
  getMagicGLPUnwrapperTraderConstructorParams,
  getMagicGLPWrapperTraderConstructorParams,
} from '../../../src/utils/constructors/abracadabra';
import { createContractWithAbi } from '../../../src/utils/dolomite-utils';
import { CoreProtocol } from '../setup';

export async function createMagicGLPPriceOracle(core: CoreProtocol): Promise<MagicGLPPriceOracle> {
  return createContractWithAbi(
    MagicGLPPriceOracle__factory.abi,
    MagicGLPPriceOracle__factory.bytecode,
    getMagicGLPPriceOracleConstructorParams(core),
  );
}

export async function createMagicGLPUnwrapperTrader(core: CoreProtocol): Promise<MagicGLPUnwrapperTrader> {
  return createContractWithAbi(
    MagicGLPUnwrapperTrader__factory.abi,
    MagicGLPUnwrapperTrader__factory.bytecode,
    getMagicGLPUnwrapperTraderConstructorParams(core),
  );
}

export async function createMagicGLPWrapperTrader(core: CoreProtocol): Promise<MagicGLPWrapperTrader> {
  return createContractWithAbi(
    MagicGLPWrapperTrader__factory.abi,
    MagicGLPWrapperTrader__factory.bytecode,
    getMagicGLPWrapperTraderConstructorParams(core),
  );
}
