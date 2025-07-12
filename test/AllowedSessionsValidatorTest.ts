import { assert, expect } from "chai";
import { it } from "mocha";
import { solidityPacked, keccak256, Wallet, randomBytes, parseEther, AbiCoder, ZeroAddress } from "ethers";
import hre from "hardhat";
import { utils } from "zksync-ethers";
import { ContractFixtures, logInfo } from "./utils";
import { PartialSession, SessionTester, getLimit } from "./SessionKeyTest";
import type { SessionLib } from "../typechain-types/src/interfaces/ISessionKeyValidator";

type SessionSpec = SessionLib.SessionSpecStruct;
const fixtures = new ContractFixtures();
const abiCoder = new AbiCoder();

describe('AllowedSessionsValidator tests', () => {
  let mockedTime: bigint = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now;;

  const getSessionActionsHash = (sessionSpec: SessionSpec) => {
    let callPoliciesEncoded: any;
    for (const callPolicy of sessionSpec.callPolicies) {
      callPoliciesEncoded = solidityPacked(
        callPoliciesEncoded !== undefined
          ? ["bytes", "bytes20", "bytes4", "uint256", "uint256", "uint256", "uint256"]
          : ["bytes20", "bytes4", "uint256", "uint256", "uint256", "uint256"],
        callPoliciesEncoded !== undefined
          ? [
            callPoliciesEncoded,
            callPolicy.target,
            callPolicy.selector,
            callPolicy.maxValuePerUse,
            callPolicy.valueLimit.limitType,
            callPolicy.valueLimit.limit,
            callPolicy.valueLimit.period
          ]
          : [
            callPolicy.target,
            callPolicy.selector,
            callPolicy.maxValuePerUse,
            callPolicy.valueLimit.limitType,
            callPolicy.valueLimit.limit,
            callPolicy.valueLimit.period
          ]
      );
    }
    return keccak256(hre.ethers.AbiCoder.defaultAbiCoder().encode(
      [
        "tuple(uint256 limitType, uint256 limit, uint256 period)",
        "tuple(address target, uint256 maxValuePerUse, tuple(uint256 limitType, uint256 limit, uint256 period) valueLimit)[]",
        "bytes"
      ],
      [
        sessionSpec.feeLimit,
        sessionSpec.transferPolicies,
        callPoliciesEncoded
      ]
    ));
  };

  it('should deploy AllowedSessionsValidator', async () => {
    const allowedSessionsValidator = await fixtures.getAllowedSessionsContract();
    assert(allowedSessionsValidator != null, "No AllowedSessionsValidator deployed");
  });

  it('should offchain and onchain SessionSpec actions hashes match', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const sessionSpec: SessionSpec = {
      signer: await fixtures.wallet.getAddress(), // Example signer
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 1n,
        limit: hre.ethers.parseEther("1"),
        period: 3600n,
      },
      transferPolicies: [],
      callPolicies: [
        {
          target: "0x0000000000000000000000000000000000000001",
          selector: "0x12345678",
          maxValuePerUse: hre.ethers.parseEther("0.1"),
          valueLimit: { limitType: 1n, limit: hre.ethers.parseEther("0.5"), period: 3600n },
          constraints: [],
        },
      ],
    };

    const sessionActionsHashOnchain = await validator.getSessionActionsHash(sessionSpec);
    const sessionActionsHashOffchain = getSessionActionsHash(sessionSpec);
    expect(sessionActionsHashOnchain).to.equal(sessionActionsHashOffchain);
  });

  it('should construct and allow SessionSpec actions (with onchain session actions hash generation)', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const sessionSpec: SessionSpec = {
      signer: await fixtures.wallet.getAddress(),
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 1n,
        limit: hre.ethers.parseEther("1"),
        period: 3600n,
      },
      transferPolicies: [],
      callPolicies: [
        {
          target: "0x0000000000000000000000000000000000000001",
          selector: "0x12345678",
          maxValuePerUse: hre.ethers.parseEther("0.1"),
          valueLimit: { limitType: 1n, limit: hre.ethers.parseEther("0.5"), period: 3600n },
          constraints: [],
        },
      ],
    };

    const sessionActionsHash = await validator.getSessionActionsHash(sessionSpec);
    await validator.setSessionActionsAllowed(sessionActionsHash, true);

    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;
  });

  it('should construct and allow SessionSpec actions (with offchain session actions hash generation)', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const sessionSpec: SessionSpec = {
      signer: await fixtures.wallet.getAddress(),
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 2n,
        limit: hre.ethers.parseEther("2"),
        period: 7200n,
      },
      transferPolicies: [],
      callPolicies: [
        {
          target: "0x0000000000000000000000000000000000000002",
          selector: "0x87654321",
          maxValuePerUse: hre.ethers.parseEther("0.2"),
          valueLimit: { limitType: 2n, limit: hre.ethers.parseEther("1"), period: 7200n },
          constraints: [],
        },
      ],
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);
    await validator.setSessionActionsAllowed(sessionActionsHash, true);

    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;
  });

  it('should allow SessionSpec with multiple transfer and call policies', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const sessionSpec: SessionSpec = {
      signer: await fixtures.wallet.getAddress(),
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 1n,
        limit: hre.ethers.parseEther("3"),
        period: 10800n,
      },
      transferPolicies: [
        {
          target: "0x0000000000000000000000000000000000000003",
          maxValuePerUse: hre.ethers.parseEther("0.3"),
          valueLimit: {
            limitType: 1n,
            limit: hre.ethers.parseEther("1"),
            period: 10800n,
          },
        },
        {
          target: "0x0000000000000000000000000000000000000004",
          maxValuePerUse: hre.ethers.parseEther("0.4"),
          valueLimit: {
            limitType: 2n,
            limit: hre.ethers.parseEther("2"),
            period: 21600n,
          },
        },
      ],
      callPolicies: [
        {
          target: "0x0000000000000000000000000000000000000005",
          selector: "0xabcdef12",
          maxValuePerUse: hre.ethers.parseEther("0.05"),
          valueLimit: {
            limitType: 1n,
            limit: hre.ethers.parseEther("0.2"),
            period: 10800n,
          },
          constraints: [
            {
              condition: 0n,
              index: 0,
              refValue: "0x0000000000000000000000000000000000000006",
              limit: {
                limitType: 1n,
                limit: hre.ethers.parseEther("0.1"),
                period: 10800n,
              },
            },
          ],
        },
        {
          target: "0x0000000000000000000000000000000000000007",
          selector: "0x1234abcd",
          maxValuePerUse: hre.ethers.parseEther("0.07"),
          valueLimit: {
            limitType: 2n,
            limit: hre.ethers.parseEther("0.3"),
            period: 21600n,
          },
          constraints: [
            {
              condition: 1n,
              index: 1,
              refValue: "0x0000000000000000000000000000000000000008",
              limit: {
                limitType: 2n,
                limit: hre.ethers.parseEther("0.2"),
                period: 21600n,
              },
            },
          ],
        },
      ],
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);
    await validator.setSessionActionsAllowed(sessionActionsHash, true);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;
  });

  it('should not allow SessionSpec actions if not explicitly allowed', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const validatorAddress = await fixtures.getAllowedSessionsContractAddress();
    const factoryContract = await fixtures.getAaFactory(true); // using allowed sessions contract
    const transferSessionTarget = Wallet.createRandom().address;

    const args = await factoryContract.getEncodedBeacon();
    const randomSalt = randomBytes(32);
    const bytecodeHash = await factoryContract.beaconProxyBytecodeHash();
    const factoryAddress = await factoryContract.getAddress();
    const standardCreate2Address = utils.create2Address(factoryAddress, bytecodeHash, randomSalt, args);
    let tester = new SessionTester(standardCreate2Address, await fixtures.getAllowedSessionsContractAddress());

    const initialSession = tester.getSession({
      transferPolicies: [{
        target: transferSessionTarget,
        maxValuePerUse: parseEther("0.01"),
      }],
    });
    const initSessionData = abiCoder.encode(validator.interface.getFunction("createSession").inputs, [initialSession]);
    const initialSessionActionsHash = await validator.getSessionActionsHash(initialSession);

    // First, allow the initial session actions
    await validator.setSessionActionsAllowed(initialSessionActionsHash, true);

    const sessionKeyPayload = abiCoder.encode(["address", "bytes"], [validatorAddress, initSessionData]);
    const deployTx = await factoryContract.deployProxySsoAccount(
      randomSalt,
      [sessionKeyPayload],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    logInfo(`\`deployProxySsoAccount\` gas used: ${deployTxReceipt?.gasUsed.toString()}`);

    const proxyAccountAddress = deployTxReceipt!.contractAddress!;
    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1"), to: proxyAccountAddress });
    await fundTx.wait();

    const initState = await validator.sessionState(proxyAccountAddress, initialSession);
    expect(initState.status).to.equal(1, "initial session should be active");

    tester = new SessionTester(proxyAccountAddress, await fixtures.getAllowedSessionsContractAddress());

    const sessionSpec: SessionSpec = {
      signer: tester.sessionOwner.address,
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 2n,
        limit: hre.ethers.parseEther("1"),
        period: 3600n,
      },
      transferPolicies: [],
      callPolicies: [
        {
          target: await validator.getAddress(),
          selector: "0xcafebabe",
          maxValuePerUse: hre.ethers.parseEther("0.05"),
          valueLimit: { limitType: 2n, limit: hre.ethers.parseEther("0.25"), period: 3600n },
          constraints: [],
        },
      ]
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);

    // Than, allow the session actions
    await validator.setSessionActionsAllowed(sessionActionsHash, true);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;

    const sessionSpecAsPartial: PartialSession = {
      expiresAt: parseInt(sessionSpec.expiresAt.toString()),
      feeLimit: getLimit({ limit: sessionSpec.feeLimit.limit, period: sessionSpec.feeLimit.period }),
      callPolicies: [
        {
          target: sessionSpec.callPolicies[0].target as string,
          selector: sessionSpec.callPolicies[0].selector as string,
          maxValuePerUse: sessionSpec.callPolicies[0].maxValuePerUse,
          valueLimit: {
            limit: sessionSpec.callPolicies[0].valueLimit.limit,
            period: sessionSpec.callPolicies[0].valueLimit.period
          },
          constraints: []
        }
      ]
    }

    await expect(
      tester.createSession(sessionSpecAsPartial, true)
    ).to.be.revertedWithCustomError(validator, "SESSION_CALL_POLICY_BANNED");
  });

  it('should reject a former valid session after being removed from allowed list', async () => {
    const validator = await fixtures.getAllowedSessionsContract();
    const validatorAddress = await fixtures.getAllowedSessionsContractAddress();
    const factoryContract = await fixtures.getAaFactory(true); // using allowed sessions contract
    const transferSessionTarget = Wallet.createRandom().address;

    const args = await factoryContract.getEncodedBeacon();
    const randomSalt = randomBytes(32);
    const bytecodeHash = await factoryContract.beaconProxyBytecodeHash();
    const factoryAddress = await factoryContract.getAddress();
    const standardCreate2Address = utils.create2Address(factoryAddress, bytecodeHash, randomSalt, args);
    let tester = new SessionTester(standardCreate2Address, await fixtures.getAllowedSessionsContractAddress());

    const initialSession = tester.getSession({
      transferPolicies: [{
        target: transferSessionTarget,
        maxValuePerUse: parseEther("0.01"),
      }],
    });
    const initSessionData = abiCoder.encode(validator.interface.getFunction("createSession").inputs, [initialSession]);
    const initialSessionActionsHash = await validator.getSessionActionsHash(initialSession);

    // First, allow the initial session actions
    await validator.setSessionActionsAllowed(initialSessionActionsHash, true);

    const sessionKeyPayload = abiCoder.encode(["address", "bytes"], [validatorAddress, initSessionData]);
    const deployTx = await factoryContract.deployProxySsoAccount(
      randomSalt,
      [sessionKeyPayload],
      [fixtures.wallet.address],
    );
    const deployTxReceipt = await deployTx.wait();
    logInfo(`\`deployProxySsoAccount\` gas used: ${deployTxReceipt?.gasUsed.toString()}`);

    const proxyAccountAddress = deployTxReceipt!.contractAddress!;
    expect(proxyAccountAddress, "the proxy account location via logs").to.not.equal(ZeroAddress, "be a valid address");

    const fundTx = await fixtures.wallet.sendTransaction({ value: parseEther("1"), to: proxyAccountAddress });
    await fundTx.wait();

    const initState = await validator.sessionState(proxyAccountAddress, initialSession);
    expect(initState.status).to.equal(1, "initial session should be active");

    tester = new SessionTester(proxyAccountAddress, await fixtures.getAllowedSessionsContractAddress());

    const sessionSpec: SessionSpec = {
      signer: tester.sessionOwner.address,
      expiresAt: mockedTime,
      feeLimit: {
        limitType: 2n,
        limit: hre.ethers.parseEther("1"),
        period: 3600n,
      },
      transferPolicies: [],
      callPolicies: [
        {
          target: "0x000000000000000000000000000000000000000a",
          selector: "0xcafebabe",
          maxValuePerUse: hre.ethers.parseEther("0.05"),
          valueLimit: { limitType: 2n, limit: hre.ethers.parseEther("0.25"), period: 3600n },
          constraints: [],
        },
      ]
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);

    // Than, allow the session actions
    await validator.setSessionActionsAllowed(sessionActionsHash, true);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;

    const sessionSpecAsPartial: PartialSession = {
      expiresAt: parseInt(sessionSpec.expiresAt.toString()),
      feeLimit: getLimit({ limit: sessionSpec.feeLimit.limit, period: sessionSpec.feeLimit.period }),
      callPolicies: [
        {
          target: sessionSpec.callPolicies[0].target as string,
          selector: sessionSpec.callPolicies[0].selector as string,
          maxValuePerUse: sessionSpec.callPolicies[0].maxValuePerUse,
          valueLimit: {
            limit: sessionSpec.callPolicies[0].valueLimit.limit,
            period: sessionSpec.callPolicies[0].valueLimit.period
          },
          constraints: []
        }
      ]
    }

    await tester.createSession(sessionSpecAsPartial, true); // using the allowed sessions contract

    // Now remove the session actions from allowed list
    await validator.setSessionActionsAllowed(sessionActionsHash, false);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.false;

    // Creating the same session should now fail
    await expect(
      tester.createSession(sessionSpecAsPartial, true)
    ).to.be.revertedWithCustomError(validator, "SESSION_ACTIONS_NOT_ALLOWED");
  });
});
