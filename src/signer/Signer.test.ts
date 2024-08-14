import { StateUpdateListener } from './interface.js';
import { KeyManager } from './KeyManager.js';
import { Signer } from './Signer.js';
import { StateManager } from './SignerStateManager.js';
import { PopupCommunicator } from ':core/communicator/PopupCommunicator';
import { standardErrors } from ':core/error';
import { EncryptedData, RPCResponseMessage } from ':core/message';
import { AppMetadata, RequestArguments } from ':core/provider/interface';
import {
  decryptContent,
  encryptContent,
  exportKeyToHexString,
  importKeyFromHexString,
} from ':util/cipher';

jest.mock('./KeyManager');
jest.mock('./StateManager');
jest.mock(':core/communicator/PopupCommunicator', () => ({
  PopupCommunicator: jest.fn(() => ({
    postRequestAndWaitForResponse: jest.fn(),
    waitForPopupLoaded: jest.fn(),
  })),
}));
jest.mock(':util/cipher', () => ({
  decryptContent: jest.fn(),
  encryptContent: jest.fn(),
  exportKeyToHexString: jest.fn(),
  importKeyFromHexString: jest.fn(),
}));

const mockCryptoKey = {} as CryptoKey;
const encryptedData = {} as EncryptedData;
const mockChains = [10];
const mockCapabilities = {};

const mockError = standardErrors.provider.unauthorized();
const mockSuccessResponse: RPCResponseMessage = {
  id: '1-2-3-4-5',
  requestId: '1-2-3-4-5',
  sender: '0xPublicKey',
  content: { encrypted: encryptedData },
  timestamp: new Date(),
};

describe('Signer', () => {
  let signer: Signer;
  let mockMetadata: AppMetadata;
  let mockCommunicator: jest.Mocked<PopupCommunicator>;
  let mockUpdateListener: StateUpdateListener;
  let mockKeyManager: jest.Mocked<KeyManager>;
  let mockStateManager: jest.Mocked<StateManager>;

  beforeEach(() => {
    mockMetadata = {
      appName: 'test',
      appLogoUrl: null,
      appChainIds: [1],
    };
    mockCommunicator = new PopupCommunicator() as jest.Mocked<PopupCommunicator>;
    mockCommunicator.waitForPopupLoaded.mockResolvedValue({} as Window);
    mockCommunicator.postRequestAndWaitForResponse.mockResolvedValue(mockSuccessResponse);
    mockUpdateListener = {
      onAccountsUpdate: jest.fn(),
      onChainUpdate: jest.fn(),
    };
    mockKeyManager = new KeyManager() as jest.Mocked<KeyManager>;
    mockStateManager = new StateManager({
      appChainIds: [1],
      updateListener: mockUpdateListener,
    }) as jest.Mocked<StateManager>;

    (KeyManager as jest.Mock).mockImplementation(() => mockKeyManager);
    (StateManager as jest.Mock).mockImplementation(() => mockStateManager);

    (importKeyFromHexString as jest.Mock).mockResolvedValue(mockCryptoKey);
    (exportKeyToHexString as jest.Mock).mockResolvedValueOnce('0xPublicKey');
    mockKeyManager.getSharedSecret.mockResolvedValue(mockCryptoKey);
    (encryptContent as jest.Mock).mockResolvedValueOnce(encryptedData);

    signer = new Signer({
      metadata: mockMetadata,
      communicator: mockCommunicator,
      updateListener: mockUpdateListener,
    });
  });

  describe('handshake', () => {
    it('should perform a successful handshake', async () => {
      (decryptContent as jest.Mock).mockResolvedValueOnce({
        result: {
          value: ['0xAddress'],
        },
        data: {
          chains: mockChains,
          capabilities: mockCapabilities,
        },
      });

      await signer.handshake();

      expect(importKeyFromHexString).toHaveBeenCalledWith('public', '0xPublicKey');
      expect(mockKeyManager.setPeerPublicKey).toHaveBeenCalledWith(mockCryptoKey);
      expect(decryptContent).toHaveBeenCalledWith(encryptedData, mockCryptoKey);
      expect(mockStateManager.updateAvailableChains).toHaveBeenCalledWith(mockChains);
      expect(mockStateManager.updateWalletCapabilities).toHaveBeenCalledWith(mockCapabilities);
      expect(mockStateManager.updateAccounts).toHaveBeenCalledWith(['0xAddress']);
    });

    it('should throw an error if failure in response.content', async () => {
      const mockResponse: RPCResponseMessage = {
        id: '1-2-3-4-5',
        requestId: '1-2-3-4-5',
        sender: '0xPublicKey',
        content: { failure: mockError },
        timestamp: new Date(),
      };
      mockCommunicator.postRequestAndWaitForResponse.mockResolvedValue(mockResponse);

      await expect(signer.handshake()).rejects.toThrowError(mockError);
    });
  });

  describe('request', () => {
    it('should perform a successful request', async () => {
      const mockRequest: RequestArguments = {
        method: 'personal_sign',
        params: ['0xMessage', '0xAddress'],
      };
      (mockStateManager as any).activeChain = { id: 1 };

      (decryptContent as jest.Mock).mockResolvedValueOnce({
        result: {
          value: '0xSignature',
        },
      });

      const result = await signer.request(mockRequest);

      expect(encryptContent).toHaveBeenCalled();
      expect(mockCommunicator.postRequestAndWaitForResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: '0xPublicKey',
          content: { encrypted: encryptedData },
        })
      );
      expect(result).toEqual('0xSignature');
    });

    it('should throw an error if error in decrypted response', async () => {
      const mockRequest: RequestArguments = {
        method: 'personal_sign',
        params: ['0xMessage', '0xAddress'],
      };
      (mockStateManager as any).activeChain = { id: 1 };

      (decryptContent as jest.Mock).mockResolvedValueOnce({
        result: {
          error: mockError,
        },
      });

      await expect(signer.request(mockRequest)).rejects.toThrowError(mockError);
    });

    it('should update internal state for successful wallet_switchEthereumChain', async () => {
      const mockRequest: RequestArguments = {
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }],
      };
      (mockStateManager as any).activeChain = { id: 1 };

      (decryptContent as jest.Mock).mockResolvedValueOnce({
        result: {
          value: null,
        },
        data: {
          chains: mockChains,
          capabilities: mockCapabilities,
        },
      });

      await signer.request(mockRequest);

      expect(mockStateManager.updateAvailableChains).toHaveBeenCalledWith(mockChains);
      expect(mockStateManager.updateWalletCapabilities).toHaveBeenCalledWith(mockCapabilities);
      expect(mockStateManager.switchChain).toHaveBeenCalledWith(1);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await signer.disconnect();

      expect(mockKeyManager.clear).toHaveBeenCalled();
      expect(mockStateManager.clear).toHaveBeenCalled();
    });
  });
});
