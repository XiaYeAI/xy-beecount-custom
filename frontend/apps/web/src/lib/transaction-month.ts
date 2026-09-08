export type CopyableTransaction = {
  id: string
  tx_type: 'expense' | 'income' | 'transfer'
  amount: number
  happened_at: string
  note?: string | null
  category_name?: string | null
  category_kind?: 'expense' | 'income' | 'transfer' | null
  account_name?: string | null
  from_account_name?: string | null
  to_account_name?: string | null
  category_id?: string | null
  account_id?: string | null
  from_account_id?: string | null
  to_account_id?: string | null
  tags?: string[] | null
  currency_code?: string | null
  native_amount?: number | null
  exclude_from_stats?: boolean
  exclude_from_budget?: boolean
  attachments?: unknown[] | null
}

export type CopiedTransaction = Omit<CopyableTransaction, 'id' | 'attachments'>

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/
const ISO_CALENDAR_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(T.+)$/

/** Returns the local-calendar half-open bounds used by the transaction read API. */
export function monthBounds(month: string): { from: string; to: string } {
  const { year, monthIndex } = parseMonth(month)
  return {
    from: formatMonthStart(year, monthIndex),
    to: formatMonthStart(year, monthIndex + 1),
  }
}

export function shiftMonth(month: string, amount: number): string {
  const { year, monthIndex } = parseMonth(month)
  const date = new Date(Date.UTC(year, monthIndex + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Copies a transaction into a target month without carrying identifiers or
 * attachments. The calendar date portion is shifted directly, preserving the
 * original ISO time and offset exactly.
 */
export function copyTransactionToMonth(
  transaction: CopyableTransaction,
  targetMonth: string,
): CopiedTransaction {
  const { year: targetYear, monthIndex: targetMonthIndex } = parseMonth(targetMonth)
  const matched = ISO_CALENDAR_PATTERN.exec(transaction.happened_at)
  if (!matched) {
    throw new Error('Transaction time must be an ISO calendar timestamp')
  }

  const sourceDay = Number(matched[3])
  const targetDay = Math.min(sourceDay, daysInMonth(targetYear, targetMonthIndex))
  const calendarDate = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
  const { id: _id, attachments: _attachments, happened_at: _happenedAt, ...copyable } = transaction
  return {
    ...copyable,
    happened_at: `${calendarDate}${matched[4]}`,
  }
}

function parseMonth(month: string): { year: number; monthIndex: number } {
  const matched = MONTH_PATTERN.exec(month)
  if (!matched) throw new Error('Month must use YYYY-MM format')
  const year = Number(matched[1])
  const monthIndex = Number(matched[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) throw new Error('Month must be between 01 and 12')
  return { year, monthIndex }
}

function formatMonthStart(year: number, monthIndex: number): string {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}
