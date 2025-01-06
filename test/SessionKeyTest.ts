import { assert, expect } from "chai";
import { parseEther, randomBytes } from "ethers";
import { ethers, Wallet, ZeroAddress } from "ethers";
import hre from "hardhat";
import { it } from "mocha";
import { SmartAccount, utils } from "zksync-ethers";

import type { ERC20 } from "../typechain-types";
import { SsoBeacon__factory, SsoAccount__factory } from "../typechain-types";
import type { SsoBeacon } from "../typechain-types/src/SsoBeacon";
import type { SessionLib } from "../typechain-types/src/validators/SessionKeyValidator";
import { ContractFixtures, getProvider, logInfo } from "./utils";

const fixtures = new ContractFixtures();
const abiCoder = new ethers.AbiCoder();
const provider = getProvider();

const sessionSpecAbi = ethers.ParamType.from({
  components: [
    { name: "signer", type: "address" },
    { name: "expiresAt", type: "uint256" },
    {
      components: [
        { name: "limitType", type: "uint8" },
        { name: "limit", type: "uint256" },
        { name: "period", type: "uint256" },
      ],
      name: "feeLimit",
      type: "tuple",
    },
    {
      components: [
        { name: "target", type: "address" },
        { name: "selector", type: "bytes4" },
        { name: "maxValuePerUse", type: "uint256" },
        {
          components: [
            { name: "limitType", type: "uint8" },
            { name: "limit", type: "uint256" },
            { name: "period", type: "uint256" },
          ],
          name: "valueLimit",
          type: "tuple",
        },
        {
          components: [
            { name: "condition", type: "uint8" },
            { name: "index", type: "uint64" },
            { name: "refValue", type: "bytes32" },
            {
              components: [
                { name: "limitType", type: "uint8" },
                { name: "limit", type: "uint256" },
                { name: "period", type: "uint256" },
              ],
              name: "limit",
              type: "tuple",
            },
          ],
          name: "constraints",
          type: "tuple[]",
        },
      ],
      name: "callPolicies",
      type: "tuple[]",
    },
    {
      components: [
        { name: "target", type: "address" },
        { name: "maxValuePerUse", type: "uint256" },
        {
          components: [
            { name: "limitType", type: "uint8" },
            { name: "limit", type: "uint256" },
            { name: "period", type: "uint256" },
          ],
          name: "valueLimit",
          type: "tuple",
        },
      ],
      name: "transferPolicies",
      type: "tuple[]",
    },
  ],
  name: "sessionSpec",
  type: "tuple",
});

enum Condition {
  Unconstrained = 0,
  Equal = 1,
  Greater = 2,
  Less = 3,
  GreaterEqual = 4,
  LessEqual = 5,
  NotEqual = 6,
}

enum LimitType {
  Unlimited = 0,
  Lifetime = 1,
  Allowance = 2,
}

type PartialLimit = {
  limit: ethers.BigNumberish;
  period?: ethers.BigNumberish;
};

type PartialSession = {
  expiresAt?: number;
  feeLimit?: PartialLimit;
  callPolicies?: {
    target: string;
    selector?: string;
    maxValuePerUse?: ethers.BigNumberish;
    valueLimit?: PartialLimit;
    constraints?: {
      condition?: Condition;
      index: ethers.BigNumberish;
      refValue?: ethers.BytesLike;
      limit?: PartialLimit;
    }[];
  }[];
  transferPolicies?: {
    target: string;
    maxValuePerUse?: ethers.BigNumberish;
    valueLimit?: PartialLimit;
  }[];
};

async function getTimestamp() {
  if (hre.network.name == "inMemoryNode") {
    return Math.floor(await provider.send("config_getCurrentTimestamp", []));
  } else {
    return Math.floor(Date.now() / 1000);
  }
}

class SessionTester {
  public sessionOwner: Wallet;
  public session: SessionLib.SessionSpecStruct;
  public sessionAccount: SmartAccount;
  // having this is a bit hacky, but it's so we can provide correct period ids in the signature
  aaTransaction: ethers.TransactionLike;

  constructor(
    public proxyAccountAddress: string,
    sessionKeyModuleAddress: string,
  ) {
    this.sessionOwner = new Wallet(Wallet.createRandom().privateKey, provider);
    this.sessionAccount = new SmartAccount(
      {
        payloadSigner: async (hash) =>
          abiCoder.encode(
            ["bytes", "address", "bytes"],
            [
              this.sessionOwner.signingKey.sign(hash).serialized,
              sessionKeyModuleAddress,
              abiCoder.encode(
                [sessionSpecAbi, "uint64[]"],
                [this.session, await this.periodIds(this.aaTransaction.to!, this.aaTransaction.data?.slice(0, 10))],
              ),
            ],
          ),
        address: this.proxyAccountAddress,
        secret: this.sessionOwner.privateKey,
      },
      provider,
    );
  }

  async createSession(newSession: PartialSession) {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const smartAccount = new SmartAccount(
      {
        address: this.proxyAccountAddress,
        secret: fixtures.wallet.privateKey,
      },
      provider,
    );

    this.session = this.getSession(newSession);

    const oldState = await sessionKeyModuleContract.sessionState(this.proxyAccountAddress, this.session);
    expect(oldState.status).to.equal(0, "session should not exist yet");

    const aaTx = {
      ...(await this.aaTxTemplate()),
      to: await sessionKeyModuleContract.getAddress(),
      data: sessionKeyModuleContract.interface.encodeFunctionData("createSession", [this.session]),
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    logInfo(`\`createSession\` gas used: ${receipt.gasUsed.toString()}`);

    const newState = await sessionKeyModuleContract.sessionState(this.proxyAccountAddress, this.session);
    expect(newState.status).to.equal(1, "session should be active");
  }

  encodeSession() {
    return abiCoder.encode([sessionSpecAbi], [this.session]);
  }

  async periodIds(target: string, selector?: string) {
    const timestamp = await getTimestamp();

    const getId = (limit: SessionLib.UsageLimitStruct) => {
      if (limit.limitType == LimitType.Allowance) {
        return Math.floor(timestamp / Number(limit.period));
      }
      return 0;
    };

    const isTransfer = selector == null || ethers.getBytes(selector).length < 4;
    const policy: SessionLib.CallSpecStruct | SessionLib.TransferSpecStruct | undefined = isTransfer
      ? this.session.transferPolicies.find((policy) => policy.target == target)
      : this.session.callPolicies.find(
          (policy) => policy.target == target && ethers.hexlify(policy.selector) == selector,
        );

    if (policy == null) {
      throw new Error("Transaction does not fit any policy");
    }

    const periodIds = [
      getId(this.session.feeLimit),
      getId(policy.valueLimit),
      ...(isTransfer
        ? []
        : (<SessionLib.CallSpecStruct>policy).constraints.map((constraint) => getId(constraint.limit))),
    ];
    return periodIds;
  }

  async revokeKey() {
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
    const oldState = await sessionKeyModuleContract.sessionState(this.proxyAccountAddress, this.session);
    expect(oldState.status).to.equal(1, "session should be active");

    const smartAccount = new SmartAccount(
      {
        address: this.proxyAccountAddress,
        secret: fixtures.wallet.privateKey,
      },
      provider,
    );

    const sessionHash = ethers.keccak256(this.encodeSession());

    const aaTx = {
      ...(await this.aaTxTemplate()),
      to: await sessionKeyModuleContract.getAddress(),
      data: sessionKeyModuleContract.interface.encodeFunctionData("revokeKey", [sessionHash]),
    };
    aaTx.gasLimit = await provider.estimateGas(aaTx);

    const signedTransaction = await smartAccount.signTransaction(aaTx);
    const tx = await provider.broadcastTransaction(signedTransaction);
    await tx.wait();
    const newState = await sessionKeyModuleContract.sessionState(this.proxyAccountAddress, this.session);
    expect(newState.status).to.equal(2, "session should be revoked");
  }

  async sendTxSuccess(txRequest: ethers.TransactionLike = {}) {
    this.aaTransaction = {
      ...(await this.aaTxTemplate(await this.periodIds(txRequest.to!, txRequest.data?.slice(0, 10)))),
      ...txRequest,
    };
    this.aaTransaction.gasLimit = await provider.estimateGas(this.aaTransaction);
    logInfo(`\`sessionTx\` gas estimated: ${this.aaTransaction.gasLimit}`);

    const signedTransaction = await this.sessionAccount.signTransaction(this.aaTransaction);
    const tx = await provider.broadcastTransaction(signedTransaction);
    const receipt = await tx.wait();
    logInfo(`\`sessionTx\` gas used: ${receipt.gasUsed}`);
  }

  async sendTxFail(tx: ethers.TransactionLike = {}) {
    this.aaTransaction = {
      ...(await this.aaTxTemplate(await this.periodIds(tx.to!, tx.data?.slice(0, 10)))),
      gasLimit: 100_000_000n,
      ...tx,
    };

    const signedTransaction = await this.sessionAccount.signTransaction(this.aaTransaction);
    await expect(provider.broadcastTransaction(signedTransaction)).to.be.reverted;
  }

  _getLimit(limit?: PartialLimit): SessionLib.UsageLimitStruct {
    return SessionTester.getLimit(limit);
  }

  static getLimit(limit?: PartialLimit): SessionLib.UsageLimitStruct {
    return limit == null
      ? {
          limitType: LimitType.Unlimited,
          limit: 0,
          period: 0,
        }
      : limit.period == null
        ? {
            limitType: LimitType.Lifetime,
            limit: limit.limit,
            period: 0,
          }
        : {
            limitType: LimitType.Allowance,
            limit: limit.limit,
            period: limit.period,
          };
  }

  getSession(session: PartialSession): SessionLib.SessionSpecStruct {
    return {
      signer: this.sessionOwner.address,
      expiresAt: session.expiresAt ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      // unlimited fees are not safe
      feeLimit: session.feeLimit ? this._getLimit(session.feeLimit) : this._getLimit({ limit: parseEther("0.1") }),
      callPolicies:
        session.callPolicies?.map((policy) => ({
          target: policy.target,
          selector: policy.selector ?? "0x00000000",
          maxValuePerUse: policy.maxValuePerUse ?? 0,
          valueLimit: this._getLimit(policy.valueLimit),
          constraints:
            policy.constraints?.map((constraint) => ({
              condition: constraint.condition ?? 0,
              index: constraint.index,
              refValue: constraint.refValue ?? ethers.ZeroHash,
              limit: this._getLimit(constraint.limit),
            })) ?? [],
        })) ?? [],
      transferPolicies:
        session.transferPolicies?.map((policy) => ({
          target: policy.target,
          maxValuePerUse: policy.maxValuePerUse ?? 0,
          valueLimit: this._getLimit(policy.valueLimit),
        })) ?? [],
    };
  }

  async aaTxTemplate(periodIds?: number[]) {
    return {
      type: 113,
      from: this.proxyAccountAddress,
      data: "0x",
      value: 0,
      chainId: (await provider.getNetwork()).chainId,
      nonce: await provider.getTransactionCount(this.proxyAccountAddress),
      gasPrice: await provider.getGasPrice(),
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        customSignature: periodIds
          ? abiCoder.encode(
              ["bytes", "address", "bytes"],
              [
                ethers.zeroPadValue("0x1b", 65),
                await fixtures.getSessionKeyModuleAddress(),
                abiCoder.encode([sessionSpecAbi, "uint64[]"], [this.session, periodIds]),
              ],
            )
          : undefined,
      },
      gasLimit: 0n,
    };
  }
}

describe("SessionKeyModule tests", function () {
  let proxyAccountAddress: string;

  (hre.network.name == "dockerizedNode" ? it : it.skip)("should deposit funds", async () => {
    const deposit = await fixtures.wallet.deposit({
      token: utils.ETH_ADDRESS,
      amount: parseEther("10"),
    });
    await deposit.waitL1Commit();
  });

  it("should deploy all contracts", async () => {
    const verifierContract = await fixtures.getWebAuthnVerifierContract();
    assert(verifierContract != null, "No verifier deployed");
    const sessionModuleContract = await fixtures.getSessionKeyContract();
    assert(sessionModuleContract != null, "No session module deployed");
    const ssoContract = await fixtures.getAccountImplContract();
    assert(ssoContract != null, "No SSO Account deployed");
    const beaconContract = await fixtures.getBeaconContract();
    assert(beaconContract != null, "No Beacon deployed");
    const factoryContract = await fixtures.getAaFactory();
    assert(factoryContract != null, "No AA Factory deployed");
    const authServerPaymaster = await fixtures.deployExampleAuthServerPaymaster(
      await factoryContract.getAddress(),
      await sessionModuleContract.getAddress(),
    );
    assert(authServerPaymaster != null, "No Auth Server Paymaster deployed");

    logInfo(`SSO Account Address            : ${await ssoContract.getAddress()}`);
    logInfo(`Beacon Address                 : ${await beaconContract.getAddress()}`);
    logInfo(`Session Address                : ${await sessionModuleContract.getAddress()}`);
    logInfo(`Passkey Address                : ${await verifierContract.getAddress()}`);
    logInfo(`Account Factory Address        : ${await factoryContract.getAddress()}`);
    logInfo(`Auth Server Paymaster Address  : ${await authServerPaymaster.getAddress()}`);
  });

  it("should deploy proxy account via factory", async () => {
    const factoryContract = await fixtures.getAaFactory();
    const sessionKeyModuleAddress = await fixtures.getSessionKeyModuleAddress();
    const transferSessionTarget = Wallet.createRandom().address;
    const sessionKeyModuleContract = await fixtures.getSessionKeyContract();

    // create a session to encode (before the account is deployed)
    const args = await factoryContract.getEncodedBeacon();
    const randomSalt = randomBytes(32);
    const bytecodeHash = await factoryContract.beaconProxyBytecodeHash();
    const factoryAddress = await factoryContract.getAddress();
    const standardCreate2Address = utils.create2Address(factoryAddress, bytecodeHash, randomSalt, args);
    let tester = new SessionTester(standardCreate2Address, await fixtures.getSessionKeyModuleAddress());
    const initialSession = await tester.getSession({
      transferPolicies: [
        {
          target: transferSessionTarget,
          maxValuePerUse: parseEther("0.01"),
        },
      ],
    });
    const initSessionData = abiCoder.encode(sessionKeyModuleContract.interface.getFunction("createSession").inputs, [
      initialSession,
    ]);

    const sessionKeyPayload = abiCoder.encode(["address", "bytes"], [sessionKeyModuleAddress, initSessionData]);
    const deployTx = await factoryContract.deployProxySsoAccount(
      randomSalt,
      "session-key-test-id" + randomBytes(32).toString(),
      [sessionKeyPayload],
      [fixtures.wallet.address],
    );

    const deployTxReceipt = await deployTx.wait();
    logInfo(`\`deployProxySsoAccount\` gas used: ${deployTxReceipt?.gasUsed.toString()}`);

    proxyAccountAddress = deployTxReceipt!.contractAddress!;
    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1"), to: proxyAccountAddress });
    const receipt = await fundTx.wait();

    const initState = await sessionKeyModuleContract.sessionState(proxyAccountAddress, initialSession);
    expect(initState.status).to.equal(1, "initial session should be active");

    const account = SsoAccount__factory.connect(proxyAccountAddress, provider);
    assert(await account.k1IsOwner(fixtures.wallet.address));
    assert(!(await account.isHook(sessionKeyModuleAddress)), "session key module should not be an execution hook");
    assert(await account.isModuleValidator(sessionKeyModuleAddress), "session key module should be a validator");
  });

  describe("Value transfer limit tests", function () {
    let tester: SessionTester;
    const sessionTarget = Wallet.createRandom().address;

    it("should create a session", async () => {
      tester = new SessionTester(proxyAccountAddress, await fixtures.getSessionKeyModuleAddress());
      await tester.createSession({
        transferPolicies: [
          {
            target: sessionTarget,
            maxValuePerUse: parseEther("0.01"),
          },
        ],
      });
    });

    it("should use a session key to send a transaction", async () => {
      await tester.sendTxSuccess({
        to: sessionTarget,
        value: parseEther("0.01"),
      });
      expect(await provider.getBalance(sessionTarget)).to.equal(
        parseEther("0.01"),
        "session target should have received the funds",
      );
    });

    it("should reject a session key transaction that goes over limit", async () => {
      await tester.sendTxFail({
        to: sessionTarget,
        value: parseEther("0.02"),
      });
    });
  });

  describe("ERC20 transfer limit tests", function () {
    let tester: SessionTester;
    let erc20: ERC20;
    const sessionTarget = Wallet.createRandom().address;

    it("should deploy and mint an ERC20 token", async () => {
      erc20 = await fixtures.deployERC20(proxyAccountAddress);
      expect(await erc20.balanceOf(proxyAccountAddress)).to.equal(10n ** 18n, "should have some tokens");
    });

    it("should create a session", async () => {
      tester = new SessionTester(proxyAccountAddress, await fixtures.getSessionKeyModuleAddress());
      await tester.createSession({
        callPolicies: [
          {
            target: await erc20.getAddress(),
            selector: erc20.interface.getFunction("transfer").selector,
            constraints: [
              // can only transfer to sessionTarget
              {
                index: 0,
                refValue: ethers.zeroPadValue(sessionTarget, 32),
                condition: Condition.Equal,
              },
              // can only transfer upto 1000 tokens per tx
              // can only transfer upto 1500 tokens in total
              {
                index: 1,
                refValue: ethers.toBeHex(1000, 32),
                condition: Condition.LessEqual,
                limit: { limit: 1500 },
              },
            ],
          },
        ],
      });
    });

    it("should reject a session key transaction to wrong target", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [Wallet.createRandom().address, 1n]),
      });
    });

    it("should reject a session key transaction that goes over per-tx limit", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 1001n]),
      });
    });

    it("should successfully send a session key transaction", async () => {
      await tester.sendTxSuccess({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 1000n]),
      });
      expect(await erc20.balanceOf(sessionTarget)).to.equal(1000n, "session target should have received the tokens");
    });

    it("should reject a session key transaction that goes over total limit", async () => {
      const sessionKeyModuleContract = await fixtures.getSessionKeyContract();
      const remainingLimits = await sessionKeyModuleContract.sessionState(proxyAccountAddress, tester.session);
      expect(remainingLimits.callParams[0].remaining).to.equal(500n, "should have 500 tokens remaining in allowance");

      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 501n]),
      });
    });

    it("should successfully revoke a session key", async () => {
      await tester.revokeKey();
    });

    it("should reject a revoked session key transaction", async () => {
      await tester.sendTxFail({
        to: await erc20.getAddress(),
        data: erc20.interface.encodeFunctionData("transfer", [sessionTarget, 1n]),
      });
    });
  });

  (hre.network.name == "inMemoryNode" ? describe : describe.skip)("Timestamp-based tests", function () {
    let tester: SessionTester;
    const sessionTarget = Wallet.createRandom().address;
    const period = 120;

    it("should create a session", async () => {
      tester = new SessionTester(proxyAccountAddress, await fixtures.getSessionKeyModuleAddress());
      await tester.createSession({
        expiresAt: (await getTimestamp()) + period * 3,
        transferPolicies: [
          {
            target: sessionTarget,
            maxValuePerUse: parseEther("0.01"),
            valueLimit: {
              limit: parseEther("0.015"),
              period,
            },
          },
        ],
      });
    });

    it("should use a session key to send a transaction", async () => {
      // We have to wait until the next period starts
      const timestamp = Math.floor(await provider.send("config_getCurrentTimestamp", []));
      await provider.send("evm_increaseTime", [period - (timestamp % period)]);
      // NOTE: this only works because `period` is > 60 seconds, since the default is
      // `timestamp_asserter.min_time_till_end_sec = 60`
      // We can sidestep the waiting by calling `evm_increaseTime` directly during the test,
      // but also meaans that in production, creating sessions that expire in < 60 seconds is useless.
      // Same goes for allowance time periods with duration < 60 seconds.
      await tester.sendTxSuccess({
        to: sessionTarget,
        value: parseEther("0.01"),
      });
    });

    it("should reject a transaction that goes over allowance limit", async () => {
      await tester.sendTxFail({
        to: sessionTarget,
        value: parseEther("0.01"),
      });
    });

    it("should wait until allowance renews and send a transaction", async () => {
      await provider.send("evm_increaseTime", [period]);
      await tester.sendTxSuccess({
        to: sessionTarget,
        value: parseEther("0.01"),
      });
    });

    // TODO: check error messages as well
    it("should reject a transaction with an expired session", async () => {
      await provider.send("evm_increaseTime", [period * 2]);
      await tester.sendTxFail({
        to: sessionTarget,
        value: parseEther("0.01"),
      });
    });
  });

  describe("Upgrade tests", function () {
    let beacon: SsoBeacon;

    it("should check implementation address", async () => {
      beacon = SsoBeacon__factory.connect(await fixtures.getBeaconAddress(), fixtures.wallet);
      expect(await beacon.implementation()).to.equal(await fixtures.getAccountImplAddress());
    });

    it("should upgrade implementation", async () => {
      const newImpl = await hre.deployer.deploy("Dummy", []);
      await beacon.upgradeTo(await newImpl.getAddress());
      expect(await beacon.implementation()).to.equal(await newImpl.getAddress());
    });

    it("should check that proxy uses new implementation", async () => {
      const proxy = new ethers.Contract(proxyAccountAddress, ["function dummy() pure returns (string)"], provider);
      expect(await proxy.dummy()).to.equal("dummy");
    });

    it("should upgrade implementation back", async () => {
      await beacon.upgradeTo(await fixtures.getAccountImplAddress());
      expect(await beacon.implementation()).to.equal(await fixtures.getAccountImplAddress());
    });
  });

  // TODO: module uninstall tests
  // TODO: session fee limit tests
});
