import type {Notification} from "./types.js";
import {tr} from "../i18n/index.js";
/** Only structured coordination notifications use these fixed system phrases. */
export function coordinationNotice(notice:Notification,field:"title"|"message") {
  if(notice.referenceType!=="coordination")return notice[field];
  const keys:Record<string,string>={"Bureau coordination update":"noticeTitle","A coordination record requires your attention.":"noticeMessage","Coordination task reminder":"reminderTitle","A coordination task is overdue.":"reminderOverdue","A coordination task is approaching its requested date.":"reminderSoon"};
  const key=keys[notice[field]];return key?tr("workflow:crossBureau."+key):notice[field];
}
