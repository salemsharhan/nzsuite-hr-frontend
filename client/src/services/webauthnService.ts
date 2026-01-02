import { adminApi } from './api';

/**
 * WebAuthn Service
 * Handles WebAuthn registration and authentication for attendance
 * 
 * WebAuthn uses Public-Key Cryptography:
 * - Private key: Stays in device (Secure Enclave)
 * - Public key: Stored in database
 * - Challenge-response: Server sends challenge, device signs it
 */

export interface WebAuthnCredential {
  id: string;
  employee_id: string;
  credential_id: string; // Base64 encoded credential ID
  public_key: string; // Base64 encoded public key
  counter: number; // Replay attack prevention
  device_name?: string; // User-friendly device name
  created_at: string;
  last_used_at?: string;
}

export interface WebAuthnRegistrationOptions {
  challenge: string; // Random challenge from server
  rp: {
    name: string; // Relying Party name (company name)
    id?: string; // Domain (optional, defaults to current domain)
  };
  user: {
    id: string; // Employee ID (base64 encoded)
    name: string; // Employee email or name
    displayName: string; // Employee display name
  };
  pubKeyCredParams: Array<{
    type: 'public-key';
    alg: number; // Algorithm ID (-7 for ES256, -257 for RS256)
  }>;
  authenticatorSelection?: {
    authenticatorAttachment?: 'platform' | 'cross-platform';
    userVerification?: 'required' | 'preferred' | 'discouraged';
    requireResidentKey?: boolean;
  };
  timeout?: number;
  attestation?: 'none' | 'indirect' | 'direct';
}

export interface WebAuthnAuthenticationOptions {
  challenge: string; // Random challenge from server
  allowCredentials?: Array<{
    id: string; // Credential ID (base64 encoded)
    type: 'public-key';
    transports?: ('usb' | 'nfc' | 'ble' | 'internal')[];
  }>;
  timeout?: number;
  userVerification?: 'required' | 'preferred' | 'discouraged';
}

/**
 * Generate a random challenge (base64 encoded)
 */
function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const webauthnService = {
  /**
   * Check if WebAuthn is supported in the browser
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof (window as any).PublicKeyCredential !== 'undefined' &&
           typeof navigator.credentials !== 'undefined';
  },

  /**
   * Start WebAuthn registration (Phase 1: Registration)
   * Returns the credential that needs to be sent to the server
   */
  async register(
    employeeId: string,
    employeeName: string,
    employeeEmail: string,
    companyName: string = 'HR System'
  ): Promise<{ credential: PublicKeyCredential; deviceName: string }> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser. Please use a modern browser.');
    }

    // Generate challenge
    const challenge = generateChallenge();

    // Create registration options
    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
      challenge: base64ToArrayBuffer(challenge),
      rp: {
        name: companyName,
      },
      user: {
        id: base64ToArrayBuffer(btoa(employeeId)),
        name: employeeEmail,
        displayName: employeeName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256 (Elliptic Curve)
        { type: 'public-key', alg: -257 }, // RS256 (RSA)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Prefer platform authenticators (Face ID, Touch ID, Windows Hello)
        userVerification: 'required', // Require biometric verification
        requireResidentKey: false, // Don't require resident key
      },
      timeout: 60000, // 60 seconds
      attestation: 'none', // Don't require attestation (faster, still secure)
    };

    try {
      // Request credential creation
      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions,
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Failed to create credential');
      }

      // Get device name from user
      const deviceName = await this.getDeviceName();

      return {
        credential,
        deviceName,
      };
    } catch (error: any) {
      console.error('WebAuthn registration error:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Registration cancelled or not allowed. Please try again.');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('This device is already registered. Please use a different device or remove the existing registration.');
      } else if (error.name === 'NotSupportedError') {
        throw new Error('Your device does not support WebAuthn. Please use a device with Face ID, Touch ID, Windows Hello, or a security key.');
      }
      throw new Error(`Registration failed: ${error.message || 'Unknown error'}`);
    }
  },

  /**
   * Get device name from user
   */
  async getDeviceName(): Promise<string> {
    // Try to detect device type
    const userAgent = navigator.userAgent.toLowerCase();
    let defaultName = 'Unknown Device';

    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      defaultName = 'iPhone/iPad';
    } else if (userAgent.includes('android')) {
      defaultName = 'Android Device';
    } else if (userAgent.includes('windows')) {
      defaultName = 'Windows PC';
    } else if (userAgent.includes('mac')) {
      defaultName = 'Mac';
    }

    // For now, return default. In production, you might want to prompt the user
    return defaultName;
  },

  /**
   * Save registered credential to database
   */
  async saveCredential(
    employeeId: string,
    credential: PublicKeyCredential,
    deviceName: string
  ): Promise<WebAuthnCredential> {
    const response = (credential.response as any) as AuthenticatorAttestationResponse;

    // Extract credential data
    const credentialId = arrayBufferToBase64(credential.rawId);
    const publicKey = arrayBufferToBase64(response.getPublicKey() || new ArrayBuffer(0));
    const clientDataJSON = arrayBufferToBase64(response.clientDataJSON);
    const attestationObject = arrayBufferToBase64(response.attestationObject);

    // Send to server
    // Note: Challenge verification should be done server-side before saving
    const result = await adminApi.post<WebAuthnCredential>('/webauthn_credentials', {
      employee_id: employeeId,
      credential_id: credentialId,
      public_key: publicKey,
      client_data_json: clientDataJSON,
      attestation_object: attestationObject,
      device_name: deviceName,
      counter: 0,
    });

    return result.data;
  },

  /**
   * Start WebAuthn authentication (Phase 2: Authentication)
   * Returns the assertion that needs to be sent to the server
   */
  async authenticate(employeeId: string): Promise<PublicKeyCredential> {
    if (!this.isSupported()) {
      throw new Error('WebAuthn is not supported in this browser.');
    }

    // Get user's credentials from server
    const credentials = await this.getCredentials(employeeId);

    if (credentials.length === 0) {
      throw new Error('No WebAuthn credentials found. Please register your device first.');
    }

    // Generate challenge
    const challenge = generateChallenge();

    // Create authentication options
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64ToArrayBuffer(challenge),
      allowCredentials: credentials.map(cred => ({
        id: base64ToArrayBuffer(cred.credential_id),
        type: 'public-key',
        transports: ['internal'] as AuthenticatorTransport[], // Platform authenticators
      })),
      timeout: 60000, // 60 seconds
      userVerification: 'required', // Require biometric verification
    };

    try {
      // Request credential authentication
      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      }) as PublicKeyCredential;

      if (!assertion) {
        throw new Error('Failed to authenticate');
      }

      return assertion;
    } catch (error: any) {
      console.error('WebAuthn authentication error:', error);
      if (error.name === 'NotAllowedError') {
        throw new Error('Authentication cancelled or not allowed. Please try again.');
      } else if (error.name === 'InvalidStateError') {
        throw new Error('Authentication failed. Please try again.');
      }
      throw new Error(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
  },

  /**
   * Verify authentication with server
   */
  async verifyAuthentication(
    employeeId: string,
    assertion: PublicKeyCredential,
    challenge: string
  ): Promise<{ verified: boolean; credentialId: string }> {
    const response = assertion.response as AuthenticatorAssertionResponse;

    // Extract assertion data
    const credentialId = arrayBufferToBase64(assertion.rawId);
    const clientDataJSON = arrayBufferToBase64(response.clientDataJSON);
    const authenticatorData = arrayBufferToBase64(response.authenticatorData);
    const signature = arrayBufferToBase64(response.signature);
    const userHandle = response.userHandle ? arrayBufferToBase64(response.userHandle) : null;

    // Send to server for verification
    const result = await adminApi.post<{ verified: boolean; credentialId: string }>(
      '/webauthn_credentials/verify',
      {
        employee_id: employeeId,
        credential_id: credentialId,
        client_data_json: clientDataJSON,
        authenticator_data: authenticatorData,
        signature: signature,
        user_handle: userHandle,
        challenge: challenge,
      }
    );

    return result.data;
  },

  /**
   * Get all credentials for an employee
   */
  async getCredentials(employeeId: string): Promise<WebAuthnCredential[]> {
    try {
      const response = await adminApi.get<WebAuthnCredential[]>(
        `/webauthn_credentials?employee_id=eq.${employeeId}`
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching credentials:', error);
      return [];
    }
  },

  /**
   * Delete a credential
   */
  async deleteCredential(credentialId: string): Promise<void> {
    await adminApi.delete(`/webauthn_credentials?id=eq.${credentialId}`);
  },
};

