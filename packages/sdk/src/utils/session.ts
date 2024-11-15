import { type Address, type Hash } from "viem";

export enum LimitType {
  Unlimited = 0,
  Lifetime = 1,
  Allowance = 2,
}

export type Limit = {
  limitType: LimitType;
  limit: bigint;
  period: bigint;
};

export const LimitUnlimited = {
  limitType: LimitType.Unlimited,
  limit: 0n,
  period: 0n,
};

export const LimitZero = {
  limitType: LimitType.Lifetime,
  limit: 0n,
  period: 0n,
};

export enum ConstraintCondition {
  Unconstrained = 0,
  Equal = 1,
  Greater = 2,
  Less = 3,
  GreaterEqual = 4,
  LessEqual = 5,
  NotEqual = 6,
}

export type Constraint = {
  index: bigint;
  condition: ConstraintCondition;
  refValue: Hash;
  limit: Limit;
};

export type CallPolicy = {
  target: Address;
  valueLimit: Limit;
  maxValuePerUse: bigint;
  selector: Hash;
  constraints: Constraint[];
};

export type TransferPolicy = {
  target: Address;
  maxValuePerUse: bigint;
  valueLimit: Limit;
};

export type SessionConfig = {
  signer: Address;
  expiresAt: bigint;
  feeLimit: Limit;
  callPolicies: CallPolicy[];
  transferPolicies: TransferPolicy[];
};
