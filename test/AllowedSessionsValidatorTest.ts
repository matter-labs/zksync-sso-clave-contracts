import { assert, expect } from "chai";
import { it } from "mocha";
import { solidityPacked, keccak256 } from "ethers";
import hre from "hardhat";
import { ContractFixtures } from "./utils";

type SessionSpec = {
  signer: string;
  expiresAt: bigint;
  feeLimit: {
    limitType: bigint;
    limit: bigint;
    period: bigint;
  };
  transferPolicies: Array<{
    target: string;
    maxValuePerUse: bigint;
    valueLimit: {
      limitType: bigint;
      limit: bigint;
      period: bigint;
    };
  }>;
  callPolicies: Array<{
    target: string;
    selector: string;
    maxValuePerUse: bigint;
    valueLimit: {
      limitType: bigint;
      limit: bigint;
      period: bigint;
    };
    constraints: Array<{
      condition: bigint;
      index: number;
      refValue: string;
      limit: {
        limitType: bigint;
        limit: bigint;
        period: bigint;
      };
    }>;
  }>;
};

const fixtures = new ContractFixtures();

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
          target: "0x0000000000000000000000000000000000000009",
          selector: "0xdeadbeef",
          maxValuePerUse: hre.ethers.parseEther("0.01"),
          valueLimit: { limitType: 1n, limit: hre.ethers.parseEther("0.1"), period: 3600n },
          constraints: [],
        },
      ],
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);
    // Do NOT call setSessionActionsAllowed(sessionActionsHash, true);

    await expect(
      validator.setSessionActionsAllowed(sessionActionsHash, false) // ensure it's not allowed
    ).not.to.be.reverted;

    await expect(
      validator.createSession(sessionSpec)
    ).to.be.revertedWithCustomError(validator, "SESSION_ACTIONS_NOT_ALLOWED");
  });

  it('should reject a former valid session after being removed from allowed list', async () => {
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
          target: "0x000000000000000000000000000000000000000a",
          selector: "0xcafebabe",
          maxValuePerUse: hre.ethers.parseEther("0.05"),
          valueLimit: { limitType: 1n, limit: hre.ethers.parseEther("0.25"), period: 3600n },
          constraints: [],
        },
      ],
    };

    const sessionActionsHash = getSessionActionsHash(sessionSpec);
    
    // First, allow the session actions
    await validator.setSessionActionsAllowed(sessionActionsHash, true);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.true;
    
    // Create session should work
    await expect(validator.createSession(sessionSpec)).not.to.be.reverted;
    
    // Now remove the session actions from allowed list
    await validator.setSessionActionsAllowed(sessionActionsHash, false);
    expect(await validator.areSessionActionsAllowed(sessionActionsHash)).to.be.false;
    
    // Creating the same session should now fail
    await expect(
      validator.createSession(sessionSpec)
    ).to.be.revertedWithCustomError(validator, "SESSION_ACTIONS_NOT_ALLOWED");
  });
});
