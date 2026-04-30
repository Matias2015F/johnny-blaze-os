/* global __APP_BUILD_VERSION__, __APP_BUILD_SHA__, __APP_BUILD_TIME__ */
export const APP_BUILD = {
  version: typeof __APP_BUILD_VERSION__ !== "undefined" ? __APP_BUILD_VERSION__ : "1.0.0-dev",
  sha: typeof __APP_BUILD_SHA__ !== "undefined" ? __APP_BUILD_SHA__ : "dev",
  buildTime: typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : new Date(0).toISOString(),
};
