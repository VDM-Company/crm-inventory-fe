export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',
      neutral: 'zinc'
    },
    // The Vertex screens are pixel-ported from the design, so the Nuxt UI form
    // primitives are re-themed once here rather than overridden per usage.
    // These carry the design's standard field scale (12px/10px padding, 15px).
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
    // UFormField carries the design's label/error/help scale so forms can use
    // UForm + zod without per-field class overrides. `.form-compact` pages
    // (the two product forms) shrink the label to 13px via main.css.
    formField: {
      slots: {
        root: '',
        label: 'block text-sm font-semibold text-slate-700 mb-1.5',
        error: 'mt-1.5 text-[13px] text-red-600',
        help: 'mt-1.5 text-[13px] text-slate-400',
        description: 'mt-1.5 text-[13px] text-slate-400',
        hint: 'text-[13px] text-slate-400'
      },
      variants: {
        required: {
          true: {
            label: 'after:content-[\'*\'] after:ms-1 after:text-red-600'
          }
        }
      }
    },
    input: {
      slots: {
        root: 'w-full',
        base: 'w-full border border-slate-200 rounded-lg text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:opacity-100'
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
        base: 'w-full border border-slate-200 rounded-lg text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15 placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:opacity-100'
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
    // USelect replaces the native <select>s. The trigger is themed to match
    // the inputs; the panel and its items match the hand-rolled dropdowns
    // this app already uses (see `ddTrigger` / `ddOption` in the product forms),
    // since the old menu was drawn by the OS and has no styling to port.
    select: {
      slots: {
        base: [
          'w-full border border-slate-200 rounded-lg text-slate-900 cursor-pointer',
          'transition-[border-color,box-shadow] duration-150',
          'focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15',
          'data-[state=open]:border-green-500 data-[state=open]:ring-[3px] data-[state=open]:ring-green-500/15',
          // the design's select rule set `background-color:#fff` unconditionally,
          // so a disabled select stays white rather than going slate
          'disabled:bg-white disabled:text-slate-400 disabled:cursor-not-allowed disabled:opacity-100'
        ].join(' '),
        placeholder: 'text-slate-400',
        value: 'truncate text-left',
        trailingIcon: 'size-4 text-slate-500',
        content: 'bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] ring-0 p-1',
        viewport: 'divide-y-0',
        group: 'p-0',
        item: [
          'rounded-md px-2.5 py-2 text-[14px] text-slate-700 cursor-pointer',
          'data-highlighted:not-data-disabled:bg-slate-50 data-highlighted:not-data-disabled:text-slate-900',
          'data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700 data-[state=checked]:font-semibold',
          'data-disabled:text-slate-300'
        ].join(' ')
      },
      variants: {
        variant: {
          none: 'bg-white text-slate-900'
        },
        size: {
          // `pe-[10px]` + a 16px icon puts the chevron's centre 18px from the
          // right edge, which is where the background-image chevron sat.
          md: {
            base: 'px-3 py-2.5 text-[15px] md:text-[15px]',
            trailing: 'pe-[10px]',
            trailingIcon: 'size-4',
            // `size.md` also carries the item padding, which beats `slots.item`
            item: 'px-2.5 py-2 text-[14px] gap-2'
          }
        }
      },
      compoundVariants: [
        { fixed: false, size: 'md', class: 'md:text-[15px]' }
      ],
      defaultVariants: {
        variant: 'none'
      }
    },
    // The design's toggles are 40x22 / 38x22 / 44x24 with an 18-20px knob and a
    // 2px inset, which is the track width minus USwitch's 2px transparent
    // border. `xl` already lands on 44x24, so only `md` and `sm` are resized.
    switch: {
      slots: {
        base: 'data-[state=unchecked]:bg-slate-200 duration-150',
        thumb: 'bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] duration-150'
      },
      variants: {
        size: {
          sm: {
            base: 'w-[38px]',
            container: 'h-[22px]',
            thumb: 'size-[18px] data-[state=checked]:translate-x-4 shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
          },
          md: {
            base: 'w-10',
            container: 'h-[22px]',
            thumb: 'size-[18px] data-[state=checked]:translate-x-[18px]'
          },
          xl: {
            thumb: 'shadow-[0_1px_2px_rgba(0,0,0,0.2)]'
          }
        }
      }
    }
  }
})
