export interface AuditChainEntry{sequence:number;auditId:string;eventHash:string;previousHash:string;hash:string;}
export interface AuditCheckpoint{id:string;sequence:number;hash:string;genesisHash:string;legacyDigest:string;createdAt:string;createdBy:string;}
export interface AuditIntegrity{schema:"sha256-global-v1";scope:"operational-global";legacyCount:number;legacyDigest:string;genesisHash:string;entries:AuditChainEntry[];checkpoints:AuditCheckpoint[];}
