export interface EventEnvelope<T = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  version: '1.0';
  occurred_at: string;
  payload: T;
}
