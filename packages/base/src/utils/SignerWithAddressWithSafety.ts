import { ethers } from 'ethers';
import hardhat from 'hardhat';

export class SignerWithAddressWithSafety extends ethers.Signer {
  public constructor(
    private readonly _address: string,
    private readonly _signer: ethers.providers.JsonRpcSigner,
  ) {
    super();
    (this as any).provider = _signer.provider;
  }

  public get address(): string {
    if (hardhat.network.name !== 'hardhat') {
      throw new Error('Cannot get address for signer when not on Hardhat network!');
    }
    return this._address;
  }

  public get addressLower(): string {
    return this.address.toLowerCase();
  }

  public static async create(signerAddress: string) {
    return new SignerWithAddressWithSafety(
      signerAddress,
      ((await hardhat.ethers.getSigner(signerAddress)) as any)._signer,
    );
  }

  public async getAddress(): Promise<string> {
    return this._address;
  }

  public signMessage(message: string | ethers.utils.Bytes): Promise<string> {
    return this._signer.signMessage(message);
  }

  public signTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<string> {
    return this._signer.signTransaction(transaction);
  }

  public sendTransaction(
    transaction: ethers.utils.Deferrable<ethers.providers.TransactionRequest>,
  ): Promise<ethers.providers.TransactionResponse> {
    return this._signer.sendTransaction(transaction);
  }

  public connect(provider: ethers.providers.Provider): SignerWithAddressWithSafety {
    return new SignerWithAddressWithSafety(this._address, this._signer.connect(provider));
  }

  // tslint:disable-next-line
  public _signTypedData(
    ...params: Parameters<ethers.providers.JsonRpcSigner['_signTypedData']>
  ): Promise<string> {
    return this._signer._signTypedData(...params);
  }

  public toJSON() {
    return `<SignerWithAddress ${this._address}>`;
  }
}
