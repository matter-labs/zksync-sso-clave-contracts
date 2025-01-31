import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers, HDNodeWallet } from "ethers";
import { Address, encodeAbiParameters, Hex, parseEther } from "viem";
import { Provider, SmartAccount, utils, Wallet } from "zksync-ethers";

import { AAFactory, GuardianRecoveryValidator, GuardianRecoveryValidator__factory, SsoAccount, SsoAccount__factory, WebAuthValidator } from "../typechain-types";
import { encodeKeyFromBytes, generateES256R1Key, getRawPublicKeyFromCrpyto } from "./PasskeyModule";
import { cacheBeforeEach, ContractFixtures, getProvider } from "./utils";

describe("GuardianRecoveryValidator", function () {
  const fixtures = new ContractFixtures();
  const abiCoder = new ethers.AbiCoder();
  const provider = getProvider();
  let guardiansValidatorAddr: Address;
  let factory: AAFactory;
  let ssoAccountInstance: SsoAccount;
  let newGuardianConnectedSsoAccount: SmartAccount;
  let ownerConnectedSsoAccount: SmartAccount;
  let guardianWallet: Wallet;
  let ownerWallet: Wallet;
  let externalUserWallet: Wallet;
  let webauthn: WebAuthValidator;
  let guardianValidator: GuardianRecoveryValidator;

  cacheBeforeEach(async () => {
    guardianWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    ownerWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    externalUserWallet = new Wallet(Wallet.createRandom().privateKey, provider);

    const generatedKey = await generatePassKey();

    guardianValidator = await fixtures.getGuardianRecoveryValidator();
    webauthn = await fixtures.getWebAuthnVerifierContract();
    guardiansValidatorAddr = await guardianValidator.getAddress() as Address;
    factory = await fixtures.getAaFactory();
    const randomSalt = randomBytes(32);
    const accountId = "recovery-key-test-id" + randomBytes(32).toString();
    const initialValidators = [
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [await webauthn.getAddress(), generatedKey]),
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [await guardianValidator.getAddress(), ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]"],
        [[]],
      )]),
    ];
    ssoAccountInstance = SsoAccount__factory.connect(await factory.deployProxySsoAccount.staticCall(
      randomSalt,
      accountId,
      initialValidators,
      [ownerWallet],
    ), fixtures.wallet);
    await factory.deployProxySsoAccount(
      randomSalt,
      accountId,
      initialValidators,
      [ownerWallet],
    );
    const ssoAccountInstanceAddress = await ssoAccountInstance.getAddress();
    await (await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: ssoAccountInstanceAddress })).wait(); ;
    await (await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: guardianWallet.address })).wait();
    newGuardianConnectedSsoAccount = new SmartAccount({
      payloadSigner: async (hash) => {
        const data = abiCoder.encode(
          ["bytes", "address", "bytes"],
          [
            guardianWallet.signingKey.sign(hash).serialized,
            guardiansValidatorAddr,
            abiCoder.encode(
              ["uint256"],
              [123],
            ),
          ],
        );
        return data;
      },
      address: await ssoAccountInstance.getAddress(),
      secret: guardianWallet.privateKey,
    }, provider);
    ownerConnectedSsoAccount = new SmartAccount({
      address: await ssoAccountInstance.getAddress(),
      secret: ownerWallet.privateKey,
    }, provider);
  });

  async function randomWallet(): Promise<[HDNodeWallet, GuardianRecoveryValidator]> {
    const wallet = Wallet.createRandom(getProvider());
    const connected = GuardianRecoveryValidator__factory.connect(guardiansValidatorAddr, wallet);
    await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: wallet.address });

    return [wallet, connected];
  }

  function callAddValidationKey(contract: GuardianRecoveryValidator, account: string): Promise<ethers.ContractTransactionResponse> {
    const encoded = encodeAbiParameters(
      [{ type: "address" }],
      [account as Hex],
    );
    return contract.addValidationKey(encoded);
  }

  it("can propose a guardian", async function () {
    const [user1, connectedUser1] = await randomWallet();
    const [guardian] = await randomWallet();

    const tx = await connectedUser1.proposeValidationKey(guardian.address);
    await tx.wait();

    const res = await connectedUser1.getFunction("guardiansFor").staticCall(user1.address);
    expect(res.length).to.equal(1);
    expect(res[0][0]).to.equal(guardian.address);
    expect(res[0][1]).to.equal(false);
  });

  it("fails when tries to confirm a guardian that was not proposed.", async function () {
    const [user1] = await randomWallet();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, guardianConnection] = await randomWallet();

    await expect(callAddValidationKey(guardianConnection, user1.address))
      .to.revertedWithCustomError(guardianConnection, "GuardianNotProposed");
  });

  it("fails when tries to confirm a was proposed for a different account.", async function () {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, user1Connection] = await randomWallet();
    const [user2] = await randomWallet();
    const [guardian, guardianConnection] = await randomWallet();

    const tx1 = await user1Connection.proposeValidationKey(guardian.address);
    await tx1.wait();

    await expect(callAddValidationKey(guardianConnection, user2.address))
      .to.revertedWithCustomError(guardianConnection, "GuardianNotProposed");
  });

  it("works to confirm a proposed account.", async function () {
    const [user1, user1Connected] = await randomWallet();
    const [guardian, guardianConnected] = await randomWallet();

    const tx = await user1Connected.proposeValidationKey(guardian.address);
    await tx.wait();

    await callAddValidationKey(guardianConnected, user1.address);

    const res = await user1Connected.getFunction("guardiansFor").staticCall(user1.address);
    expect(res.length).to.equal(1);
    expect(res[0][0]).to.equal(guardian.address);
    expect(res[0][1]).to.equal(true);
  });

  describe("When attached to SsoAccount", () => {
    describe("When initiating new guardian addition operation", () => {
      it("it adds guardian as non ready one.", async function () {
        const [newGuardianWallet] = await randomWallet();
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeValidationKey",
          [newGuardianWallet.address],
        );
        const txToSign = {
          ...(await aaTxTemplate(await ssoAccountInstance.getAddress(), provider)),
          type: 1,
          to: guardiansValidatorAddr,
          data: functionData,
        };
        txToSign.gasLimit = await provider.estimateGas(txToSign);
        const txData = await ownerConnectedSsoAccount.signTransaction(txToSign);
        const tx = await provider.broadcastTransaction(txData);
        await tx.wait();

        const [newGuardian] = (await guardianValidator.guardiansFor(newGuardianConnectedSsoAccount.address)).slice(-1);
        expect(newGuardian.addr).to.eq(newGuardianWallet.address);
        expect(newGuardian.isReady).to.eq(false);
      });
    });
    describe("When approving existing guardian addition operation", () => {
      cacheBeforeEach(async () => {
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeValidationKey",
          [guardianWallet.address],
        );
        const txToSign = {
          ...(await aaTxTemplate(await ssoAccountInstance.getAddress(), provider)),
          to: guardiansValidatorAddr,
          data: functionData,
        };
        txToSign.gasLimit = await provider.estimateGas(txToSign);
        const txData = await ownerConnectedSsoAccount.signTransaction(txToSign);
        const tx = await provider.broadcastTransaction(txData);
        await tx.wait();
      });
      const sut = async () => {
        return guardianValidator.connect(guardianWallet)
          .addValidationKey(abiCoder.encode(["address"], [newGuardianConnectedSsoAccount.address]));
      };
      it("it makes guardian active one.", async function () {
        await sut();

        const [newGuardian] = (await guardianValidator.guardiansFor(newGuardianConnectedSsoAccount.address)).slice(-1);
        expect(newGuardian.addr).to.eq(guardianWallet.address);
        expect(newGuardian.isReady).to.eq(true);
      });
    });
    describe("When having active guardian", () => {
      cacheBeforeEach(async () => {
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeValidationKey",
          [guardianWallet.address],
        );
        const txToSign = {
          ...(await aaTxTemplate(await ssoAccountInstance.getAddress(), provider)),
          to: guardiansValidatorAddr,
          data: functionData,
        };
        txToSign.gasLimit = await provider.estimateGas(txToSign);
        const txData = await ownerConnectedSsoAccount.signTransaction(txToSign);
        const tx = await provider.broadcastTransaction(txData);
        await tx.wait();
        await guardianValidator.connect(guardianWallet).addValidationKey(abiCoder.encode(["address"], [newGuardianConnectedSsoAccount.address]));
      });

      describe("And initiating recovery process", () => {
        let newKey: string;
        let refTimestamp: number;

        cacheBeforeEach(async () => {
          newKey = await generatePassKey();
          refTimestamp = (await provider.getBlock("latest")).timestamp;
        });
        const sut = async (signer: ethers.Signer = guardianWallet) => {
          const tx = await guardianValidator.connect(signer).initRecovery(
            ssoAccountInstance.getAddress(), newKey,
          );
          return tx;
        };
        it("it creates new recovery process.", async function () {
          await sut();

          const request = (await guardianValidator.pendingRecoveryData(
            newGuardianConnectedSsoAccount.address,
          ));
          expect(request.passkey).to.eq(newKey);
          expect(Math.abs(Number(request.timestamp) - refTimestamp)).to.lt(10);
        });
        it("it prohibits non guardian from starting recovery process", async function () {
          await expect(sut(externalUserWallet)).to.be.reverted;
        });
      });
      describe("And has active recovery process and trying to execute", () => {
        let newKey: string;

        cacheBeforeEach(async () => {
          newKey = await generatePassKey();

          await guardianValidator.connect(guardianWallet)
            .initRecovery(newGuardianConnectedSsoAccount.address, newKey);
        });
        const sut = async (keyToAdd: string, ssoAccount: SmartAccount = newGuardianConnectedSsoAccount) => {
          const functionData = webauthn.interface.encodeFunctionData(
            "addValidationKey",
            [keyToAdd],
          );
          const txToSign = {
            ...(await aaTxTemplate(await ssoAccountInstance.getAddress(), provider)),
            to: await webauthn.getAddress(),
            data: functionData,
          };
          txToSign.gasLimit = await provider.estimateGas(txToSign);
          return await ssoAccount.sendTransaction(txToSign);
        };
        describe("but not enough time has passed", () => {
          it("it should not accept transaction.", async function () {
            await helpers.time.increase(12 * 60 * 60);
            await expect(sut(newKey)).to.be.reverted;
          });
        });
        describe("but passing wrong new key", () => {
          it("it should revert.", async function () {
            const wrongKey = await generatePassKey();
            await helpers.time.increase(1 * 24 * 60 * 60 + 60);
            await expect(sut(wrongKey)).to.be.reverted;
          });
        });
        describe("and passing correct new key", () => {
          it("it should clean up pending request.", async function () {
            await helpers.time.increase(2 * 24 * 60 * 60);
            await sut(newKey);

            const request = (await guardianValidator.pendingRecoveryData(
              newGuardianConnectedSsoAccount.address,
            ));
            expect(request.passkey).to.eq("0x");
            expect(request.timestamp).to.eq(0);
          });
        });
      });
    });
  });
});

async function generatePassKey() {
  const keyDomain = randomBytes(32).toString("hex");
  const generatedR1Key = await generateES256R1Key();
  const [generatedX, generatedY] = await getRawPublicKeyFromCrpyto(generatedR1Key);
  const generatedKey = encodeKeyFromBytes([generatedX, generatedY], keyDomain);
  return generatedKey;
}

async function aaTxTemplate(proxyAccountAddress: string, provider: Provider) {
  return {
    type: 113,
    from: proxyAccountAddress,
    data: "0x",
    value: 0,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(proxyAccountAddress),
    gasPrice: await provider.getGasPrice(),
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      customSignature: undefined,
    },
    gasLimit: 0n,
  };
}
