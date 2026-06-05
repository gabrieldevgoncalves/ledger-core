import { HttpException, HttpStatus } from '@nestjs/common';

export type LedgerErrorCode =
  | 'INVALID_JOURNAL'
  | 'INVALID_AMOUNT'
  | 'INVARIANT_VIOLATION'
  | 'CURRENCY_MISMATCH'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_INACTIVE'
  | 'JOURNAL_NOT_FOUND'
  | 'ALREADY_REVERSED'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE';

const HTTP_STATUS: Record<LedgerErrorCode, HttpStatus> = {
  INVALID_JOURNAL: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_AMOUNT: HttpStatus.UNPROCESSABLE_ENTITY,
  INVARIANT_VIOLATION: HttpStatus.UNPROCESSABLE_ENTITY,
  CURRENCY_MISMATCH: HttpStatus.UNPROCESSABLE_ENTITY,
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNT_INACTIVE: HttpStatus.UNPROCESSABLE_ENTITY,
  JOURNAL_NOT_FOUND: HttpStatus.NOT_FOUND,
  ALREADY_REVERSED: HttpStatus.CONFLICT,
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
};

const DEFAULT_MESSAGES: Record<LedgerErrorCode, string> = {
  INVALID_JOURNAL: 'Journal structural validation failed',
  INVALID_AMOUNT: 'Amount is zero or negative',
  INVARIANT_VIOLATION: 'Double-entry balance not satisfied',
  CURRENCY_MISMATCH: 'Entry currency does not match account currency',
  ACCOUNT_NOT_FOUND: 'Account does not exist',
  ACCOUNT_INACTIVE: 'Account is deactivated',
  JOURNAL_NOT_FOUND: 'Journal does not exist',
  ALREADY_REVERSED: 'Journal already has a reversal',
  VALIDATION_ERROR: 'Request body failed DTO validation',
  SERVICE_UNAVAILABLE: 'Database or dependency unavailable',
};

export class LedgerError extends HttpException {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode, detail?: Record<string, unknown>) {
    super(
      { error: code, message: DEFAULT_MESSAGES[code], detail: detail ?? {} },
      HTTP_STATUS[code],
    );
    this.code = code;
  }
}
