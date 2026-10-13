import type {
  Attribute,
  AttributeDraft,
  AttributeOption,
  AttributeOptionDraft,
  AttributeOptionPatch,
  AttributePatch
} from '#shared/types'

/**
 * The attributes resource on the Vertex Commerce API.
 *
 * Named `V2` only while `useApiAttributes` still serves the pages from the
 * older seam; it takes that name once they move.
 *
 * This is the resource that changed shape most. The old one carried
 * `values: string[]` and saved the whole array in one PUT. Here each value is
 * an `AttributeOption` record with its own id, order and usage count, and the
 * API manages them through their own endpoints — so an edit that used to be
 * one request is now one per changed option:
 *
 *   addOption / updateOption / removeOption / reorderOptions
 *
 * Two consequences the Attributes screen will have to absorb:
 *
 * - **A list of strings cannot round-trip.** Products reference `optionIds`,
 *   so an option that is renamed keeps its identity, and one that is retyped
 *   from scratch does not. The form has to track which row is which option
 *   rather than diffing text.
 * - **Deleting a used option is refused**, 409 `in_use`, with the product
 *   count in `details.usageCount`. The server already knows the count, so
 *   nothing needs to load products to find out.
 *
 * `reorderOptions` returns the whole attribute; the other three return only
 * the option they touched.
 */
export function useApiAttributesV2() {
  const api = useVertexResource<Attribute, AttributeDraft, AttributePatch>('attributes-v2')
  const base = '/api/attributes-v2'
  const body = (v: unknown) => v as Record<string, unknown>

  return {
    ...api,

    /** Returns the new option alone. */
    addOption: (id: string, draft: AttributeOptionDraft) =>
      $fetch<AttributeOption>(`${base}/${id}/options`, { method: 'POST', body: body(draft) }),

    /** Returns the changed option alone. No lockVersion — options are not versioned. */
    updateOption: (id: string, optionId: string, patch: AttributeOptionPatch) =>
      $fetch<AttributeOption>(`${base}/${id}/options/${optionId}`, { method: 'PATCH', body: body(patch) }),

    /** 409 `in_use` if any product or variant ever used it. */
    removeOption: async (id: string, optionId: string): Promise<void> => {
      await $fetch(`${base}/${id}/options/${optionId}`, { method: 'DELETE' })
    },

    /** Every option id in the order they should sit. Returns the whole attribute. */
    reorderOptions: (id: string, optionIds: string[]) =>
      $fetch<Attribute>(`${base}/${id}/options/order`, { method: 'PUT', body: body({ optionIds }) })
  }
}

/**
 * Whether this attribute can define a variant axis.
 *
 * Reads the server's own answer rather than inferring it from `inputType`:
 * the API derives `canBeVariantAxis` itself, and a client rule would drift the
 * moment it adds an input type.
 */
export const canBeVariantAxis = (attr: Attribute) => attr.canBeVariantAxis
