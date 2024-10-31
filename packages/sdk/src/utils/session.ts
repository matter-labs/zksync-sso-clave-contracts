import type { Hex } from "viem";

import type { Limit, SessionPreferences } from "../client-gateway/interface.js";

enum LimitType {
  Unlimited = 0,
  Lifetime = 1,
  Allowance = 2,
}

export function getLimit(limit: bigint | Limit | undefined) {
  if (!limit) {
    return {
      limitType: LimitType.Unlimited,
      limit: 0n,
      period: 0n,
    };
  }
  if (typeof limit === "bigint") {
    return {
      limitType: LimitType.Lifetime,
      limit,
      period: 0n,
    };
  }
  if (!limit.period) {
    return {
      limitType: LimitType.Lifetime,
      limit: BigInt(limit.limit),
      period: 0n,
    };
  }
  return {
    limitType: LimitType.Allowance,
    limit: BigInt(limit.limit),
    period: BigInt(limit.period),
  };
}

export function getSession(session: SessionPreferences) {
  return {
    expiresAt: BigInt(session.expiresAt ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24),
    feeLimit: getLimit(session.feeLimit),
    callPolicies: session.callPolicies?.map((policy) => {
      const valueLimit = getLimit(policy.valueLimit);
      return {
        target: policy.target,
        selector: policy.selector ?? "0x00000000" as Hex,
        maxValuePerUse: policy.maxValuePerUse ? BigInt(policy.maxValuePerUse) : valueLimit.limit,
        valueLimit,
        constraints: policy.constraints?.map((constraint) => ({
          condition: constraint.condition ?? 0,
          index: BigInt(constraint.index),
          refValue: constraint.refValue ?? "0x" + "00".repeat(32) as Hex,
          limit: getLimit(constraint.limit),
        })) ?? [],
      };
    }) ?? [],
    transferPolicies: session.transferPolicies?.map((policy) => {
      const valueLimit = getLimit(policy.valueLimit);
      return {
        target: policy.target,
        maxValuePerUse: policy.maxValuePerUse ? BigInt(policy.maxValuePerUse) : valueLimit.limit,
        valueLimit,
      };
    }) ?? [],
  };
}
