import type{SlaDelivery}from"../models/slaPolicy.js";
/** Interfaces deliberately exclude message text, phone numbers and credentials from the persistent fixture. */
export interface NotificationAdapter{channel:"email"|"sms";send(delivery:Readonly<SlaDelivery>):{status:"simulated"|"disabled"|"failed";errorCode?:string};}
export class DevelopmentNotificationAdapter implements NotificationAdapter{
  constructor(public channel:"email"|"sms"){}
  send(_delivery:Readonly<SlaDelivery>){
    const mode=process.env.NOTIFICATION_DELIVERY_MODE||"disabled";
    if(mode==="development"&&process.env.NODE_ENV!=="production")return{status:"simulated" as const};
    return{status:"disabled" as const,errorCode:mode==="disabled"?"DELIVERY_DISABLED":"LIVE_ADAPTER_NOT_CONFIGURED"};
  }
}
