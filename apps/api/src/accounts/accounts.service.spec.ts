import { Test } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { AccountsRepository, AccountRow, AccountWithBalance } from './accounts.repository';
import { LedgerError } from '../shared/errors/ledger-errors';
import { AccountType, CreateAccountDto } from './dto/create-account.dto';
import { Granularity } from './dto/balance-history.dto';

const makeAccount = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  id: '01HV000000000000000000001',
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

const makeAccountWithBalance = (
  overrides: Partial<AccountRow> = {},
  balance: bigint = 0n,
): AccountWithBalance => ({
  ...makeAccount(overrides),
  balance_minor_units: balance,
});

describe('AccountsService', () => {
  let service: AccountsService;
  let repository: jest.Mocked<AccountsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: AccountsRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
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

    service = moduleRef.get(AccountsService);
    repository = moduleRef.get(AccountsRepository);
  });

  describe('create', () => {
    it('generates ULID and delegates to repository', async () => {
      const dto: CreateAccountDto = {
        name: 'Cash',
        type: AccountType.ASSET,
        currency: 'usd',
        description: 'Main cash account',
        metadata: { ref: 'CASH-01' },
      };
      const account = makeAccount({ currency: 'USD', name: 'Cash' });
      repository.create.mockResolvedValue(account);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cash',
          type: 'ASSET',
          currency: 'USD',
          description: 'Main cash account',
          metadata: { ref: 'CASH-01' },
        }),
      );
      expect(result.id).toBe(account.id);
      expect(result.currency).toBe('USD');
    });

    it('defaults metadata to {} when not provided', async () => {
      const dto: CreateAccountDto = { name: 'X', type: AccountType.EQUITY, currency: 'BRL' };
      repository.create.mockResolvedValue(makeAccount());

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });

    it('uppercases currency', async () => {
      const dto: CreateAccountDto = { name: 'X', type: AccountType.ASSET, currency: 'brl' };
      repository.create.mockResolvedValue(makeAccount({ currency: 'BRL' }));

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'BRL' }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated accounts with balance', async () => {
      const rows = [makeAccountWithBalance({}, 5000n), makeAccountWithBalance({ id: '01HV000000000000000000002' }, 10000n)];
      repository.findMany.mockResolvedValue(rows);

      const result = await service.findAll({ limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].balance_minor_units).toBe(5000);
      expect(result.next_cursor).toBeNull();
    });

    it('sets next_cursor when more rows exist', async () => {
      // limit=2, repo returns 3 rows → hasMore=true
      const rows = [
        makeAccountWithBalance({ id: 'A' }),
        makeAccountWithBalance({ id: 'B' }),
        makeAccountWithBalance({ id: 'C' }),
      ];
      repository.findMany.mockResolvedValue(rows);

      const result = await service.findAll({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.next_cursor).toBe('B');
    });

    it('passes filters and cursor to repository', async () => {
      repository.findMany.mockResolvedValue([]);

      await service.findAll({ type: AccountType.ASSET, currency: 'USD', cursor: 'CURSOR1', limit: 10 });

      expect(repository.findMany).toHaveBeenCalledWith({
        type: 'ASSET',
        currency: 'USD',
        cursor: 'CURSOR1',
        limit: 10,
      });
    });
  });

  describe('findById', () => {
    it('returns account with derived balance', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.getBalance.mockResolvedValue(12345n);

      const result = await service.findById('01HV000000000000000000001');

      expect(result.balance_minor_units).toBe(12345);
      expect(repository.getBalance).toHaveBeenCalledWith('01HV000000000000000000001', 'USD');
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findById('NOTEXIST')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('deactivate', () => {
    it('returns id and is_active=false', async () => {
      repository.deactivate.mockResolvedValue(makeAccount({ is_active: false }));

      const result = await service.deactivate('01HV000000000000000000001');

      expect(result).toEqual({ id: '01HV000000000000000000001', is_active: false });
    });

    it('is idempotent — already-inactive account succeeds', async () => {
      repository.deactivate.mockResolvedValue(makeAccount({ is_active: false }));

      await expect(service.deactivate('01HV000000000000000000001')).resolves.toBeDefined();
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.deactivate.mockResolvedValue(null);

      await expect(service.deactivate('NOTEXIST')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('findEntries', () => {
    it('returns paginated entries', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.findEntries.mockResolvedValue([
        {
          id: 'E1',
          journal_id: 'J1',
          direction: 'DEBIT',
          amount: 100n,
          currency: 'USD',
          created_at: new Date('2026-05-01T00:00:00Z'),
        },
      ]);

      const result = await service.findEntries('01HV000000000000000000001', { limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].amount).toBe(100);
      expect(result.next_cursor).toBeNull();
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findEntries('NOTEXIST', { limit: 50 }),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('sets next_cursor when more entries exist', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.findEntries.mockResolvedValue([
        { id: 'E1', journal_id: 'J1', direction: 'DEBIT', amount: 100n, currency: 'USD', created_at: new Date() },
        { id: 'E2', journal_id: 'J2', direction: 'CREDIT', amount: 50n, currency: 'USD', created_at: new Date() },
      ]);

      const result = await service.findEntries('01HV000000000000000000001', { limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.next_cursor).toBe('E1');
    });
  });

  describe('getBalance', () => {
    it('returns current derived balance', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.getBalance.mockResolvedValue(999999n);

      const result = await service.getBalance('01HV000000000000000000001');

      expect(result).toMatchObject({
        account_id: '01HV000000000000000000001',
        currency: 'USD',
        balance_minor_units: 999999,
      });
      expect(result.computed_at).toBeDefined();
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getBalance('NOTEXIST')).rejects.toMatchObject({
        code: 'ACCOUNT_NOT_FOUND',
      });
    });
  });

  describe('getBalanceAsOf', () => {
    it('returns point-in-time balance', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.getBalanceAsOf.mockResolvedValue(50000n);

      const result = await service.getBalanceAsOf('01HV000000000000000000001', '2026-05-15T00:00:00Z');

      expect(result).toMatchObject({
        account_id: '01HV000000000000000000001',
        currency: 'USD',
        balance_minor_units: 50000,
        as_of: '2026-05-15T00:00:00.000Z',
      });
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getBalanceAsOf('NOTEXIST', '2026-05-15T00:00:00Z'),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });
  });

  describe('getBalanceHistory', () => {
    it('returns daily series with running balance', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.getBalanceBefore.mockResolvedValue(10000n);
      repository.getNetByPeriod.mockResolvedValue([
        { period: new Date('2026-05-01'), net: 5000n },
        { period: new Date('2026-05-03'), net: -2000n },
      ]);

      const result = await service.getBalanceHistory(
        '01HV000000000000000000001',
        '2026-05-01',
        '2026-05-03',
        Granularity.DAILY,
      );

      expect(result.series).toEqual([
        { date: '2026-05-01', balance_minor_units: 15000 },
        { date: '2026-05-02', balance_minor_units: 15000 },
        { date: '2026-05-03', balance_minor_units: 13000 },
      ]);
    });

    it('throws ACCOUNT_NOT_FOUND when account missing', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.getBalanceHistory('NOTEXIST', '2026-05-01', '2026-05-31', Granularity.DAILY),
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    });

    it('returns empty series when no entries in range', async () => {
      repository.findById.mockResolvedValue(makeAccount());
      repository.getBalanceBefore.mockResolvedValue(0n);
      repository.getNetByPeriod.mockResolvedValue([]);

      const result = await service.getBalanceHistory(
        '01HV000000000000000000001',
        '2026-05-01',
        '2026-05-01',
        Granularity.DAILY,
      );

      expect(result.series).toEqual([{ date: '2026-05-01', balance_minor_units: 0 }]);
    });
  });
});
