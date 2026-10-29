export interface ReportFilter{institution?:string;region?:string;unknownRegion?:boolean;bureau?:string;status?:string;caseType?:string;source?:string;receivedFrom?:string;receivedTo?:string}
export interface ReportRow{id:string;reference:string;institutionId:string;institution:string;region:string|null;bureau:string;status:string;priority:string;caseType:string|null;source:string|null;receivedDate:string;deadline:string}
export interface ReportData{generatedAt:string;filters:ReportFilter;total:number;missing:{region:number;caseType:number;source:number;receivedDate:number};regions:{region:string|null;count:number}[];rows:ReportRow[]}
export interface ReportSchedule{id:string;ownerId:string;version:number;name:string;enabled:boolean;frequency:"monthly"|"quarterly";basis:"calendar"|"financial";filters:ReportFilter;createdAt:string;updatedAt:string}
export interface ReportPack{id:string;key:string;scheduleId:string;scheduleVersion:number;ownerId:string;period:{from:string;to:string;label:string};createdAt:string;data:ReportData}
export interface ReportDownload{id:string;packId:string;actorId:string;format:"csv"|"xlsx"|"pdf";createdAt:string}
