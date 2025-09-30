#!/usr/bin/env bash
set -euo pipefail

# Validator inspection helper for ZKSync Era Sepolia.
#
# Run from packages/contracts (recommended):
#   cd packages/contracts
#   ./scripts/check-validators.sh
#
# What it does:
# - Loads RPC/account env from packages/contracts/.env if present
# - Reads addresses from packages/auth-server/stores/era-sepolia.json when not provided via env
# - Checks that contracts have code and prints key fields
# - Optionally checks isModuleValidator(webAuthValidator) on an SSO account
#
# Env overrides (all optional):
#   RPC_URL            -> defaults to https://sepolia.era.zksync.dev
#   GUARDIAN_ADDR      -> GuardianRecoveryValidator proxy address
#   OIDC_ADDR          -> OidcRecoveryValidator proxy address
#   ACCOUNT_ADDR       -> SsoAccount address to check installation
#

usage() {
  cat <<USAGE
Usage: ./scripts/check-validators.sh [--init-guardian] [--init-oidc] [--deploy-verifier] [--simulate-only] [--compare-deploy-oidc] [--check-paymaster] [--ensure-paymaster]

Without flags, prints validator addresses and checks installation.

Options:
  --init-guardian     Initialize GuardianRecoveryValidator with WebAuthValidator
  --init-oidc         Initialize OidcRecoveryValidator with KeyRegistry, Verifier, and WebAuthValidator
  --deploy-verifier   When used with --init-oidc, deploy Groth16Verifier if none provided
  --simulate-only     Do not send txs; simulate initialize to check revert reason
  --compare-deploy-oidc  Deploy a fresh OIDC proxy with same params for comparison
  --check-paymaster   Inspect current paymaster: code, module addresses, balance, whitelist (if supported)
  --ensure-paymaster  If paymaster invalid (missing, wrong modules, low balance) deploy a new one via hardhat task

Environment overrides:
  RPC_URL, GUARDIAN_ADDR, OIDC_ADDR, ACCOUNT_ADDR, PASSKEY_ADDR, OIDC_KEY_REGISTRY_ADDR, OIDC_VERIFIER_ADDR, PAYMASTER_ADDR,
  MIN_PAYMASTER_BALANCE (in ETH, default 0.05), FACTORY_ADDR (override factory for paymaster), PROXY_FILE (defaults to era-sepolia.json)
USAGE
}

# Resolve paths relative to this script
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
CONTRACTS_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
REPO_ROOT=$(cd "$CONTRACTS_DIR/../.." && pwd)
ERA_JSON="$REPO_ROOT/packages/auth-server/stores/era-sepolia.json"

# Load env from packages/contracts/.env if present
if [[ -f "$CONTRACTS_DIR/.env" ]]; then
  # export variables defined in .env
  set -a
  # shellcheck disable=SC1090
  source "$CONTRACTS_DIR/.env"
  set +a
fi

# Defaults
RPC_URL=${RPC_URL:-https://sepolia.era.zksync.dev}
GUARDIAN_ADDR=${GUARDIAN_ADDR:-}
OIDC_ADDR=${OIDC_ADDR:-}
ACCOUNT_ADDR=${ACCOUNT_ADDR:-}
PASSKEY_ADDR=${PASSKEY_ADDR:-}
OIDC_KEY_REGISTRY_ADDR=${OIDC_KEY_REGISTRY_ADDR:-}
OIDC_VERIFIER_ADDR=${OIDC_VERIFIER_ADDR:-}
PAYMASTER_ADDR=${PAYMASTER_ADDR:-}
MIN_PAYMASTER_BALANCE=${MIN_PAYMASTER_BALANCE:-0.05}
FACTORY_ADDR=${FACTORY_ADDR:-}
PROXY_FILE=${PROXY_FILE:-$ERA_JSON}

INIT_GUARDIAN=false
INIT_OIDC=false
DEPLOY_VERIFIER=false
SIMULATE_ONLY=false
COMPARE_DEPLOY_OIDC=false
CHECK_PAYMASTER=false
ENSURE_PAYMASTER=false

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      usage; exit 0 ;;
    --init-guardian)
      INIT_GUARDIAN=true ;;
    --init-oidc)
      INIT_OIDC=true ;;
    --deploy-verifier)
      DEPLOY_VERIFIER=true ;;
    --simulate-only)
      SIMULATE_ONLY=true ;;
    --compare-deploy-oidc)
      COMPARE_DEPLOY_OIDC=true ;;
    --check-paymaster)
      CHECK_PAYMASTER=true ;;
    --ensure-paymaster)
      ENSURE_PAYMASTER=true ;;
    *)
      echo "Unknown arg: $arg" >&2; usage; exit 1 ;;
  esac
done

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "jq is not installed. Install it or set addresses via env (GUARDIAN_ADDR, OIDC_ADDR)." >&2
    exit 1
  fi
}

read_json_addr() {
  local key=$1
  local val
  val=$(jq -r ".$key // empty" "$ERA_JSON" 2>/dev/null || true)
  # Normalize empty/null/zero
  if [[ -z "$val" || "$val" == "null" || "$val" == 0x || "$val" == "0x0000000000000000000000000000000000000000" ]]; then
    echo ""
  else
    echo "$val"
  fi
}

# If not provided, try to read from era-sepolia.json
if [[ -z "$GUARDIAN_ADDR" || -z "$OIDC_ADDR" ]]; then
  if [[ -f "$ERA_JSON" ]]; then
    require_jq
    GUARDIAN_ADDR=${GUARDIAN_ADDR:-$(read_json_addr recovery)}
    OIDC_ADDR=${OIDC_ADDR:-$(read_json_addr recoveryOidc)}
    PASSKEY_ADDR=${PASSKEY_ADDR:-$(read_json_addr passkey)}
    OIDC_KEY_REGISTRY_ADDR=${OIDC_KEY_REGISTRY_ADDR:-$(read_json_addr oidcKeyRegistry)}
    OIDC_VERIFIER_ADDR=${OIDC_VERIFIER_ADDR:-$(read_json_addr oidcVerifier)}
  else
    echo "Warning: $ERA_JSON not found. Provide GUARDIAN_ADDR and OIDC_ADDR via env." >&2
  fi
fi

echo "Using RPC_URL:      $RPC_URL"
echo "Guardian Validator: ${GUARDIAN_ADDR:-<unset>}"
echo "OIDC Validator:     ${OIDC_ADDR:-<unset>}"
echo "Paymaster:          ${PAYMASTER_ADDR:-<unset>}"
if [[ -n "$ACCOUNT_ADDR" ]]; then
  echo "SSO Account:        $ACCOUNT_ADDR"
fi
if [[ "$INIT_GUARDIAN" == true || "$INIT_OIDC" == true ]]; then
  echo "Init flags:         guardian=$INIT_GUARDIAN, oidc=$INIT_OIDC, deployVerifier=$DEPLOY_VERIFIER"
fi
echo

have_code() {
  local addr=$1
  if [[ -z "$addr" ]]; then
    return 1
  fi
  local code
  code=$(cast code --rpc-url "$RPC_URL" "$addr")
  if [[ "$code" == 0x || -z "$code" ]]; then
    echo "No code at $addr"
    return 1
  fi
  return 0
}

read_guardian() {
  [[ -z "${GUARDIAN_ADDR}" ]] && return 0
  echo "=== GuardianRecoveryValidator @ ${GUARDIAN_ADDR} ==="
  have_code "$GUARDIAN_ADDR" || { echo; return 0; }
  local wav
  wav=$(cast call --rpc-url "$RPC_URL" "$GUARDIAN_ADDR" "webAuthValidator()(address)")
  echo "webAuthValidator: $wav"
  if [[ -n "${ACCOUNT_ADDR}" ]]; then
    local installed
    if installed=$(cast call --rpc-url "$RPC_URL" "$ACCOUNT_ADDR" "isModuleValidator(address)(bool)" "$wav" 2>/dev/null); then
      echo "isModuleValidator(account=$ACCOUNT_ADDR, webAuthValidator): $installed"
    else
      echo "isModuleValidator call failed on $ACCOUNT_ADDR (ensure this is an SsoAccount)"
    fi
  fi
  echo
}

read_oidc() {
  [[ -z "${OIDC_ADDR}" ]] && return 0
  echo "=== OidcRecoveryValidator @ ${OIDC_ADDR} ==="
  have_code "$OIDC_ADDR" || { echo; return 0; }
  local wav kr vr
  wav=$(cast call --rpc-url "$RPC_URL" "$OIDC_ADDR" "webAuthValidator()(address)")
  kr=$(cast call --rpc-url "$RPC_URL" "$OIDC_ADDR" "keyRegistry()(address)")
  vr=$(cast call --rpc-url "$RPC_URL" "$OIDC_ADDR" "verifier()(address)")
  echo "webAuthValidator: $wav"
  echo "keyRegistry:      $kr"
  echo "verifier:         $vr"
  if [[ -n "${ACCOUNT_ADDR}" ]]; then
    local installed
    if installed=$(cast call --rpc-url "$RPC_URL" "$ACCOUNT_ADDR" "isModuleValidator(address)(bool)" "$wav" 2>/dev/null); then
      echo "isModuleValidator(account=$ACCOUNT_ADDR, webAuthValidator): $installed"
    else
      echo "isModuleValidator call failed on $ACCOUNT_ADDR (ensure this is an SsoAccount)"
    fi
  fi
  echo
}

# Do the reads
read_guardian
read_oidc

# ===================== Paymaster Inspection =====================
paymaster_check() {
  [[ -z "$PAYMASTER_ADDR" ]] && { echo "No PAYMASTER_ADDR provided; skipping paymaster check"; return 0; }
  echo "=== Paymaster @ $PAYMASTER_ADDR ==="
  if ! have_code "$PAYMASTER_ADDR"; then
    echo "No code at paymaster address"; return 1; fi

  # Query on-chain constants used as getters
  local f s r p o
  set +e
  f=$(cast call --rpc-url "$RPC_URL" "$PAYMASTER_ADDR" "AA_FACTORY_CONTRACT_ADDRESS()(address)" 2>/dev/null)
  s=$(cast call --rpc-url "$RPC_URL" "$PAYMASTER_ADDR" "SESSION_KEY_VALIDATOR_CONTRACT_ADDRESS()(address)" 2>/dev/null)
  r=$(cast call --rpc-url "$RPC_URL" "$PAYMASTER_ADDR" "ACCOUNT_RECOVERY_VALIDATOR_CONTRACT_ADDRESS()(address)" 2>/dev/null)
  p=$(cast call --rpc-url "$RPC_URL" "$PAYMASTER_ADDR" "WEB_AUTH_VALIDATOR_CONTRACT_ADDRESS()(address)" 2>/dev/null)
  o=$(cast call --rpc-url "$RPC_URL" "$PAYMASTER_ADDR" "OIDC_RECOVERY_VALIDATOR_CONTRACT_ADDRESS()(address)" 2>/dev/null)
  set -e
  echo "Factory:        $f"
  echo "Session:        $s"
  echo "Recovery:       $r"
  echo "Passkey:        $p"
  echo "OIDC Recovery:  $o"

  # Expected from proxy file if present
  local expectedFactory expectedSession expectedRecovery expectedPasskey expectedOidc
  if [[ -f "$PROXY_FILE" ]]; then
    require_jq
    expectedFactory=$(jq -r '.accountFactory // empty' "$PROXY_FILE")
    expectedSession=$(jq -r '.session // empty' "$PROXY_FILE")
    expectedRecovery=$(jq -r '.recovery // empty' "$PROXY_FILE")
    expectedPasskey=$(jq -r '.passkey // empty' "$PROXY_FILE")
    expectedOidc=$(jq -r '.recoveryOidc // empty' "$PROXY_FILE")
    echo "Expected (from $PROXY_FILE):"
    echo "  Factory:       ${expectedFactory:-<unset>}"
    echo "  Session:       ${expectedSession:-<unset>}"
    echo "  Recovery:      ${expectedRecovery:-<unset>}"
    echo "  Passkey:       ${expectedPasskey:-<unset>}"
    echo "  OIDC Recovery: ${expectedOidc:-<unset>}"
  fi

  local mismatch=false
  [[ -n "$expectedFactory" && "${f,,}" != "${expectedFactory,,}" ]] && { echo "✗ Factory mismatch"; mismatch=true; }
  [[ -n "$expectedSession" && "${s,,}" != "${expectedSession,,}" ]] && { echo "✗ Session mismatch"; mismatch=true; }
  [[ -n "$expectedRecovery" && "${r,,}" != "${expectedRecovery,,}" ]] && { echo "✗ Recovery mismatch"; mismatch=true; }
  [[ -n "$expectedPasskey" && "${p,,}" != "${expectedPasskey,,}" ]] && { echo "✗ Passkey mismatch"; mismatch=true; }
  [[ -n "$expectedOidc" && "${o,,}" != "${expectedOidc,,}" ]] && { echo "✗ OIDC Recovery mismatch"; mismatch=true; }

  # Balance check
  local balanceWei balanceEth
  balanceWei=$(cast balance --rpc-url "$RPC_URL" "$PAYMASTER_ADDR")
  # Convert to ETH units
  balanceEth=$(cast --from-wei "$balanceWei")
  echo "Balance:        $balanceEth ETH";
  # Compare as floats using bc if present
  if command -v bc >/dev/null 2>&1; then
    if [[ $(echo "$balanceEth < $MIN_PAYMASTER_BALANCE" | bc -l) == 1 ]]; then
      echo "✗ Balance below threshold ($MIN_PAYMASTER_BALANCE ETH)"; mismatch=true;
    fi
  fi

  if [[ "$mismatch" == true ]]; then
    return 2
  fi
  echo "✓ Paymaster configuration looks consistent"
  return 0
}

if [[ "$CHECK_PAYMASTER" == true || "$ENSURE_PAYMASTER" == true ]]; then
  echo
  echo "--- Paymaster Verification ---"
  if paymaster_check; then
    echo "Paymaster check completed.";
  else
    status=$?
    if [[ $status -eq 1 ]]; then
      echo "Paymaster absent or no code.";
    elif [[ $status -eq 2 ]]; then
      echo "Paymaster mismatch detected.";
    fi
    if [[ "$ENSURE_PAYMASTER" == true ]]; then
      echo "Attempting new paymaster deployment (ensure mode).";
      if [[ ! -f "$PROXY_FILE" ]]; then
        echo "Cannot deploy new paymaster: proxy file $PROXY_FILE missing" >&2; exit 1; fi
      require_jq
      FACTORY_ADDR=${FACTORY_ADDR:-$(jq -r '.accountFactory // empty' "$PROXY_FILE")}
      if [[ -z "$FACTORY_ADDR" ]]; then echo "Factory address missing for deployment"; exit 1; fi
      echo "Deploying via hardhat task deploy-new-paymaster...";
      (cd "$CONTRACTS_DIR" && npx hardhat deploy-new-paymaster \
        --network zkSyncSepoliaTestnet \
        --factory "$FACTORY_ADDR" \
        --proxyfile "$PROXY_FILE" \
        --fund 0.1 || { echo "Deployment failed"; exit 1; })
    fi
  fi
fi

cat <<'EOF'
Hints:
- If webAuthValidator returns 0x000...000, the validator was likely not initialized.
- Initialize on the PROXY address (if using proxies). Examples:

# GuardianRecoveryValidator initialize (requires admin key):
# cast send "$GUARDIAN_ADDR" "initialize(address)" <WEB_AUTH_VALIDATOR_ADDR> \
#   --private-key $PK --rpc-url "$RPC_URL"

# OidcRecoveryValidator initialize (requires admin key):
# cast send "$OIDC_ADDR" "initialize(address,address,address)" <KEY_REGISTRY> <VERIFIER> <WEB_AUTH_VALIDATOR_ADDR> \
#   --private-key $PK --rpc-url "$RPC_URL"

# Check EIP-1967 implementation slot on a proxy (optional):
# IMPLEMENTATION_SLOT=0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC
# cast storage <PROXY_ADDR> $IMPLEMENTATION_SLOT --rpc-url "$RPC_URL"
EOF

# Perform initialization if requested
if [[ "$INIT_GUARDIAN" == true || "$INIT_OIDC" == true ]]; then
  echo
  echo "--- Initializing validators via Hardhat ---"
  # Ensure we are in contracts dir for hardhat context
  cd "$CONTRACTS_DIR"
  # Export env for the TS script
  export GUARDIAN_ADDR OIDC_ADDR PASSKEY_ADDR OIDC_KEY_REGISTRY_ADDR OIDC_VERIFIER_ADDR
  # Network selection: use zkSyncSepoliaTestnet when RPC points to sepolia
  NETWORK="zkSyncSepoliaTestnet"
  # Set environment flags for the TS script
  export INIT_GUARDIAN INIT_OIDC DEPLOY_VERIFIER SIMULATE_ONLY COMPARE_DEPLOY_OIDC
  $INIT_GUARDIAN && export INIT_GUARDIAN=1 || export INIT_GUARDIAN=0
  $INIT_OIDC && export INIT_OIDC=1 || export INIT_OIDC=0
  $DEPLOY_VERIFIER && export DEPLOY_VERIFIER=1 || export DEPLOY_VERIFIER=0
  $SIMULATE_ONLY && export SIMULATE_ONLY=1 || export SIMULATE_ONLY=0
  $COMPARE_DEPLOY_OIDC && export COMPARE_DEPLOY_OIDC=1 || export COMPARE_DEPLOY_OIDC=0
  # Run the script with hardhat runner
  npx hardhat run --network "$NETWORK" scripts/init-validators.ts
fi
