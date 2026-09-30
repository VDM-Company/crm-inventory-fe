export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    // The Vertex screens are pixel-ported from the design, so the Nuxt UI form
    // primitives are re-themed once here rather than overridden per usage.
    // These mirror `.field-input` in main.css (which native <select> still uses).
    // Padding/size live in the `size` variant and the background in the
    // `variant` slot, because those win over `slots.base` in the merge order.
    // UCard: the design uses a 1px slate border (NOT Nuxt UI's `ring`), a 12px
    // radius and 24px body padding. `overflow-hidden` is deliberately NOT in
    // `root` — several cards contain absolutely-positioned popovers that it
    // would clip; the table cards opt in with a class instead.
    card: {
      slots: {
        // `overflow-visible` cancels UCard's default `overflow-hidden`, which
        // would clip the absolutely-positioned popovers several cards contain.
        // Body padding is zeroed (including the `sm:` variant, which otherwise
        // wins over an unprefixed per-site override) — padding goes on the root.
        root: 'bg-white border border-slate-200 rounded-xl shadow-sm overflow-visible',
        header: 'px-5 py-4 border-b border-slate-200',
        body: 'p-0 sm:p-0',
        footer: 'px-5 py-3.5 border-t border-slate-200'
      },
      variants: {
        variant: {
          outline: {
            root: 'bg-white border border-slate-200 ring-0 divide-y-0'
          }
        }
      },
      defaultVariants: {
        variant: 'outline'
      }
    },
    input: {
      slots: {
        root: 'w-full',
        base: 'w-full border border-slate-200 rounded-lg text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed'
      },
      variants: {
        variant: {
          none: 'bg-white text-slate-900'
        },
        size: {
          md: { base: 'px-3 py-2.5 text-[15px] md:text-[15px]' }
        }
      },
      // Nuxt UI adds `md:text-sm` through a compoundVariant (an iOS zoom guard)
      // that lands after the size variant; re-assert the design 15px there.
      compoundVariants: [
        { fixed: false, size: 'md', class: 'md:text-[15px]' }
      ],
      defaultVariants: {
        variant: 'none'
      }
    },
    textarea: {
      slots: {
        root: 'w-full',
        base: 'w-full border border-slate-200 rounded-lg text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed'
      },
      variants: {
        variant: {
          none: 'bg-white text-slate-900'
        },
        size: {
          md: { base: 'px-3 py-2.5 text-[15px] md:text-[15px]' }
        }
      },
      // Nuxt UI adds `md:text-sm` through a compoundVariant (an iOS zoom guard)
      // that lands after the size variant; re-assert the design 15px there.
      compoundVariants: [
        { fixed: false, size: 'md', class: 'md:text-[15px]' }
      ],
      defaultVariants: {
        variant: 'none'
      }
    }
  }
})
