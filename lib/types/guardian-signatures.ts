/**
 * Types for Guardian Signature Management
 */

export interface WithdrawalRequest {
    token: `0x${string}`;
    amount: bigint;
    recipient: `0x${string}`;
    nonce: bigint;
    reason: string;
}

export interface SignedWithdrawal {
    request: WithdrawalRequest;
    signature: `0x${string}`;
    signer: `0x${string}`;
    signedAt: number;
}

export interface PendingWithdrawalRequest {
    id: string;
    vaultAddress: `0x${string}`;
    request: WithdrawalRequest;
    signatures: SignedWithdrawal[];
    requiredQuorum: number;
    createdAt: number;
    createdBy: `0x${string}`;
    status: 'pending' | 'approved' | 'executed' | 'rejected';
    executedAt?: number;
    executionTxHash?: `0x${string}`;
}

export interface GuardianSignatureStatus {
    address: `0x${string}`;
    hasToken: boolean;
    hasSigned: boolean;
    signature?: `0x${string}`;
    signedAt?: number;
}

export interface SignatureVerificationResult {
    isValid: boolean;
    signer: `0x${string}`;
    isGuardian: boolean;
    isDuplicate: boolean;
    error?: string;
}
