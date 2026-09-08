import { describe, expect, it } from 'vitest'

import {
  copyTransactionToMonth,
  monthBounds,
  nextMonthSummaryRefreshVersion,
  shiftMonth,
  type CopyableTransaction,
} from './transaction-month'

describe('transaction month helpers', () => {
  it('creates a half-open month range across a year boundary', () => {
    expect(monthBounds('2026-12')).toEqual({
      from: '2026-12-01',
      to: '2027-01-01',
    })
  })

  it('moves between months in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('advances the month-summary refresh version after a transaction write', () => {
    expect(nextMonthSummaryRefreshVersion(4)).toBe(5)
  })

  it('copies a 31st to the final day of a non-leap February and preserves the time', () => {
    const copied = copyTransactionToMonth(sampleTransaction('2026-01-31T18:45:12.000Z'), '2026-02')

    expect(copied.happened_at).toBe('2026-02-28T18:45:12.000Z')
    expect(copied).toMatchObject({
      tx_type: 'expense',
      amount: 128.5,
      note: '房租',
      category_id: 'category-1',
      account_id: 'account-1',
      tags: ['fixed'],
      currency_code: 'CNY',
      native_amount: 128.5,
      exclude_from_stats: true,
    })
  })

  it('copies a 31st to February 29 in a leap year', () => {
    const copied = copyTransactionToMonth(sampleTransaction('2024-01-31T00:00:00.000Z'), '2024-02')

    expect(copied.happened_at).toBe('2024-02-29T00:00:00.000Z')
  })

  it('does not carry attachments or server-generated identifiers into a new transaction', () => {
    const copied = copyTransactionToMonth(sampleTransaction('2026-03-12T09:30:00.000Z'), '2026-04')

    expect(copied).not.toHaveProperty('id')
    expect(copied).not.toHaveProperty('attachments')
  })
})

function sampleTransaction(happenedAt: string): CopyableTransaction {
  return {
    id: 'source-tx',
    tx_type: 'expense',
    amount: 128.5,
    happened_at: happenedAt,
    note: '房租',
    category_name: '住房',
    category_kind: 'expense',
    account_name: '储蓄卡',
    category_id: 'category-1',
    account_id: 'account-1',
    tags: ['fixed'],
    currency_code: 'CNY',
    native_amount: 128.5,
    exclude_from_stats: true,
    attachments: [{ file_name: 'receipt.png' }],
  }
}
