export interface MergeProposal {
  id: string; sourceId: string; canonicalId: string; actorId: string; reason: string;
  requestId: string; preparedAt: string; expiresAt: string; preparedHash: string;
}
export interface CaseMerge {
  id: string; proposalId: string; sourceId: string; canonicalId: string; actorId: string; reason: string;
  createdAt: string; preparedHash: string; preservedCaseIds: string[];
}
export interface MergeReversal {
  id: string; mergeId: string; actorId: string; reason: string; requestId: string; createdAt: string;
}
