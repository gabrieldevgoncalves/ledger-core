/**
 * Demo seed for ledger-core development.
 *
 * Accounts (12): USD operating + BRL
 * Journals (10): capital injection, deposits, fees, FX conversion, reversal
 * FX rates (3): USD/BRL, USD/EUR, USD/GBP
 *
 * All amounts in minor units (cents for USD, centavos for BRL).
 * Re-runnable: upsert for accounts/fx-rates, ON CONFLICT DO NOTHING for journals/entries.
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter } as any);

// ── Account IDs ────────────────────────────────────────────────────────────
const CASH_OP   = '01ACCT00000000000000000001'; // ASSET     USD  Cash — Operating Account
const CASH_RV   = '01ACCT00000000000000000002'; // ASSET     USD  Cash — Reserve Account
const AR        = '01ACCT00000000000000000003'; // ASSET     USD  Accounts Receivable
const CUST_DEP  = '01ACCT00000000000000000004'; // LIABILITY USD  Customer Deposits
const FEES_PAY  = '01ACCT00000000000000000005'; // LIABILITY USD  Fees Payable
const TXN_FEES  = '01ACCT00000000000000000006'; // REVENUE   USD  Transaction Fees
const FX_REV    = '01ACCT00000000000000000007'; // REVENUE   USD  FX Revenue
const PROC_CST  = '01ACCT00000000000000000008'; // EXPENSE   USD  Processing Costs
const FX_EXP    = '01ACCT00000000000000000009'; // EXPENSE   USD  FX Expense
const OWN_CAP   = '01ACCT00000000000000000010'; // EQUITY    USD  Owner Capital
const CAIXA_BRL = '01ACCT00000000000000000011'; // ASSET     BRL  Caixa BRL
const DEP_BRL   = '01ACCT00000000000000000012'; // LIABILITY BRL  Depósitos de Clientes BRL

// ── Journal IDs ────────────────────────────────────────────────────────────
const J1  = '01JRNL00000000000000000001';
const J2  = '01JRNL00000000000000000002';
const J3  = '01JRNL00000000000000000003';
const J4  = '01JRNL00000000000000000004';
const J5  = '01JRNL00000000000000000005';
const J6  = '01JRNL00000000000000000006';
const J7  = '01JRNL00000000000000000007';
const J8  = '01JRNL00000000000000000008';
const J9  = '01JRNL00000000000000000009';
const J10 = '01JRNL00000000000000000010';

// ── Entry IDs ──────────────────────────────────────────────────────────────
// J1: DEBIT Cash Op 100000000, CREDIT Owner Capital 100000000
const E01 = '01ENTR00000000000000000001';
const E02 = '01ENTR00000000000000000002';
// J2: DEBIT Cash Op 5000000, CREDIT Customer Deposits 5000000
const E03 = '01ENTR00000000000000000003';
const E04 = '01ENTR00000000000000000004';
// J3: DEBIT AR 50000, CREDIT Transaction Fees 50000
const E05 = '01ENTR00000000000000000005';
const E06 = '01ENTR00000000000000000006';
// J4: DEBIT Cash Op 50000, CREDIT AR 50000
const E07 = '01ENTR00000000000000000007';
const E08 = '01ENTR00000000000000000008';
// J5: DEBIT Processing Costs 10000, CREDIT Fees Payable 10000
const E09 = '01ENTR00000000000000000009';
const E10 = '01ENTR00000000000000000010';
// J6: DEBIT Fees Payable 10000, CREDIT Cash Op 10000
const E11 = '01ENTR00000000000000000011';
const E12 = '01ENTR00000000000000000012';
// J7: DEBIT Cash Reserve 20000000, CREDIT Cash Op 20000000
const E13 = '01ENTR00000000000000000013';
const E14 = '01ENTR00000000000000000014';
// J8: DEBIT Cash Op 2500000, CREDIT Customer Deposits 2500000
const E15 = '01ENTR00000000000000000015';
const E16 = '01ENTR00000000000000000016';
// J9 (cross-currency): BRL leg + USD leg
const E17 = '01ENTR00000000000000000017'; // DEBIT  Caixa BRL    51200 BRL
const E18 = '01ENTR00000000000000000018'; // CREDIT Dep BRL      51200 BRL
const E19 = '01ENTR00000000000000000019'; // DEBIT  FX Expense   10000 USD
const E20 = '01ENTR00000000000000000020'; // CREDIT Cash Op      10000 USD
// J10 (reversal of J4)
const E21 = '01ENTR00000000000000000021'; // CREDIT Cash Op      50000 USD
const E22 = '01ENTR00000000000000000022'; // DEBIT  AR           50000 USD

// ── FX Rate IDs ────────────────────────────────────────────────────────────
const FX1 = '01FXRT00000000000000000001'; // USD/BRL 5.12
const FX2 = '01FXRT00000000000000000002'; // USD/EUR 0.92
const FX3 = '01FXRT00000000000000000003'; // USD/GBP 0.79

async function main() {
  console.log('Seeding demo data...\n');

  // ── Accounts ───────────────────────────────────────────────────────────
  const accounts = [
    { id: CASH_OP,   name: 'Cash — Operating Account',   type: 'ASSET',     currency: 'USD' },
    { id: CASH_RV,   name: 'Cash — Reserve Account',     type: 'ASSET',     currency: 'USD' },
    { id: AR,        name: 'Accounts Receivable',             type: 'ASSET',     currency: 'USD' },
    { id: CUST_DEP,  name: 'Customer Deposits',               type: 'LIABILITY', currency: 'USD' },
    { id: FEES_PAY,  name: 'Fees Payable',                    type: 'LIABILITY', currency: 'USD' },
    { id: TXN_FEES,  name: 'Transaction Fees',                type: 'REVENUE',   currency: 'USD' },
    { id: FX_REV,    name: 'FX Revenue',                      type: 'REVENUE',   currency: 'USD' },
    { id: PROC_CST,  name: 'Processing Costs',                type: 'EXPENSE',   currency: 'USD' },
    { id: FX_EXP,    name: 'FX Expense',                      type: 'EXPENSE',   currency: 'USD' },
    { id: OWN_CAP,   name: 'Owner Capital',                   type: 'EQUITY',    currency: 'USD' },
    { id: CAIXA_BRL, name: 'Caixa BRL',                       type: 'ASSET',     currency: 'BRL' },
    { id: DEP_BRL,   name: 'Depósitos de Clientes BRL', type: 'LIABILITY', currency: 'BRL' },
  ];

  for (const a of accounts) {
    await prisma.account.upsert({
      where: { id: a.id },
      update: {},
      create: { id: a.id, name: a.name, type: a.type, currency: a.currency },
    });
  }
  console.log(`  [ok] ${accounts.length} accounts upserted`);

  // ── Journals (J1-J8, J10 without FX fields) ────────────────────────────
  await prisma.$executeRaw`
    INSERT INTO journals (id, description, metadata, status, posted_at, created_at)
    VALUES
      (${J1},  'Initial capital injection',  '{}'::jsonb, 'POSTED', '2026-01-15T10:00:00Z'::timestamptz, '2026-01-15T10:00:00Z'::timestamptz),
      (${J2},  'Customer deposit',           '{}'::jsonb, 'POSTED', '2026-01-20T14:00:00Z'::timestamptz, '2026-01-20T14:00:00Z'::timestamptz),
      (${J3},  'Fee collection',             '{}'::jsonb, 'POSTED', '2026-02-01T09:00:00Z'::timestamptz, '2026-02-01T09:00:00Z'::timestamptz),
      (${J4},  'Fee received',               '{}'::jsonb, 'POSTED', '2026-02-05T11:00:00Z'::timestamptz, '2026-02-05T11:00:00Z'::timestamptz),
      (${J5},  'Processing cost accrual',    '{}'::jsonb, 'POSTED', '2026-02-10T08:00:00Z'::timestamptz, '2026-02-10T08:00:00Z'::timestamptz),
      (${J6},  'Processing cost payment',    '{}'::jsonb, 'POSTED', '2026-02-10T16:00:00Z'::timestamptz, '2026-02-10T16:00:00Z'::timestamptz),
      (${J7},  'Reserve fund transfer',      '{}'::jsonb, 'POSTED', '2026-03-01T10:00:00Z'::timestamptz, '2026-03-01T10:00:00Z'::timestamptz),
      (${J8},  'Second customer deposit',    '{}'::jsonb, 'POSTED', '2026-04-15T14:30:00Z'::timestamptz, '2026-04-15T14:30:00Z'::timestamptz),
      (${J10}, 'Reversal of fee received',   '{}'::jsonb, 'POSTED', '2026-05-10T11:00:00Z'::timestamptz, '2026-05-10T11:00:00Z'::timestamptz)
    ON CONFLICT (id) DO NOTHING
  `;

  // J9 separately (has FX metadata)
  const fxRate = new Prisma.Decimal('5.12');
  await prisma.$executeRaw`
    INSERT INTO journals (id, description, metadata, status, posted_at, created_at, fx_rate, fx_base_currency, fx_quote_currency)
    VALUES (
      ${J9}, 'FX conversion -- USD to BRL', '{}'::jsonb, 'POSTED',
      '2026-05-01T09:00:00Z'::timestamptz, '2026-05-01T09:00:00Z'::timestamptz,
      ${fxRate}, ${'USD'}, ${'BRL'}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  [ok] 10 journals inserted');

  // ── Entries (22 total) ─────────────────────────────────────────────────
  await prisma.$executeRaw`
    INSERT INTO entries (id, journal_id, account_id, direction, amount, currency, created_at)
    VALUES
      -- J1: Capital injection ($1,000,000.00 USD)
      (${E01}, ${J1}, ${CASH_OP},   'DEBIT',  100000000, 'USD', '2026-01-15T10:00:00Z'::timestamptz),
      (${E02}, ${J1}, ${OWN_CAP},   'CREDIT', 100000000, 'USD', '2026-01-15T10:00:00Z'::timestamptz),
      -- J2: Customer deposit ($50,000.00 USD)
      (${E03}, ${J2}, ${CASH_OP},   'DEBIT',  5000000, 'USD', '2026-01-20T14:00:00Z'::timestamptz),
      (${E04}, ${J2}, ${CUST_DEP},  'CREDIT', 5000000, 'USD', '2026-01-20T14:00:00Z'::timestamptz),
      -- J3: Fee collection ($500.00 USD)
      (${E05}, ${J3}, ${AR},        'DEBIT',  50000, 'USD', '2026-02-01T09:00:00Z'::timestamptz),
      (${E06}, ${J3}, ${TXN_FEES},  'CREDIT', 50000, 'USD', '2026-02-01T09:00:00Z'::timestamptz),
      -- J4: Fee received ($500.00 USD)
      (${E07}, ${J4}, ${CASH_OP},   'DEBIT',  50000, 'USD', '2026-02-05T11:00:00Z'::timestamptz),
      (${E08}, ${J4}, ${AR},        'CREDIT', 50000, 'USD', '2026-02-05T11:00:00Z'::timestamptz),
      -- J5: Processing cost ($100.00 USD)
      (${E09}, ${J5}, ${PROC_CST},  'DEBIT',  10000, 'USD', '2026-02-10T08:00:00Z'::timestamptz),
      (${E10}, ${J5}, ${FEES_PAY},  'CREDIT', 10000, 'USD', '2026-02-10T08:00:00Z'::timestamptz),
      -- J6: Cost paid ($100.00 USD)
      (${E11}, ${J6}, ${FEES_PAY},  'DEBIT',  10000, 'USD', '2026-02-10T16:00:00Z'::timestamptz),
      (${E12}, ${J6}, ${CASH_OP},   'CREDIT', 10000, 'USD', '2026-02-10T16:00:00Z'::timestamptz),
      -- J7: Reserve transfer ($200,000.00 USD)
      (${E13}, ${J7}, ${CASH_RV},   'DEBIT',  20000000, 'USD', '2026-03-01T10:00:00Z'::timestamptz),
      (${E14}, ${J7}, ${CASH_OP},   'CREDIT', 20000000, 'USD', '2026-03-01T10:00:00Z'::timestamptz),
      -- J8: Second customer deposit ($25,000.00 USD)
      (${E15}, ${J8}, ${CASH_OP},   'DEBIT',  2500000, 'USD', '2026-04-15T14:30:00Z'::timestamptz),
      (${E16}, ${J8}, ${CUST_DEP},  'CREDIT', 2500000, 'USD', '2026-04-15T14:30:00Z'::timestamptz),
      -- J9: FX conversion (BRL leg: R$512.00; USD leg: $100.00)
      (${E17}, ${J9}, ${CAIXA_BRL}, 'DEBIT',  51200, 'BRL', '2026-05-01T09:00:00Z'::timestamptz),
      (${E18}, ${J9}, ${DEP_BRL},   'CREDIT', 51200, 'BRL', '2026-05-01T09:00:00Z'::timestamptz),
      (${E19}, ${J9}, ${FX_EXP},    'DEBIT',  10000, 'USD', '2026-05-01T09:00:00Z'::timestamptz),
      (${E20}, ${J9}, ${CASH_OP},   'CREDIT', 10000, 'USD', '2026-05-01T09:00:00Z'::timestamptz),
      -- J10: Reversal of J4 ($500.00 USD, flipped)
      (${E21}, ${J10}, ${CASH_OP},  'CREDIT', 50000, 'USD', '2026-05-10T11:00:00Z'::timestamptz),
      (${E22}, ${J10}, ${AR},       'DEBIT',  50000, 'USD', '2026-05-10T11:00:00Z'::timestamptz)
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  [ok] 22 entries inserted');

  // Mark J4 as REVERSED by J10
  await prisma.$executeRaw`
    UPDATE journals
    SET status = 'REVERSED', reversed_by_id = ${J10}
    WHERE id = ${J4}
  `;
  // Mark J10 as reversal of J4
  await prisma.$executeRaw`
    UPDATE journals
    SET reverses_journal_id = ${J4}
    WHERE id = ${J10}
  `;
  console.log('  [ok] J4 marked REVERSED, J10 linked as reversal');

  // ── FX Rates ───────────────────────────────────────────────────────────
  const today = new Date('2026-06-04T00:00:00.000Z');
  const fxRates = [
    { id: FX1, base: 'USD', quote: 'BRL', rate: '5.12' },
    { id: FX2, base: 'USD', quote: 'EUR', rate: '0.92' },
    { id: FX3, base: 'USD', quote: 'GBP', rate: '0.79' },
  ];
  for (const fx of fxRates) {
    await prisma.fxRate.upsert({
      where: {
        base_currency_quote_currency_effective_date: {
          base_currency: fx.base,
          quote_currency: fx.quote,
          effective_date: today,
        },
      },
      update: { rate: new Prisma.Decimal(fx.rate) },
      create: {
        id: fx.id,
        base_currency: fx.base,
        quote_currency: fx.quote,
        rate: new Prisma.Decimal(fx.rate),
        effective_date: today,
      },
    });
  }
  console.log(`  [ok] ${fxRates.length} FX rates upserted\n`);

  // ── Report ─────────────────────────────────────────────────────────────
  const [accountCount, journalCount] = await Promise.all([
    prisma.account.count(),
    prisma.journal.count(),
  ]);

  const [usdTotals] = await prisma.$queryRaw<[{ total_debits: bigint; total_credits: bigint }]>`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'DEBIT'  THEN amount ELSE 0 END), 0)::bigint AS total_debits,
      COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0)::bigint AS total_credits
    FROM entries
    WHERE currency = 'USD'
  `;

  const [brlTotals] = await prisma.$queryRaw<[{ total_debits: bigint; total_credits: bigint }]>`
    SELECT
      COALESCE(SUM(CASE WHEN direction = 'DEBIT'  THEN amount ELSE 0 END), 0)::bigint AS total_debits,
      COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END), 0)::bigint AS total_credits
    FROM entries
    WHERE currency = 'BRL'
  `;

  const usdOk = usdTotals.total_debits === usdTotals.total_credits;
  const brlOk = brlTotals.total_debits === brlTotals.total_credits;

  console.log('=== Seed Report ===');
  console.log(`  Accounts:         ${accountCount}`);
  console.log(`  Journals:         ${journalCount}`);
  console.log(`  USD total debits: ${Number(usdTotals.total_debits).toLocaleString()} minor units`);
  console.log(`  USD total credits:${Number(usdTotals.total_credits).toLocaleString()} minor units`);
  console.log(`  USD balanced:     ${usdOk ? 'PASS' : 'FAIL'}`);
  console.log(`  BRL total debits: ${Number(brlTotals.total_debits).toLocaleString()} minor units`);
  console.log(`  BRL balanced:     ${brlOk ? 'PASS' : 'FAIL'}`);
  console.log(`  Reconciliation:   ${usdOk && brlOk ? 'PASS' : 'FAIL'}`);
  console.log('');
  console.log('Demo account IDs:');
  console.log(`  Cash Operating: ${CASH_OP}`);
  console.log(`  Cash Reserve:   ${CASH_RV}`);
  console.log(`  Caixa BRL:      ${CAIXA_BRL}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
