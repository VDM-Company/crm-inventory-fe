import type { FeeItem, FeeItemDraft, FeeItemPatch } from '#shared/types'

/**
 * The fee items resource — reusable price line items.
 *
 * `usageCount` comes from the server (how many price lines reference it,
 * history included), so no screen has to load products to work it out.
 *
 * There is no invented "Base Price" row the way `useApiFees` had one. Here
 * that record is real and seeded; fabricating an id would put a made-up id
 * into real price lines. Find it by `kind === 'base'`. Whether a row is locked
 * against deletion is `isSystem`, which the server decides — `kind` cannot
 * stand in for it, because the API accepts creating a non-system item of kind
 * `tax` or `shipping`.
 *
 * Deleting a referenced item is 409 `in_use`, with the count in
 * `details.usageCount`; deleting a seeded one is 409 `system_fee_item`.
 */
export const useApiFeeItems = () =>
  useVertexResource<FeeItem, FeeItemDraft, FeeItemPatch>('fee-items')
