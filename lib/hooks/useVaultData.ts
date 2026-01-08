'use client';

import { useState, useEffect } from 'react';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, type Hex } from 'viem';
import { GuardianSBTABI } from '@/lib/abis/GuardianSBT';
import { SpendVaultABI } from '@/lib/abis/SpendVault';

export interface Guardian {
    address: Address;
    tokenId: bigint;
    addedAt: number;
    blockNumber: bigint;
    txHash: Hex;
}

export interface WithdrawalEvent {
    token: Address;
    recipient: Address;
    amount: bigint;
    reason: string;
    timestamp: number;
    blockNumber: bigint;
    txHash: Hex;
}

export interface DepositEvent {
    token: Address;
    from: Address;
    amount: bigint;
    timestamp: number;
    blockNumber: bigint;
    txHash: Hex;
}

/**
 * Hook to fetch all current guardians for a vault
 */
export function useGuardians(guardianTokenAddress?: Address) {
    const publicClient = usePublicClient();
    const { data: currentBlock } = useBlockNumber();
    const [guardians, setGuardians] = useState<Guardian[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchGuardians() {
            if (!guardianTokenAddress || !publicClient || !currentBlock) {
                setGuardians([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Fetch all Transfer events (mints have from=0x0)
                const fromBlock = currentBlock - 100000n > 0n ? currentBlock - 100000n : 0n;
                
                const transferLogs = await publicClient.getLogs({
                    address: guardianTokenAddress,
                    event: {
                        type: 'event',
                        name: 'Transfer',
                        inputs: [
                            { type: 'address', indexed: true, name: 'from' },
                            { type: 'address', indexed: true, name: 'to' },
                            { type: 'uint256', indexed: true, name: 'tokenId' },
                        ],
                    },
                    fromBlock,
                    toBlock: 'latest',
                });

                // Filter for mints (from = 0x0) and check if still owned
                const guardianMap = new Map<string, Guardian>();

                for (const log of transferLogs) {
                    const { from, to, tokenId } = log.args as any;
                    
                    // Minting event
                    if (from === '0x0000000000000000000000000000000000000000') {
                        const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
                        
                        // Check if guardian still has the token
                        try {
                            const balance = await publicClient.readContract({
                                address: guardianTokenAddress,
                                abi: GuardianSBTABI,
                                functionName: 'balanceOf',
                                args: [to],
                            });

                            if ((balance as bigint) > 0n) {
                                guardianMap.set(to.toLowerCase(), {
                                    address: to as Address,
                                    tokenId: tokenId as bigint,
                                    addedAt: Number(block.timestamp) * 1000,
                                    blockNumber: log.blockNumber,
                                    txHash: log.transactionHash as Hex,
                                });
                            }
                        } catch (err) {
                            console.error('Error checking guardian balance:', err);
                        }
                    }
                    // Burning event
                    else if (to === '0x0000000000000000000000000000000000000000') {
                        guardianMap.delete(from.toLowerCase());
                    }
                }

                const guardianList = Array.from(guardianMap.values())
                    .sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

                setGuardians(guardianList);
            } catch (err) {
                console.error('Error fetching guardians:', err);
                setError(err instanceof Error ? err : new Error('Failed to fetch guardians'));
            } finally {
                setIsLoading(false);
            }
        }

        fetchGuardians();
    }, [guardianTokenAddress, publicClient, currentBlock]);

    return { guardians, isLoading, error };
}

/**
 * Hook to fetch withdrawal history
 */
export function useWithdrawalHistory(vaultAddress?: Address, limit = 50) {
    const publicClient = usePublicClient();
    const { data: currentBlock } = useBlockNumber();
    const [withdrawals, setWithdrawals] = useState<WithdrawalEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchWithdrawals() {
            if (!vaultAddress || !publicClient || !currentBlock) {
                setWithdrawals([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const fromBlock = currentBlock - 100000n > 0n ? currentBlock - 100000n : 0n;
                
                const withdrawalLogs = await publicClient.getLogs({
                    address: vaultAddress,
                    event: {
                        type: 'event',
                        name: 'Withdrawn',
                        inputs: [
                            { type: 'address', indexed: true, name: 'token' },
                            { type: 'address', indexed: true, name: 'recipient' },
                            { type: 'uint256', indexed: false, name: 'amount' },
                            { type: 'string', indexed: false, name: 'reason' },
                        ],
                    },
                    fromBlock,
                    toBlock: 'latest',
                });

                const withdrawalEvents: WithdrawalEvent[] = [];

                for (const log of withdrawalLogs.slice(-limit)) {
                    const { token, recipient, amount, reason } = log.args as any;
                    const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

                    withdrawalEvents.push({
                        token: token as Address,
                        recipient: recipient as Address,
                        amount: amount as bigint,
                        reason: reason as string,
                        timestamp: Number(block.timestamp) * 1000,
                        blockNumber: log.blockNumber,
                        txHash: log.transactionHash as Hex,
                    });
                }

                setWithdrawals(withdrawalEvents.reverse());
            } catch (err) {
                console.error('Error fetching withdrawals:', err);
                setError(err instanceof Error ? err : new Error('Failed to fetch withdrawals'));
            } finally {
                setIsLoading(false);
            }
        }

        fetchWithdrawals();
    }, [vaultAddress, publicClient, currentBlock, limit]);

    return { withdrawals, isLoading, error };
}

/**
 * Hook to fetch deposit history
 */
export function useDepositHistory(vaultAddress?: Address, limit = 50) {
    const publicClient = usePublicClient();
    const { data: currentBlock } = useBlockNumber();
    const [deposits, setDeposits] = useState<DepositEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        async function fetchDeposits() {
            if (!vaultAddress || !publicClient || !currentBlock) {
                setDeposits([]);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const fromBlock = currentBlock - 100000n > 0n ? currentBlock - 100000n : 0n;
                
                const depositLogs = await publicClient.getLogs({
                    address: vaultAddress,
                    event: {
                        type: 'event',
                        name: 'Deposited',
                        inputs: [
                            { type: 'address', indexed: true, name: 'token' },
                            { type: 'address', indexed: true, name: 'from' },
                            { type: 'uint256', indexed: false, name: 'amount' },
                        ],
                    },
                    fromBlock,
                    toBlock: 'latest',
                });

                const depositEvents: DepositEvent[] = [];

                for (const log of depositLogs.slice(-limit)) {
                    const { token, from, amount } = log.args as any;
                    const block = await publicClient.getBlock({ blockNumber: log.blockNumber });

                    depositEvents.push({
                        token: token as Address,
                        from: from as Address,
                        amount: amount as bigint,
                        timestamp: Number(block.timestamp) * 1000,
                        blockNumber: log.blockNumber,
                        txHash: log.transactionHash as Hex,
                    });
                }

                setDeposits(depositEvents.reverse());
            } catch (err) {
                console.error('Error fetching deposits:', err);
                setError(err instanceof Error ? err : new Error('Failed to fetch deposits'));
            } finally {
                setIsLoading(false);
            }
        }

        fetchDeposits();
    }, [vaultAddress, publicClient, currentBlock, limit]);

    return { deposits, isLoading, error };
}

/**
 * Hook to get all activity (deposits, withdrawals, guardian changes)
 */
export function useVaultActivity(vaultAddress?: Address, guardianTokenAddress?: Address, limit = 50) {
    const { deposits, isLoading: depositsLoading } = useDepositHistory(vaultAddress, limit);
    const { withdrawals, isLoading: withdrawalsLoading } = useWithdrawalHistory(vaultAddress, limit);
    const { guardians, isLoading: guardiansLoading } = useGuardians(guardianTokenAddress);

    const [activities, setActivities] = useState<any[]>([]);
    const isLoading = depositsLoading || withdrawalsLoading || guardiansLoading;

    useEffect(() => {
        const allActivities = [
            ...deposits.map(d => ({
                type: 'deposit' as const,
                timestamp: d.timestamp,
                blockNumber: d.blockNumber,
                data: d,
            })),
            ...withdrawals.map(w => ({
                type: 'withdrawal' as const,
                timestamp: w.timestamp,
                blockNumber: w.blockNumber,
                data: w,
            })),
            ...guardians.map(g => ({
                type: 'guardian_added' as const,
                timestamp: g.addedAt,
                blockNumber: g.blockNumber,
                data: g,
            })),
        ];

        allActivities.sort((a, b) => b.timestamp - a.timestamp);
        setActivities(allActivities.slice(0, limit));
    }, [deposits, withdrawals, guardians, limit]);

    return { activities, isLoading };
}
