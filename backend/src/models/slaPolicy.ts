export interface SlaPolicy{
  id:string;name:string;enabled:boolean;precedence:number;effectiveFrom:string;effectiveTo?:string;
  categories:string[];caseTypes:string[];sources:string[];priorities:string[];
  days:number;calendar:"calendar"|"business";timezone:string;holidays:string[];
  startBasis:"received_date"|"source_received_date";allowedPauseReasons:string[];
  reference?:string; // Supplied metadata only; not a verified legal basis.
}
export interface SlaPolicyConfiguration{
  id:string;version:number;changedBy:string;changedAt:string;reason:string;rollbackOf?:number;policies:SlaPolicy[];
  reminderDays:number[];inactivityDays:number;cooldownHours:number;duplicateStorm:{enabled:boolean;windowDays:number;threshold:number};
}
export interface CaseSla{
  version:number;configurationVersion:number;policy:SlaPolicy;startDate:string;baseDeadline:string;
  manualDeadline:boolean;creditedPauseDays?:number;pauses:{from:string;to?:string;reason:string;actorId:string;calendar?:"calendar"|"business";holidays?:string[];timezone?:string}[];
  history:{at:string;actorId:string;action:string;reason:string;previousDeadline?:string;deadline:string;configurationVersion:number}[];
}
export type SlaAlertKind="T-7"|"T-3"|"T-1"|"DueToday"|"Overdue"|"NoAction"|"DuplicateStorm";
export interface SlaAlert{
  id:string;key:string;kind:SlaAlertKind;caseIds:string[];recipientId:string;configurationVersion:number;
  createdAt:string;lastNotifiedAt:string;notificationCount:number;acknowledgedAt?:string;acknowledgedBy?:string;
}
export interface SlaDelivery{
  id:string;alertId:string;recipientId:string;channel:"email"|"sms";status:"pending"|"simulated"|"disabled"|"failed";
  attempts:number;createdAt:string;updatedAt:string;nextAttemptAt?:string;errorCode?:string;
  history?:{at:string;attempt:number;status:"simulated"|"disabled"|"failed";errorCode?:string}[];
}
