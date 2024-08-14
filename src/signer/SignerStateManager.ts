import type { StateUpdateListener } from './interface.js';
import type { AddressString, Chain } from '../core/type/index.js';
import { ScopedLocalStorage } from '../util/ScopedLocalStorage.js';
import type { SessionData } from '../core/provider/interface.js';

const ACCOUNTS_KEY = 'accounts';
const SESSION_KEY = 'session';
const ACTIVE_CHAIN_STORAGE_KEY = 'activeChain';
const AVAILABLE_CHAINS_STORAGE_KEY = 'availableChains';
const WALLET_CAPABILITIES_STORAGE_KEY = 'walletCapabilities';

export class SignerStateManager {
  private readonly storage = new ScopedLocalStorage('SignerStateManager');
  private readonly updateListener: StateUpdateListener;

  private availableChains?: Chain[];
  private _walletCapabilities?: Record<`0x${string}`, Record<string, unknown>>;
  private _accounts: AddressString[];
  private _session: SessionData | undefined;
  private _activeChain: Chain;
  get accounts() {
    return this._accounts;
  }
  get session() {
    return this._session;
  }
  get activeChain() {
    return this._activeChain;
  }
  get walletCapabilities() {
    return this._walletCapabilities;
  }

  constructor(params: { updateListener: StateUpdateListener; appChainIds: number[] }) {
    this.updateListener = params.updateListener;

    this.availableChains = this.loadItemFromStorage(AVAILABLE_CHAINS_STORAGE_KEY);
    this._walletCapabilities = this.loadItemFromStorage(WALLET_CAPABILITIES_STORAGE_KEY);
    const accounts = this.loadItemFromStorage<AddressString[]>(ACCOUNTS_KEY);
    const session = this.loadItemFromStorage<SessionData>(SESSION_KEY);
    const chain = this.loadItemFromStorage<Chain>(ACTIVE_CHAIN_STORAGE_KEY);
    this._accounts = accounts || [];
    this._session = session;
    this._activeChain = chain || { id: params.appChainIds[0]! };
  }

  updateAccounts(accounts: AddressString[]) {
    this._accounts = accounts;
    this.storeItemToStorage(ACCOUNTS_KEY, accounts);
    this.updateListener.onAccountsUpdate(accounts);
  }

  updateSession(session: SessionData) {
    this._session = session;
    this.storeItemToStorage(SESSION_KEY, session);
  }

  switchChain(chainId: number): boolean {
    const chain = this.availableChains?.find((chain) => chain.id === chainId);
    if (!chain) return false;
    if (chain === this._activeChain) return true;

    this._activeChain = chain;
    this.storeItemToStorage(ACTIVE_CHAIN_STORAGE_KEY, chain);
    this.updateListener.onChainUpdate(chain);
    return true;
  }

  updateAvailableChains(rawChains: { [key: number]: string }) {
    if (!rawChains || Object.keys(rawChains).length === 0) return;

    const chains = Object.entries(rawChains).map(([id, rpcUrl]) => ({ id: Number(id), rpcUrl }));
    this.availableChains = chains;
    this.storeItemToStorage(AVAILABLE_CHAINS_STORAGE_KEY, chains);

    this.switchChain(this._activeChain.id);
  }

  updateWalletCapabilities(capabilities: Record<`0x${string}`, Record<string, unknown>>) {
    this._walletCapabilities = capabilities;
    this.storeItemToStorage(WALLET_CAPABILITIES_STORAGE_KEY, capabilities);
  }

  private storeItemToStorage<T>(key: string, item: T) {
    this.storage.setItem(key, JSON.stringify(item));
  }

  private loadItemFromStorage<T>(key: string): T | undefined {
    const item = this.storage.getItem(key);
    return item ? JSON.parse(item) : undefined;
  }

  clear() {
    this.storage.clear();
  }
}
