export const IMPORT_FIELDS = ["recordKind","caseTypeId","category","sourceChannelId","externalReference","sourceReceivedDate","bureauId","institutionText","locationHint","title","description","priority","programme","sourceNote","identifierNamespace","identifierValue"] as const;
export type ImportField = typeof IMPORT_FIELDS[number];
export interface ImportRow {
  number: number; values: Partial<Record<ImportField,string>>; errors: string[];
  status: "Invalid"|"Ready"|"Imported"|"Duplicate"|"Failed"; intakeId?: string;
}
export interface ImportRun {
  id:string;version:number;ownerId:string;ownerBureau?:string;ownerRegion?:string;
  format:"csv"|"xlsx"|"email_simulation";batchKey:string;payloadDigest:string;configurationVersion:number;
  status:"Preview"|"Partial"|"Completed";rows:ImportRow[];createdAt:string;updatedAt:string;
}
export interface ImportReceipt {
  id:string;ownerId:string;sourceChannelId:string;referenceKey:string;contentHash:string;
  intakeId:string;runId:string;rowNumber:number;createdAt:string;
}
