import { LedgerError } from '../../shared/errors/ledger-errors';
import { EntryLineDto } from '../dto/post-journal.dto';

export function checkDoubleEntry(entries: EntryLineDto[]): void {
  const netByCurrency = new Map<string, bigint>();

  for (const entry of entries) {
    const currency = entry.currency.toUpperCase();
    const prev = netByCurrency.get(currency) ?? 0n;
    const delta =
      entry.direction === 'DEBIT' ? BigInt(entry.amount) : -BigInt(entry.amount);
    netByCurrency.set(currency, prev + delta);
  }

  for (const [currency, net] of netByCurrency) {
    if (net !== 0n) {
      throw new LedgerError('INVARIANT_VIOLATION', { currency });
    }
  }
}
