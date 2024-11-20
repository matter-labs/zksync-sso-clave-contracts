import { type AbiFunction, type Address, getAddress, type Hash, toFunctionSelector, toHex } from "viem";

import { ConstraintCondition, type Limit, LimitType, LimitUnlimited, LimitZero, type SessionConfig } from "../utils/session.js";

type PartialLimit = bigint | {
  limit: bigint;
  period?: bigint;
} | {
  limitType: "lifetime" | LimitType.Lifetime;
  limit: bigint;
} | {
  limitType: "unlimited" | LimitType.Unlimited;
} | {
  limitType: "allowance" | LimitType.Allowance;
  limit: bigint;
  period: bigint;
};

type PartialCallPolicy = {
  address: Address;
  function?: string | AbiFunction;
  selector?: Hash; // if function is not provided
  maxValuePerUse?: bigint;
  valueLimit?: PartialLimit;
  constraints?: {
    index: number;
    condition?: ConstraintCondition | keyof typeof ConstraintCondition;
    refValue?: Hash;
    limit?: PartialLimit;
  }[];
};

type PartialTransferPolicy = {
  to: Address;
  maxValuePerUse?: bigint;
  valueLimit?: PartialLimit;
};

export interface SessionPreferences {
  expiresAt?: bigint | Date;
  feeLimit?: PartialLimit;
  contractCalls?: PartialCallPolicy[];
  transfers?: PartialTransferPolicy[];
};

const formatLimitPreferences = (limit: PartialLimit): Limit => {
  /* Just bigint was passed */
  if (typeof limit === "bigint") {
    return {
      limitType: LimitType.Lifetime,
      limit,
      period: 0n,
    };
  }

  /* LimitType was specified */
  if ("limitType" in limit) {
    if (limit.limitType === "lifetime" || limit.limitType === LimitType.Lifetime) {
      return {
        limitType: LimitType.Lifetime,
        limit: limit.limit,
        period: 0n,
      };
    } else if (limit.limitType === "unlimited" || limit.limitType === LimitType.Unlimited) {
      return {
        limitType: LimitType.Unlimited,
        limit: 0n,
        period: 0n,
      };
    } else if (limit.limitType === "allowance" || limit.limitType === LimitType.Allowance) {
      return {
        limitType: LimitType.Allowance,
        limit: limit.limit,
        period: limit.period,
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`Invalid limit type: ${(limit as any).limitType}`);
  }

  /* LimitType not selected */
  if (!limit.period) {
    return {
      limitType: LimitType.Lifetime,
      limit: limit.limit,
      period: 0n,
    };
  }
  return {
    limitType: LimitType.Allowance,
    limit: limit.limit,
    period: limit.period,
  };
};

const formatDatePreferences = (date: bigint | Date): bigint => {
  if (date instanceof Date) {
    return BigInt(Math.floor(date.getTime() / 1000));
  }
  return date;
};

export function formatSessionPreferences(
  preferences: SessionPreferences,
  defaults: {
    expiresAt: bigint;
    feeLimit: Limit;
  },
): Omit<SessionConfig, "signer"> {
  return {
    expiresAt: preferences.expiresAt ? formatDatePreferences(preferences.expiresAt) : defaults.expiresAt,
    feeLimit: preferences.feeLimit ? formatLimitPreferences(preferences.feeLimit) : defaults.feeLimit,
    callPolicies: preferences.contractCalls?.map((policy) => {
      const valueLimit = policy.valueLimit ? formatLimitPreferences(policy.valueLimit) : LimitZero;
      const selector = policy.function ? toFunctionSelector(policy.function) : policy.selector;
      if (!selector) throw new Error("Missing function or selector in contract call policy");
      return {
        target: getAddress(policy.address.toLowerCase()),
        maxValuePerUse: policy.maxValuePerUse ?? valueLimit.limit,
        valueLimit,
        selector: selector,
        constraints: policy.constraints?.map((constraint) => ({
          index: BigInt(constraint.index),
          condition: typeof constraint.condition == "string" ? ConstraintCondition[constraint.condition] : (constraint.condition ?? ConstraintCondition.Unconstrained),
          refValue: constraint.refValue ?? toHex("", { size: 32 }),
          limit: constraint.limit ? formatLimitPreferences(constraint.limit) : LimitUnlimited,
        })) ?? [],
      };
    }) ?? [],
    transferPolicies: preferences.transfers?.map((policy) => {
      const valueLimit = policy.valueLimit ? formatLimitPreferences(policy.valueLimit) : LimitZero;
      return {
        target: getAddress(policy.to.toLowerCase()),
        maxValuePerUse: policy.maxValuePerUse ?? valueLimit.limit,
        valueLimit,
      };
    }) ?? [],
  };
}
