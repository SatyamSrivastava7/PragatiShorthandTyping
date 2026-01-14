import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
  var sessionDbPool: Pool | undefined;
}

export {};
