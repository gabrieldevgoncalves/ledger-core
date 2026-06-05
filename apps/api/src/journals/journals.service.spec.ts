import { Test } from '@nestjs/testing';
import { JournalsService } from './journals.service';
import { JournalsRepository, JournalWithEntries } from './journals.repository';
import { AccountsRepository, AccountRow } from '../accounts/accounts.repository';
import { LedgerError } from '../shared/errors/ledger-errors';
import { PostJournalDto, Direction } from './dto/post-journal.dto';

const makeAccount = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  id: 'ACC-001',
  name: 'Cash',
  type: 'ASSET',
  currency: 'USD',
  description: null,
  metadata: {},
  is_active: true,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
});

const makeJournal = (overrides: Partial<JournalWithEntries> = {}): JournalWithEntries => ({
  id: 'J-001',
  description: 'Test journal',
  reference: null,
  metadata: {},
  fx_rate: null,
  fx_base_currency: null,
  fx_quote_currency: null,
  reverses_journal_id: null,
  reversed_by_id: null,
  status: 'POSTED',
  posted_at: new Date('2026-05-01T00:00:00Z'),
  created_at: new Date('2026-05-01T00:00:00Z'),
  entries: [
    {
      id: 'E-001',
      journal_id: 'J-001',
      account_id: 'ACC-001',
      direction: 'DEBIT',
      amount: 10000n,
      currency: 'USD',
      created_at: new Date('2026-05-01T00:00:00Z'),
    },
    {
      id: 'E-002',
      journal_id: 'J-001',
      account_id: 'ACC-002',
      direction: 'CREDIT',
      amount: 10000n,
      currency: 'USD',
      created_at: new Date('2026-05-01T00:00:00Z'),
    },
  ],
  ...overrides,
});

const validDto = (): PostJournalDto => ({
  entries: [
    { account_id: 'ACC-001', direction: Direction.DEBIT, amount: 10000, currency: 'USD' },
    { account_id: 'ACC-002', direction: Direction.CREDIT, amount: 10000, currency: 'USD' },
  ],
});

describe('JournalsService', () => {
  let service: JournalsService;
  let journalsRepo: jest.Mocked<JournalsRepository>;
  let accountsRepo: jest.Mocked<AccountsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JournalsService,
        {
          provide: JournalsRepository,
          useValue: {
            findByReference: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            reverse: jest.fn(),
          },
        },
        {
          provide: AccountsRepository,
          useValue: {
            findByIds: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
            deactivate: jest.fn(),
            findEntries: jest.fn(),
            getBalance: jest.fn(),
            getBalanceAsOf: jest.fn(),
            getBalanceBefore: jest.fn(),
            getNetByPeriod: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(JournalsService);
    journalsRepo = moduleRef.get(JournalsRepository);
    accountsRepo = moduleRef.get(AccountsRepository);
  });

  // ─── post ─────────────────────────────────────────────────────────────────

  describe('post — happy path', () => {
    it('creates journal and returns it with created=true', async () => {
      const acc1 = makeAccount({ id: 'ACC-001' });
      const acc2 = makeAccount({ id: 'ACC-002' });
      accountsRepo.findByIds.mockResolvedValue([acc1, acc2]);
      const journal = makeJournal();
      journalsRepo.create.mockResolvedValue(journal);

      const result = await service.post(validDto());

      expect(result.created).toBe(true);
      expect(result.journal.id).toBe('J-001');
      expect(result.journal.status).toBe('POSTED');
      expect(result.journal.entries).toHaveLength(2);
      expect(result.journal.entries[0].amount).toBe(10000);
    });

    it('uppercases entry currency before storing', async () => {
      const acc1 = makeAccount({ id: 'ACC-001' });
      const acc2 = makeAccount({ id: 'ACC-002' });
      accountsRepo.findByIds.mockResolvedValue([acc1, acc2]);
      journalsRepo.create.mockResolvedValue(makeJournal());

      const dto = validDto();
      dto.entries[0].currency = 'usd';
      dto.entries[1].currency = 'usd';

      await service.post(dto);

      const createCall = journalsRepo.create.mock.calls[0][0];
      expect(createCall.entries[0].currency).toBe('USD');
    });

    it('sets metadata to {} when not provided', async () => {
      accountsRepo.findByIds.mockResolvedValue([
        makeAccount({ id: 'ACC-001' }),
        makeAccount({ id: 'ACC-002' }),
      ]);
      journalsRepo.create.mockResolvedValue(makeJournal());

      await service.post(validDto());

      expect(journalsRepo.create.mock.calls[0][0].metadata).toEqual({});
    });
  });

  describe('post — idempotency', () => {
    it('returns existing journal with created=false when reference already exists', async () => {
      const existing = makeJournal({ reference: 'REF-123' });
      journalsRepo.findByReference.mockResolvedValue(existing);

      const dto = validDto();
      dto.reference = 'REF-123';

      const result = await service.post(dto);

      expect(result.created).toBe(false);
      expect(result.journal.id).toBe('J-001');
      expect(journalsRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('post — INVALID_JOURNAL (INV-07)', () => {
    it('throws when entries is empty', async () => {
      const dto = validDto();
      dto.entries = [];

      await expect(service.post(dto)).rejects.toMatchObject({ code: 'INVALID_JOURNAL' });
    });

    it('throws when only 1 entry', async () => {
      const dto = validDto();
      dto.entries = [dto.entries[0]];

      await expect(service.post(dto)).rejects.toMatchObject({ code: 'INVALID_JOURNAL' });
    });
  });

  describe('post — INVALID_AMOUNT (INV-04)', () => {
    it('throws when amount is 0', async () => {
      const dto = validDto();
      dto.entries[0].amount = 0;

      await expect(service.post(dto)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });

    it('throws when amount is negative', async () => {
      const dto = validDto();
      dto.entries[0].amount = -100;

      await expect(service.post(dto)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    });
  });

  describe('post — ACCOUNT_NOT_FOUND', () => {
    it('throws when one account_id does not exist', async () => {
      accountsRepo.findByIds.mockResolvedValue([makeAccount({ id: 'ACC-001' })]);
      // ACC-002 is missing from the result

      await expect(service.post(validDto())).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });

    it('throws when no accounts exist', async () => {
      accountsRepo.findByIds.mockResolvedValue([]);

      await expect(service.post(validDto())).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('post — ACCOUNT_INACTIVE (INV-08)', () => {
    it('throws when account is deactivated', async () => {
      accountsRepo.findByIds.mockResolvedValue([
        makeAccount({ id: 'ACC-001', is_active: false }),
        makeAccount({ id: 'ACC-002' }),
      ]);

      await expect(service.post(validDto())).rejects.toMatchObject({
        code: 'ACCOUNT_INACTIVE',
      });
    });
  });

  describe('post — INVARIANT_VIOLATION (INV-01)', () => {
    it('throws when debits ≠ credits for same currency', async () => {
      accountsRepo.findByIds.mockResolvedValue([
        makeAccount({ id: 'ACC-001' }),
        makeAccount({ id: 'ACC-002' }),
      ]);

      const dto = validDto();
      dto.entries[0].amount = 10000; // DEBIT 10000
      dto.entries[1].amount = 9999;  // CREDIT 9999 → unbalanced

      await expect(service.post(dto)).rejects.toMatchObject({
        code: 'INVARIANT_VIOLATION',
      });
    });

    it('throws when currencies are different but each side unbalanced', async () => {
      accountsRepo.findByIds.mockResolvedValue([
        makeAccount({ id: 'ACC-001', currency: 'USD' }),
        makeAccount({ id: 'ACC-002', currency: 'BRL' }),
      ]);

      // DEBIT 100 USD, CREDIT 100 BRL → not balanced in USD
      const dto: PostJournalDto = {
        entries: [
          { account_id: 'ACC-001', direction: Direction.DEBIT, amount: 100, currency: 'USD' },
          { account_id: 'ACC-002', direction: Direction.CREDIT, amount: 100, currency: 'BRL' },
        ],
      };

      await expect(service.post(dto)).rejects.toMatchObject({
        code: 'INVARIANT_VIOLATION',
      });
    });
  });

  describe('post — CURRENCY_MISMATCH (INV-05)', () => {
    it('throws when entry currency does not match account currency', async () => {
      accountsRepo.findByIds.mockResolvedValue([
        makeAccount({ id: 'ACC-001', currency: 'USD' }),
        makeAccount({ id: 'ACC-002', currency: 'USD' }),
      ]);

      // Both entries are balanced in EUR but accounts are USD
      const dto: PostJournalDto = {
        entries: [
          { account_id: 'ACC-001', direction: Direction.DEBIT, amount: 100, currency: 'EUR' },
          { account_id: 'ACC-002', direction: Direction.CREDIT, amount: 100, currency: 'EUR' },
        ],
      };

      await expect(service.post(dto)).rejects.toMatchObject({
        code: 'CURRENCY_MISMATCH',
      });
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns journal with entries', async () => {
      journalsRepo.findById.mockResolvedValue(makeJournal());

      const result = await service.findById('J-001');

      expect(result.id).toBe('J-001');
      expect(result.entries).toHaveLength(2);
    });

    it('throws JOURNAL_NOT_FOUND when missing', async () => {
      journalsRepo.findById.mockResolvedValue(null);

      await expect(service.findById('NOTEXIST')).rejects.toMatchObject({
        code: 'JOURNAL_NOT_FOUND',
      });
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated list', async () => {
      journalsRepo.findMany.mockResolvedValue([
        { id: 'J-001', description: null, reference: null, status: 'POSTED', entry_count: 2, posted_at: new Date() },
        { id: 'J-002', description: null, reference: null, status: 'POSTED', entry_count: 2, posted_at: new Date() },
      ]);

      const result = await service.findAll({ limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.next_cursor).toBeNull();
    });

    it('sets next_cursor when more rows exist', async () => {
      journalsRepo.findMany.mockResolvedValue([
        { id: 'J-001', description: null, reference: null, status: 'POSTED', entry_count: 2, posted_at: new Date() },
        { id: 'J-002', description: null, reference: null, status: 'POSTED', entry_count: 2, posted_at: new Date() },
        { id: 'J-003', description: null, reference: null, status: 'POSTED', entry_count: 2, posted_at: new Date() },
      ]);

      const result = await service.findAll({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.next_cursor).toBe('J-002');
    });

    it('passes filters to repository', async () => {
      journalsRepo.findMany.mockResolvedValue([]);

      await service.findAll({
        from: '2026-05-01',
        to: '2026-05-31',
        account_id: 'ACC-001',
        reference: 'REF-1',
        cursor: 'CURSOR',
        limit: 10,
      });

      expect(journalsRepo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          account_id: 'ACC-001',
          reference: 'REF-1',
          cursor: 'CURSOR',
          limit: 10,
        }),
      );
    });
  });

  // ─── reverse ─────────────────────────────────────────────────────────────

  describe('reverse', () => {
    it('creates reversal journal with flipped entries', async () => {
      const original = makeJournal();
      const reversal = makeJournal({
        id: 'J-002',
        reverses_journal_id: 'J-001',
        entries: [
          { ...original.entries[0], id: 'E-003', direction: 'CREDIT' },
          { ...original.entries[1], id: 'E-004', direction: 'DEBIT' },
        ],
      });

      journalsRepo.findById.mockResolvedValue(original);
      journalsRepo.reverse.mockResolvedValue(reversal);

      const result = await service.reverse('J-001', 'Reversal');

      expect(result.id).toBe('J-002');
      expect(result.reverses_journal_id).toBe('J-001');
      expect(journalsRepo.reverse).toHaveBeenCalledWith(
        'J-001',
        expect.objectContaining({ description: 'Reversal' }),
      );
    });

    it('uses default description when none provided', async () => {
      journalsRepo.findById.mockResolvedValue(makeJournal());
      journalsRepo.reverse.mockResolvedValue(makeJournal({ id: 'J-002', reverses_journal_id: 'J-001' }));

      await service.reverse('J-001');

      const call = journalsRepo.reverse.mock.calls[0][1];
      expect(call.description).toContain('J-001');
    });

    it('throws JOURNAL_NOT_FOUND when original missing', async () => {
      journalsRepo.findById.mockResolvedValue(null);

      await expect(service.reverse('NOTEXIST')).rejects.toMatchObject({
        code: 'JOURNAL_NOT_FOUND',
      });
    });

    it('throws ALREADY_REVERSED when journal status is REVERSED (INV-06)', async () => {
      journalsRepo.findById.mockResolvedValue(makeJournal({ status: 'REVERSED' }));

      await expect(service.reverse('J-001')).rejects.toMatchObject({
        code: 'ALREADY_REVERSED',
      });
    });
  });

  // ─── formatJournal ────────────────────────────────────────────────────────

  describe('response formatting', () => {
    it('converts BigInt entry amounts to Number', async () => {
      const acc1 = makeAccount({ id: 'ACC-001' });
      const acc2 = makeAccount({ id: 'ACC-002' });
      accountsRepo.findByIds.mockResolvedValue([acc1, acc2]);

      const journal = makeJournal();
      journal.entries[0].amount = 99999999n;
      journalsRepo.create.mockResolvedValue(journal);

      const result = await service.post(validDto());

      expect(typeof result.journal.entries[0].amount).toBe('number');
      expect(result.journal.entries[0].amount).toBe(99999999);
    });

    it('converts Prisma.Decimal fx_rate to number', async () => {
      journalsRepo.findById.mockResolvedValue(
        makeJournal({ fx_rate: { toNumber: () => 5.1234, toString: () => '5.1234' } as any }),
      );

      const result = await service.findById('J-001');

      expect(result.fx_rate).toBe(5.1234);
    });

    it('returns null fx_rate when not set', async () => {
      journalsRepo.findById.mockResolvedValue(makeJournal({ fx_rate: null }));

      const result = await service.findById('J-001');

      expect(result.fx_rate).toBeNull();
    });
  });
});
