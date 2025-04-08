import * as helpers from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { randomBytes } from "crypto";
import { ethers, HDNodeWallet, keccak256 } from "ethers";
import { Address, parseEther, toHex } from "viem";
import { Provider, SmartAccount, utils, Wallet } from "zksync-ethers";

import { GuardianRecoveryValidator, GuardianRecoveryValidator__factory, SsoAccount, SsoAccount__factory, WebAuthValidator } from "../typechain-types";
import { encodeKeyFromBytes, generateES256R1Key, getRawPublicKeyFromCrpyto } from "./PasskeyModule";
import { cacheBeforeEach, ContractFixtures, getProvider } from "./utils";

describe("GuardianRecoveryValidator", function () {
  const fixtures = new ContractFixtures();
  const abiCoder = new ethers.AbiCoder();
  const provider = getProvider();
  const keyDomain = "origin-domain";
  let guardiansValidatorAddr: Address;
  let ssoAccountInstance: SsoAccount;
  let newGuardianConnectedSsoAccount: SmartAccount;
  let ownerConnectedSsoAccount: SmartAccount;
  let guardianWallet: Wallet;
  let ownerWallet: Wallet;
  let externalUserWallet: Wallet;
  let webauthn: WebAuthValidator;
  let guardianValidator: GuardianRecoveryValidator;
  let hashedOriginDomain: `0x${string}`;

  cacheBeforeEach(async () => {
    guardianWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    ownerWallet = new Wallet(Wallet.createRandom().privateKey, provider);
    externalUserWallet = new Wallet(Wallet.createRandom().privateKey, provider);

    const accountId = `0x${Buffer.from(ethers.toUtf8Bytes("recovery-key-test-id" + randomBytes(32).toString())).toString("hex")}` as `0x${string}`;
    const generatedKey = await generatePassKey(accountId, keyDomain);
    hashedOriginDomain = generatedKey.hashedOriginDomain;

    guardianValidator = (await fixtures.getGuardianRecoveryValidator()).connect(ownerWallet);
    webauthn = (await fixtures.getWebAuthnVerifierContract());
    guardiansValidatorAddr = await guardianValidator.getAddress() as Address;
    const initialValidators = [
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [await webauthn.getAddress(), generatedKey.generatedKey]),
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes"], [await guardianValidator.getAddress(), ethers.AbiCoder.defaultAbiCoder().encode(
        ["address[]"],
        [[]],
      )]),
    ];

    ssoAccountInstance = await deploySsoAccountWithValidators(initialValidators);
    await (await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: guardianWallet.address })).wait();
    newGuardianConnectedSsoAccount = new SmartAccount({
      payloadSigner: async (hash) => {
        const data = abiCoder.encode(
          ["bytes", "address", "bytes"],
          [
            guardianWallet.signingKey.sign(hash).serialized,
            guardiansValidatorAddr,
            abiCoder.encode(
              [],
              [],
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

  const randomWallet = async (): Promise<[HDNodeWallet, GuardianRecoveryValidator]> => {
    const wallet = Wallet.createRandom(getProvider());
    const connected = GuardianRecoveryValidator__factory.connect(guardiansValidatorAddr, wallet);
    await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: wallet.address });

    return [wallet, connected];
  };

  describe("proposeGuardian", () => {
    it("can propose a guardian", async function () {
      const [user1, user1ConnectedValidator] = await randomWallet();
      const [guardian] = await randomWallet();

      const tx = await user1ConnectedValidator.proposeGuardian(hashedOriginDomain, guardian.address);
      await tx.wait();

      const res = await user1ConnectedValidator.guardiansFor(hashedOriginDomain, user1.address);
      expect(res.length).to.equal(1);
      expect(res[0].addr).to.equal(guardian.address);
      expect(res[0].isReady).to.equal(false);
      expect(tx).to.emit(user1ConnectedValidator, "GuardianProposed");
    });

    it("Reverts if attempts to add zero address", async function () {
      const [user1, user1ConnectedValidator] = await randomWallet();

      await expect(user1ConnectedValidator.proposeGuardian(hashedOriginDomain, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(user1ConnectedValidator, "InvalidGuardianAddress");
    });
  });

  describe("addGuardian", () => {
    function callAddGuardian(contract: GuardianRecoveryValidator, hashedOriginDomain: `0x${string}`, account: string): Promise<ethers.ContractTransactionResponse> {
      return contract.addGuardian(hashedOriginDomain, account);
    }

    it("fails when tries to confirm a guardian that was not proposed.", async function () {
      const [user1] = await randomWallet();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, guardianConnection] = await randomWallet();

      await expect(callAddGuardian(guardianConnection, hashedOriginDomain, user1.address))
        .to.reverted;
    });

    it("fails when tries to confirm a guardian for zero address.", async function () {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, guardianConnection] = await randomWallet();

      await expect(callAddGuardian(guardianConnection, hashedOriginDomain, ethers.ZeroAddress))
        .to.revertedWithCustomError(guardianConnection, "InvalidAccountToGuardAddress");
    });

    it("fails when tries to confirm a was proposed for a different account.", async function () {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, user1Connection] = await randomWallet();
      const [user2] = await randomWallet();
      const [guardian, guardianConnection] = await randomWallet();

      const tx1 = await user1Connection.proposeGuardian(hashedOriginDomain, guardian.address);
      await tx1.wait();

      await expect(callAddGuardian(guardianConnection, hashedOriginDomain, user2.address))
        .to.reverted;
    });

    it("works to confirm a proposed account.", async function () {
      const [user1, user1Connected] = await randomWallet();
      const [guardian, guardianConnected] = await randomWallet();

      await user1Connected.proposeGuardian(hashedOriginDomain, guardian.address);

      const tx = await callAddGuardian(guardianConnected, hashedOriginDomain, user1.address);

      const res = await user1Connected.guardiansFor(hashedOriginDomain, user1.address);
      expect(res.length).to.equal(1);
      expect(res[0].addr).to.equal(guardian.address);
      expect(res[0].isReady).to.equal(true);
      expect(tx).to.emit(user1Connected, "GuardianAdded");
    });
  });

  describe("removeGuardian", () => {
    let guardian: ethers.Signer;
    let user1: ethers.Signer;

    cacheBeforeEach(async () => {
      const [guardianWallet, guardianConnected] = await randomWallet();
      guardian = guardianWallet;
      const [user1Wallet, user1Connected] = await randomWallet();
      user1 = user1Wallet;
      await user1Connected.proposeGuardian(hashedOriginDomain, guardian.getAddress());
      await guardianConnected.addGuardian(hashedOriginDomain, user1.getAddress());
    });

    const sut = async (guardianToRemove: string) => {
      return guardianValidator.connect(user1).removeGuardian(hashedOriginDomain, guardianToRemove);
    };

    it("fails when tries to remove non existing guardian.", async function () {
      const [randomGeneratedWallet] = await randomWallet();

      await expect(sut(await randomGeneratedWallet.getAddress()))
        .to.be.revertedWithCustomError(guardianValidator, "GuardianNotFound");
    });

    it("fails when tries to remove zero address guardian.", async function () {
      const [randomGeneratedWallet] = await randomWallet();

      await expect(sut(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(guardianValidator, "InvalidGuardianAddress");
    });

    it("works to remove existing guardian.", async function () {
      const tx = await sut(await guardian.getAddress());

      expect(tx).to.emit(guardianValidator, "GuardianRemoved");
      const guardians = await guardianValidator.guardiansFor(hashedOriginDomain, user1.getAddress());
      expect(guardians.length).to.equal(0);
      const guardedAccounts = await guardianValidator.guardianOf(hashedOriginDomain, guardian.getAddress());
      expect(guardedAccounts.length).to.equal(0);
    });
  });

  describe("onInstall", () => {
    describe("When WebAuthValidator is not enabled for caller account", () => {
      let ssoAccountInstance: SsoAccount;
      let ssoAccount: SmartAccount;
      cacheBeforeEach(async () => {
        ssoAccountInstance = await deploySsoAccountWithValidators([]);
        ssoAccount = new SmartAccount({
          address: await ssoAccountInstance.getAddress(),
          secret: ownerWallet.privateKey,
        }, provider);
      });

      const sut = async () => {
        const txToSign = {
          ...(await aaTxTemplate(await ssoAccountInstance.getAddress(), provider)),
          type: 1,
          to: guardiansValidatorAddr,
          data: guardianValidator.interface.encodeFunctionData("onInstall", ["0x"]),
        };
        txToSign.gasLimit = await provider.estimateGas(txToSign);
        const txData = await ssoAccount.signTransaction(txToSign);
        const tx = await provider.broadcastTransaction(txData);
        return tx.wait();
      };

      it("Reverts with WebAuthValidatorNotEnabled error", async function () {
        await expect(sut()).to.be.revertedWithCustomError(guardianValidator, "WebAuthValidatorNotEnabled");
      });
    });
  });

  describe("onUninstall", () => {
    let user1: ethers.Signer;
    let guardian: ethers.Signer;
    let guardian2: ethers.Signer;
    cacheBeforeEach(async () => {
      const [guardianWallet, guardianConnected] = await randomWallet();
      const [guardian2Wallet, guardian2Connected] = await randomWallet();
      guardian = guardianWallet;
      guardian2 = guardian2Wallet;
      const [user1Wallet, user1Connected] = await randomWallet();
      user1 = user1Wallet;
      await user1Connected.proposeGuardian(hashedOriginDomain, guardian.getAddress());
      await user1Connected.proposeGuardian(hashedOriginDomain, guardian2.getAddress());
      await guardianConnected.addGuardian(hashedOriginDomain, user1.getAddress());
      await guardian2Connected.addGuardian(hashedOriginDomain, user1.getAddress());
    });

    const sut = async () => {
      return guardianValidator.connect(user1).onUninstall(ethers.AbiCoder.defaultAbiCoder().encode(["bytes32[]"], [[hashedOriginDomain]]));
    };

    it("Removes existing guardians.", async function () {
      const tx = await sut();

      const res = await guardianValidator.guardiansFor(hashedOriginDomain, user1.getAddress());
      expect(res.length).to.equal(0);
      expect(tx).to.emit(guardianValidator, "GuardianRemoved");

      const guardian1GuardedAccounts = await guardianValidator.guardianOf(hashedOriginDomain, user1.getAddress());
      expect(guardian1GuardedAccounts.length).to.equal(0);
      const guardian2GuardedAccounts = await guardianValidator.guardianOf(hashedOriginDomain, user1.getAddress());
      expect(guardian2GuardedAccounts.length).to.equal(0);
    });

    describe("And there is a pending recovery", () => {
      cacheBeforeEach(async () => {
        const key = await generatePassKey("0x1234", keyDomain);
        await helpers.time.increase(3 * 24 * 60 * 60 + 1 * 60 * 60); // Increase by > 72 hours
        await guardianValidator.connect(guardian).initRecovery(
          user1.getAddress(), ethers.keccak256(key.args[0]), key.args[1], hashedOriginDomain,
        );
      });
      it("Removes pending recovery data.", async function () {
        await sut();
        const res = await guardianValidator.getPendingRecoveryData(hashedOriginDomain, user1.getAddress());

        expect(res.hashedCredentialId).to.equal(ethers.zeroPadBytes("0x", 32));
        expect(res.rawPublicKey[0]).to.equal(ethers.zeroPadBytes("0x", 32));
        expect(res.rawPublicKey[1]).to.equal(ethers.zeroPadBytes("0x", 32));
        expect(res.timestamp).to.equal(0);
      });
    });
  });

  describe("validateTransaction", () => {
    const sut = async (data: ethers.BytesLike) => {
      return guardianValidator.validateTransaction(ethers.zeroPadBytes("0x", 32), {
        data,
        to: ethers.ZeroAddress,
        value: 0n,
        txType: 113n,
        from: ethers.ZeroAddress,
        reserved: [0n, 0n, 0n, 0n],
        reservedDynamic: "0x",
        signature: "0x",
        gasLimit: 8_000_0000n,
        gasPerPubdataByteLimit: 50000n,
        maxFeePerGas: 0n,
        maxPriorityFeePerGas: 0n,
        paymaster: 0n,
        nonce: 0n,
        factoryDeps: [],
        paymasterInput: "0x",
      });
    };

    it("Should revert when passed non function call data.", async function () {
      await expect(sut("0x1234")).to.be.revertedWithCustomError(guardianValidator, "NonFunctionCallTransaction");
    });
  });

  describe("When attached to SsoAccount", () => {
    describe("When initiating new guardian addition operation", () => {
      it("it adds guardian as non ready one.", async function () {
        const [newGuardianWallet] = await randomWallet();
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeGuardian",
          [hashedOriginDomain, newGuardianWallet.address],
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

        const [newGuardian] = (await guardianValidator.guardiansFor(hashedOriginDomain, newGuardianConnectedSsoAccount.address)).slice(-1);
        expect(newGuardian.addr).to.eq(newGuardianWallet.address);
        expect(newGuardian.isReady).to.eq(false);
      });
    });
    describe("When approving existing guardian addition operation", () => {
      cacheBeforeEach(async () => {
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeGuardian",
          [hashedOriginDomain, guardianWallet.address],
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
          .addGuardian(hashedOriginDomain, newGuardianConnectedSsoAccount.address);
      };
      it("it makes guardian active one.", async function () {
        await sut();

        const [newGuardian] = (await guardianValidator.guardiansFor(hashedOriginDomain, newGuardianConnectedSsoAccount.address)).slice(-1);
        expect(newGuardian.addr).to.eq(guardianWallet.address);
        expect(newGuardian.isReady).to.eq(true);
      });
    });
    describe("When having active guardian", () => {
      cacheBeforeEach(async () => {
        const functionData = guardianValidator.interface.encodeFunctionData(
          "proposeGuardian",
          [hashedOriginDomain, guardianWallet.address],
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
        await guardianValidator.connect(guardianWallet).addGuardian(hashedOriginDomain, newGuardianConnectedSsoAccount.address);
      });

      describe("And initiating recovery process", () => {
        let newKey: Awaited<ReturnType<typeof generatePassKey>>;
        let refTimestamp: number;
        let accountId: `0x${string}`;

        cacheBeforeEach(async () => {
          accountId = `0x${Buffer.from(ethers.toUtf8Bytes(`id-${randomBytes(32).toString()}`)).toString("hex")}`;
          newKey = await generatePassKey(accountId, keyDomain);
          await helpers.time.increase(4 * 24 * 60 * 60); // This is to avoid the edge case where block.timestamp is around 0
          refTimestamp = (await provider.getBlock("latest")).timestamp;
        });
        const sut = async (signer: ethers.Signer = guardianWallet, key: Awaited<ReturnType<typeof generatePassKey>> = newKey) => {
          const tx = await guardianValidator.connect(signer).initRecovery(
            ssoAccountInstance.getAddress(), ethers.keccak256(accountId), key.args[1], key.hashedOriginDomain,
          );
          return tx;
        };
        const validatePendingRecovery = async (key: Awaited<ReturnType<typeof generatePassKey>> = newKey, timestamp: number = refTimestamp) => {
          const pendingRecoveryData = (await guardianValidator.getPendingRecoveryData(
            key.hashedOriginDomain,
            newGuardianConnectedSsoAccount.address,
          ));
          expect(pendingRecoveryData.rawPublicKey[0]).to.eq(toHex(key.args[1][0]));
          expect(pendingRecoveryData.rawPublicKey[1]).to.eq(toHex(key.args[1][1]));
          expect(Math.abs(Number(pendingRecoveryData.timestamp) - timestamp)).to.lt(10);
        }
        it("it creates new recovery process.", async function () {
          await sut();
          await validatePendingRecovery();
        });
        it("it prohibits non guardian from starting recovery process", async function () {
          await expect(sut(externalUserWallet)).to.be.reverted;
        });
        it("it reverts due to active recovery process", async () => {
          await sut();
          await validatePendingRecovery();
          await expect(sut()).to.be.revertedWithCustomError(guardianValidator, "AccountRecoveryInProgress");
          await helpers.time.increase(3 * 24 * 60 * 60 - 1 * 60 * 60); // Increase by < 72 hours
          await expect(sut()).to.be.revertedWithCustomError(guardianValidator, "AccountRecoveryInProgress");
        })
        it("it overwrites expired recovery process", async () => {
          await sut();
          await validatePendingRecovery();
          await helpers.time.increase(3 * 24 * 60 * 60 + 1 * 60 * 60); // Increase by > 72 hours
          const anotherKey = await generatePassKey(accountId, keyDomain);
          const anotherTimestamp = (await provider.getBlock("latest")).timestamp;
          await sut(guardianWallet, anotherKey);
          await validatePendingRecovery(anotherKey, anotherTimestamp);
        })
      });

      describe("And has active recovery process and trying to execute", () => {
        let newKeyArgs: Awaited<ReturnType<typeof generatePassKey>>["args"];
        let accountId: `0x${string}`;

        cacheBeforeEach(async () => {
          accountId = `0x${Buffer.from(ethers.toUtf8Bytes(`id-${randomBytes(32).toString()}`)).toString("hex")}`;
          const key = await generatePassKey(accountId, keyDomain);
          newKeyArgs = key.args;

          const hashDomain = key.hashedOriginDomain;
          const hashedAccountId = ethers.keccak256(newKeyArgs[0]);

          await helpers.time.increase(4 * 24 * 60 * 60); // This is to avoid the recovery process being active
          await guardianValidator.connect(guardianWallet)
            .initRecovery(newGuardianConnectedSsoAccount.address, hashedAccountId, newKeyArgs[1], hashDomain);
        });
        const sut = async (keyToAddArgs: Awaited<ReturnType<typeof generatePassKey>>["args"], ssoAccount: SmartAccount = newGuardianConnectedSsoAccount) => {
          const functionData = webauthn.interface.encodeFunctionData(
            "addValidationKey",
            [...keyToAddArgs],
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
            await expect(sut(newKeyArgs)).to.be.reverted;
          });
        });
        describe("but passing wrong new key", () => {
          it("it should revert.", async function () {
            const wrongKey = await generatePassKey(accountId, keyDomain);
            await helpers.time.increase(1 * 24 * 60 * 60 + 60);
            await expect(sut(wrongKey.args)).to.be.reverted;
          });
        });
        describe("and passing correct new key", () => {
          it("it should revert due to expired recovery process.", async function () {
            await helpers.time.increase(4 * 24 * 60 * 60);
            await expect(sut(newKeyArgs)).to.be.reverted;
          });
          it("it should clean up pending request if recovery process is active.", async function () {
            await helpers.time.increase(2 * 24 * 60 * 60);
            await sut(newKeyArgs);

            const pendingRecoveryData = (await guardianValidator.getPendingRecoveryData(
              hashedOriginDomain,
              newGuardianConnectedSsoAccount.address,
            ));
            expect(pendingRecoveryData.rawPublicKey[0]).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
            expect(pendingRecoveryData.rawPublicKey[1]).to.eq("0x0000000000000000000000000000000000000000000000000000000000000000");
            expect(pendingRecoveryData.timestamp).to.eq(0);
          });
        });
      });
    });
  });

  async function deploySsoAccountWithValidators(initialValidators: string[]) {
    const randomSalt = randomBytes(32);
    const factory = await fixtures.getAaFactory();
    const tx = await factory.deployProxySsoAccount(
      randomSalt,
      initialValidators,
      [ownerWallet],
    );
    const receipt = await tx.wait();
    const accountCreatedLog = receipt?.logs.map((x) => {
      const parsedLog = factory.interface.parseLog(x);

      if (parsedLog?.signature === "AccountCreated(address,bytes32)") {
        return parsedLog;
      }
    }).filter((x) => !!x)[0];
    const createdAccountAddress = accountCreatedLog!.args[0]?.toLowerCase();
    await (await fixtures.wallet.sendTransaction({ value: parseEther("0.2"), to: createdAccountAddress })).wait(); ;

    return SsoAccount__factory.connect(createdAccountAddress, fixtures.wallet);
  }
});

export async function generatePassKey(accountId: `0x${string}`, keyDomain: string) {
  const hashedOriginDomain = keccak256(toHex(keyDomain)) as `0x${string}`;
  const generatedR1Key = await generateES256R1Key();
  const [generatedX, generatedY] = await getRawPublicKeyFromCrpyto(generatedR1Key);
  const generatedKey = encodeKeyFromBytes(accountId, [generatedX, generatedY], keyDomain);
  return {
    generatedKey,
    hashedOriginDomain,
    args: [accountId, [generatedX, generatedY], keyDomain] as [`0x${string}`, [Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>], string],
  };
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
