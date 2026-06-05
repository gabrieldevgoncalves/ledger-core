export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: string,
  ) {}

  static of(amount: bigint, currency: string): Money {
    if (amount <= 0n) throw new Error(`Invalid amount: ${amount}`);
    return new Money(amount, currency);
  }

  static fromMinorUnits(amount: bigint, currency: string): Money {
    return Money.of(amount, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toMinorUnits(): bigint {
    return this.amount;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
