// Bump on every change to the negotiation edge functions. The admin console compares it with
// the version the frontend expects and warns when a function still runs older code
// (GitHub pushes do not redeploy Lovable edge functions by themselves).
export const NEGOTIATION_API_VERSION = "2026-10-27.1";
