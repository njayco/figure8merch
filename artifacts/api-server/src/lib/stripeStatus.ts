type StripeStatus = "initializing" | "ready" | "failed";

let _status: StripeStatus = "initializing";
let _error: string | undefined;

export function setStripeStatus(status: StripeStatus, error?: string): void {
  _status = status;
  _error = error;
}

export function getStripeStatus(): { status: StripeStatus; error?: string } {
  return { status: _status, error: _error };
}
