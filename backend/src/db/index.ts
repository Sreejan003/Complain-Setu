import type { IRepository } from "./repository.js";
import { store } from "./store.js";

/** Health and operational routes use the same authoritative unit of work. The legacy SQL adapter is not selected independently. */
export function getRepository(): IRepository { return store; }
export const repository = getRepository();
export type { IRepository };
