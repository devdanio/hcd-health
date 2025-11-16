/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as channelDefinitions from "../channelDefinitions.js";
import type * as channelResolver from "../channelResolver.js";
import type * as companies from "../companies.js";
import type * as contacts from "../contacts.js";
import type * as http from "../http.js";
import type * as tracking from "../tracking.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  channelDefinitions: typeof channelDefinitions;
  channelResolver: typeof channelResolver;
  companies: typeof companies;
  contacts: typeof contacts;
  http: typeof http;
  tracking: typeof tracking;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
