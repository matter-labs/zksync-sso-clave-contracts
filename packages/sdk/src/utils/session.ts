import type { Address, Hex } from "viem";

import type { Limit, SessionPreferences } from "../client-gateway/interface.js";

enum LimitType {
  Unlimited = 0,
  Lifetime = 1,
  Allowance = 2,
}

function getLimit(limit?: Limit) {
  return limit == null
    ? {
        limitType: LimitType.Unlimited,
        limit: 0n,
        period: 0n,
      }
    : limit.period == null
      ? {
          limitType: LimitType.Lifetime,
          limit: BigInt(limit.limit),
          period: 0n,
        }
      : {
          limitType: LimitType.Allowance,
          limit: BigInt(limit.limit),
          period: BigInt(limit.period),
        };
}

export function getSession(session: SessionPreferences) {
  return {
    expiresAt: BigInt(session.expiresAt ?? Math.floor(Date.now() / 1000) + 60 * 60 * 24),
    feeLimit: getLimit(session.feeLimit),
    callPolicies: session.callPolicies?.map((policy) => ({
      target: <Address>policy.target,
      selector: <Hex>policy.selector ?? "0x00000000",
      maxValuePerUse: BigInt(policy.maxValuePerUse ?? 0),
      valueLimit: getLimit(policy.valueLimit),
      constraints: policy.constraints?.map((constraint) => ({
        condition: constraint.condition ?? 0,
        index: BigInt(constraint.index),
        refValue: <Hex>constraint.refValue ?? "0x" + "00".repeat(32),
        limit: getLimit(constraint.limit),
      })) ?? [],
    })) ?? [],
    transferPolicies: session.transferPolicies?.map((policy) => ({
      target: <Address>policy.target,
      maxValuePerUse: BigInt(policy.maxValuePerUse ?? 0),
      valueLimit: getLimit(policy.valueLimit),
    })) ?? [],
  };
}
