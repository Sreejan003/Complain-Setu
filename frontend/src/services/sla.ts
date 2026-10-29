export function slaDaysRemaining(deadline:string,timezone="UTC",now=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now),part=(key:string)=>parts.find(row=>row.type===key)!.value;
  return Math.round((Date.parse(deadline)-Date.parse(`${part("year")}-${part("month")}-${part("day")}`))/86400000);
}
