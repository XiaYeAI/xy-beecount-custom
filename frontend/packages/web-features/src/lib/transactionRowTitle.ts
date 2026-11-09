export type TransactionRowTitle = {
  /** 常驻主文本 */
  primary: string
  /** 非空时在主文本后渲染「(备注)」小灰字;null = 不渲染 */
  parenNote: string | null
}

/**
 * 组装交易行第一行。
 * 分类始终是主文本。备注作为独立字段展示,即使设置了“备注优先”也不隐藏分类。
 */
export function composeTransactionRowTitle(params: {
  /** 保留外观设置的兼容入参,不再用备注覆盖分类。 */
  mode?: 'category' | 'note'
  categoryName?: string | null
  categoryText: string
  note: string | null | undefined
}): TransactionRowTitle {
  return { primary: params.categoryText, parenNote: params.note || null }
}
