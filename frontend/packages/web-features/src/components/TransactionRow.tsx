import type { AttachmentRef, ReadCategory, ReadTag, ReadTransaction } from '@beecount/api-client'
import { useT } from '@beecount/ui'

import { CategoryIcon } from './CategoryIcon'
import { TagChip } from './TagChip'
import { currencySymbol } from '../lib/currencies'
import { composeTransactionRowTitle } from '../lib/transactionRowTitle'

export type TransactionRowVariant = 'default' | 'compact'

type CommonProps = {
  row: ReadTransaction
  variant?: TransactionRowVariant
  /** §7 共享账本:开启后会在 meta 行渲染"XX 创建 · YY 编辑"chip(带头像)。
   *  默认 false(单人账本不需要显示创建人)。 */
  showCreator?: boolean
  /** §7 共享账本:当前 caller user_id,用来过滤掉"自己创建+自己编辑"的 tx —
   *  这种 tx 在共享账本里也不显示 chip,避免噪声。 */
  currentUserId?: string | null
  /** 标签配色字典：tagName.lowercase → color，渲染 tag badge 用。 */
  tagColorByName?: Map<string, string>
  /** 分类字典：category_id → ReadCategory，渲染分类图标用。不传 → 不渲染图标。 */
  categoryById?: Map<string, ReadCategory>
  /** 自定义分类图标的预签预览 URL 字典(`icon_cloud_file_id → blob URL`)。
   *  透传给 CategoryIcon,custom icon 才能出图;material icon 不需要。 */
  iconPreviewUrlByFileId?: Record<string, string>
  /** 点编辑 / 删除 的回调；不传则隐藏对应按钮。 */
  onEdit?: (row: ReadTransaction) => void
  onDelete?: (row: ReadTransaction) => void
  canManage?: boolean
  /** 附件预览入口：点行内 📎 chip 时触发。接收整组 attachments + 起始 index，
   *  让预览 Dialog 能做 prev/next 轮播。单附件时传 [attachment], 0 即可。 */
  onPreviewAttachment?: (
    refs: AttachmentRef[],
    startIndex: number
  ) => Promise<void>
  /** 点标签可以 emit 让外层打开标签详情弹窗或过滤。 */
  onClickTag?: (tagName: string) => void
  /** 行整体点击(空白处)→ 打开详情弹窗。Edit / Delete / Tag / Attachment
   *  按钮已 stopPropagation,不会触发本回调。 */
  onSelect?: (row: ReadTransaction) => void
  /** 额外的 className，外层可以加边距 / 分隔线。 */
  className?: string
  /** 批量选择模式 —— 行首渲染 checkbox,点行整体切换选中状态而不是 onSelect。 */
  selectionMode?: boolean
  /** 当前是否选中(selectionMode=true 时生效)。 */
  selected?: boolean
  /** 切换选中。event 透传给上层判断 shift / meta 键(范围选 / 增量选)。 */
  onToggleSelect?: (row: ReadTransaction, event: React.MouseEvent) => void
  /** 跨账本场景(详情弹窗 scope='all')—— 在 meta 行追加账本名 chip,帮用户
   *  区分同一分类/标签/账户在不同账本里的记录。同账本场景不传,避免噪声。 */
  showLedger?: boolean
  /** 保留外观设置的兼容入参,分类与备注始终同时展示。 */
  noteDisplayMode?: 'category' | 'note'
}

/**
 * 通用交易行组件。支持两种 variant：
 *  - `default`: 用于交易页列表 —— 顶部一行时间 + 金额，下面一行分类·账户 +
 *    tag badges，再下面附件缩略图（如有）。hover 出现编辑/删除。
 *  - `compact`: 用于弹窗（例如标签详情）—— 信息密度更高，附件用小图标代替
 *    缩略图。
 *
 * 刻意不展示账本名 / 创建人邮箱：用户明确说首页场景下不需要这两列。
 */
export function TransactionRow({
  row,
  variant = 'default',
  showCreator = false,
  currentUserId,
  tagColorByName,
  categoryById,
  iconPreviewUrlByFileId,
  onEdit,
  onDelete,
  canManage = true,
  onPreviewAttachment,
  onClickTag,
  onSelect,
  className,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  showLedger = false,
}: CommonProps) {
  const t = useT()
  const attachments = Array.isArray(row.attachments) ? row.attachments : []

  const amountTone = row.tx_type === 'expense' ? 'negative' : row.tx_type === 'income' ? 'positive' : 'default'
  const sign = row.tx_type === 'expense' ? '-' : row.tx_type === 'income' ? '+' : ''
  // 交易级多币种:折算快照存在且 ≠ 原币值 → 外币交易,金额旁标币种 + ≈ 折算行。
  // 同币种交易 native === amount 恒成立,自然不显示;无需引入账本本位币 prop。
  const isForeignCurrency =
    !!row.currency_code &&
    row.native_amount != null &&
    row.native_amount !== row.amount
  const categoryText = row.category_name || (row.tx_type === 'transfer' ? t('enum.txType.transfer') : '-')
  const rowTitle = composeTransactionRowTitle({
    categoryText,
    note: row.note,
  })
  const accountText =
    row.tx_type === 'transfer'
      ? `${row.from_account_name || '-'} → ${row.to_account_name || '-'}`
      : row.account_name || '-'

  const isCompact = variant === 'compact'

  // 分类图标:优先按 category_id 精确匹配;匹配不到(跨账本 id 冲突 /
  // 脏数据)退化到按 name+kind 兜底,避免一整列空白。
  const categoryEntry = (() => {
    if (!categoryById) return null
    const byId = row.category_id ? categoryById.get(row.category_id) : null
    if (byId) return byId
    if (!row.category_name) return null
    for (const cat of categoryById.values()) {
      if (cat.name === row.category_name && cat.kind === row.category_kind) return cat
    }
    return null
  })()

  const hasAttachments = attachments.length > 0 && Boolean(onPreviewAttachment)
  const firstAttachment = attachments[0]

  // 选择模式优先于 onSelect:点行 = 切换选中,不打开详情
  const handleRowClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(row, event)
      return
    }
    if (onSelect) onSelect(row)
  }
  const isInteractive = selectionMode || Boolean(onSelect)

  return (
    <div
      onClick={isInteractive ? handleRowClick : undefined}
      // 行不再声明 role=button:行内嵌有编辑/删除/附件等真实按钮,role=button
      // 不允许嵌套交互元素,屏幕阅读器会朗读混乱。鼠标用户仍可点行任意空白;
      // 键盘/读屏用户走下方标题处的真实 <button>。
      className={`group relative flex items-start gap-2 py-2 ${
        isCompact ? 'px-3' : 'px-3 md:pl-4 md:pr-24'
      } transition-colors hover:bg-accent/30 ${
        isInteractive ? 'cursor-pointer' : ''
      } ${selectionMode && selected ? 'bg-primary/8' : ''} ${className || ''}`}
    >
      {selectionMode ? (
        <div className="flex shrink-0 items-center pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => undefined}
            onClick={(e) => {
              // 由父级 handleRowClick 统一处理点击 / shift / meta;阻止冒泡到行,
              // 否则 checkbox 自身 onChange 跟 row click 会双触发。
              e.stopPropagation()
              if (onToggleSelect) onToggleSelect(row, e)
            }}
            aria-label={t('common.select') as string}
            className="h-4 w-4 cursor-pointer accent-primary"
          />
        </div>
      ) : null}
      {/* 桌面明细使用固定比例的分类、备注、时间/账户和金额列；窄屏保持双列布局。 */}
      <div
        className={`grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-x-3 ${
          isCompact ? '' : 'md:max-w-4xl md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1.35fr)_minmax(0,0.8fr)] md:grid-rows-[auto_auto] md:items-start'
        }`}
      >
        {/* 左上:分类 + 备注 + 账本名(showLedger,主题色) — self-start 钉到 row 顶部 */}
        <div className={`flex min-w-0 items-start gap-2 self-start ${isCompact ? '' : 'md:col-start-1 md:row-start-1'}`}>
          {categoryEntry ? (
            <CategoryIcon
              icon={categoryEntry.icon}
              iconType={categoryEntry.icon_type}
              iconCloudFileId={categoryEntry.icon_cloud_file_id}
              iconPreviewUrlByFileId={iconPreviewUrlByFileId}
              size={isCompact ? 16 : 18}
              className="shrink-0 text-muted-foreground"
            />
          ) : null}
          {isInteractive ? (
            // 键盘/读屏的正式入口:真实 button,焦点可达、Enter/Space 触发,
            // 行为与点行一致(选择模式 = 切换选中,否则 = 打开详情)。
            <button
              type="button"
              className="min-w-0 break-words rounded-sm text-left text-sm font-medium [overflow-wrap:anywhere] hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              onClick={(event) => {
                event.stopPropagation()
                if (selectionMode && onToggleSelect) {
                  onToggleSelect(row, event)
                } else if (onSelect) {
                  onSelect(row)
                }
              }}
            >
              {rowTitle.primary}
            </button>
          ) : (
            <span className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">{rowTitle.primary}</span>
          )}
          {showLedger && row.ledger_name ? (
            <span
              className="inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-primary"
              title={row.ledger_name}
            >
              {row.ledger_name}
            </span>
          ) : null}
        </div>

        {!isCompact ? (
          <span className="hidden min-w-0 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere] md:col-start-2 md:row-start-1 md:block">
            {rowTitle.parenNote}
          </span>
        ) : null}

        {/* 右上:hover 动作 + 金额 — self-start 钉顶 */}
        <div className={`col-start-2 row-start-1 flex min-w-0 items-center justify-end gap-2 self-start ${isCompact ? '' : 'md:col-start-4'}`}>
          {(onEdit || onDelete) && !isCompact && !selectionMode ? (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 md:absolute md:right-4 md:top-2">
              {onEdit ? (
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(row)
                  }}
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-primary/15 hover:text-primary"
                >
                  {t('common.edit')}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(row)
                  }}
                  className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  {t('common.delete')}
                </button>
              ) : null}
            </div>
          ) : null}
          <span className={`min-w-0 break-all text-right font-mono text-sm tabular-nums font-bold ${
            amountTone === 'positive'
              ? 'text-income'
              : amountTone === 'negative'
                ? 'text-expense'
                : 'text-foreground'
          }`}>
            {sign}
            {/* 外币显示其币种符号(JP¥/US$…,与本位币一眼区分);本位币维持纯数字 */}
            {isForeignCurrency ? currencySymbol(row.currency_code as string) : ''}
            {row.amount.toLocaleString('zh-CN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </span>
        </div>

        {/* 左下:时间·账户·标签·附件 — self-end 钉到 row 底部 */}
        <div className={`col-start-1 row-start-2 mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 self-end ${isCompact ? '' : 'md:col-start-3 md:row-start-1 md:mt-0 md:self-start md:gap-x-2'} ${
          isCompact ? 'text-[11px]' : 'text-xs'
        } text-muted-foreground`}>
          <span className="font-mono tabular-nums">{formatDateTime(row.happened_at)}</span>
          {accountText && accountText !== '-' ? (
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">· {accountText}</span>
          ) : null}
          {rowTitle.parenNote ? (
            <span className={`min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isCompact ? '' : 'md:hidden'}`}>· {rowTitle.parenNote}</span>
          ) : null}
          {row.tags_list && row.tags_list.length > 0
            ? row.tags_list.map((tagName) => (
                <TagChip
                  key={tagName}
                  name={tagName}
                  className="max-w-full break-all"
                  color={tagColorByName?.get(tagName.trim().toLowerCase())}
                  onClick={onClickTag}
                />
              ))
            : null}
          {hasAttachments && firstAttachment ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void onPreviewAttachment?.(attachments, 0)
              }}
              className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
              title={firstAttachment.originalName || firstAttachment.fileName || t('attachment.default')}
            >
              <span aria-hidden>📎</span>
              <span className="font-mono tabular-nums">{attachments.length}</span>
            </button>
          ) : null}
          {/* §4.2 标记小灰字 — 不改金额、不加图标,只在第二排尾部追加灰字标签 */}
          {row.exclude_from_stats ? (
            <span>· {t('txFlagExcludedTag')}</span>
          ) : null}
          {row.exclude_from_budget ? (
            <span>· {t('txFlagBudgetExcludedTag')}</span>
          ) : null}
        </div>

        {/* 右下:≈折算(反馈14:与左下时间行平齐)+ 创建/编辑头像 chip —
            self-end 钉到 row 底部,跟左下 meta 同 grid row,水平自动对齐 */}
        <div className={`col-start-2 row-start-2 mt-1 flex min-w-0 flex-wrap items-center justify-end gap-2 self-end ${isCompact ? '' : 'md:col-start-4 md:row-start-2'}`}>
          {showCreator ? (
            <CreatorEditorChip row={row} currentUserId={currentUserId} t={t} />
          ) : null}
          {isForeignCurrency ? (
            <span
              className={`font-mono tabular-nums text-muted-foreground ${
                isCompact ? 'text-[11px]' : 'text-xs'
              }`}
              title={t('transactions.convertedToBase')}
            >
              ≈{(row.native_amount as number).toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * 共享账本 tx tile 右下角"参与者"头像组。
 *
 * 显示规则(按用户最新意图):
 * - 都是自己(creator + editor) → 不显示
 * - 同一人参与(creator == editor):
 *     - 是自己 → 不显示
 *     - 别人 → 显示 1 个头像,tooltip 「{name} 创建并编辑」
 * - 两个不同人参与:显示 2 个头像,各 tooltip
 *     - 第 1 个:「{creator} 创建」(自己则 tooltip 写"我 创建")
 *     - 第 2 个:「{editor} 最后编辑」
 * - 头像:server avatar_url 失败 fallback 首字母色块。hover 才显示 label
 *   减少视觉噪声;label 走 native title (浏览器 tooltip)。
 */
function CreatorEditorChip({
  row,
  currentUserId,
  t,
}: {
  row: ReadTransaction
  currentUserId?: string | null
  t: (key: string, vars?: Record<string, string>) => string
}) {
  const creatorUid = row.created_by_user_id || ''
  const editorUid = row.last_edited_by_user_id || creatorUid
  if (!creatorUid && !editorUid) return null

  const isCreatorMe = !!currentUserId && creatorUid === currentUserId
  const isEditorMe = !!currentUserId && editorUid === currentUserId
  if (isCreatorMe && isEditorMe) return null

  const creatorName =
    row.created_by_display_name ||
    (row.created_by_email || '').split('@')[0] ||
    '?'
  const editorName =
    row.last_edited_by_display_name ||
    (row.last_edited_by_email || '').split('@')[0] ||
    creatorName

  const sameUser = creatorUid && editorUid && creatorUid === editorUid

  // 同一人参与(此时必然不是自己,前面已 early-return) → 单头像 + 创建并编辑 tooltip
  if (sameUser) {
    const title = t('sharedLedger.tileCreatedAndEditedBy', {
      name: creatorName,
    })
    return (
      <span title={title} className="inline-flex items-center">
        <UserMiniAvatar
          avatarUrl={row.created_by_avatar_url}
          name={creatorName}
          size={24}
        />
      </span>
    )
  }

  // 两个不同人参与 → 双头像,各自 tooltip
  return (
    <span className="inline-flex items-center -space-x-1.5">
      <span
        title={t('sharedLedger.tileCreatedBy', { name: creatorName })}
        className="inline-flex items-center ring-1 ring-background rounded-full"
      >
        <UserMiniAvatar
          avatarUrl={row.created_by_avatar_url}
          name={creatorName}
          size={24}
        />
      </span>
      <span
        title={t('sharedLedger.tileEditedBy', { name: editorName })}
        className="inline-flex items-center ring-1 ring-background rounded-full"
      >
        <UserMiniAvatar
          avatarUrl={row.last_edited_by_avatar_url}
          name={editorName}
          size={24}
        />
      </span>
    </span>
  )
}

function UserMiniAvatar({
  avatarUrl,
  name,
  size = 16,
}: {
  avatarUrl?: string | null
  name: string
  size?: number
}) {
  const letter = (name || '?').trim().slice(0, 1).toUpperCase()
  // letter 字号约头像高度的 45%,28px 头像 ~ 12.5px 字
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.45),
  }
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
        onError={(e) => {
          // 头像 404 时退化成首字母,避免 broken-image 图标
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
      />
    )
  }
  return (
    <span
      style={style}
      className="inline-flex items-center justify-center rounded-full bg-primary/20 font-semibold text-primary"
    >
      {letter}
    </span>
  )
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`
}

