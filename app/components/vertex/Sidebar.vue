<script setup lang="ts">
// Port of the design's shared Sidebar.dc.html.
// Vertex Digital Marketing rail: collapsible, grouped nav with flyouts
// when collapsed. Active item is derived from the current route.

interface NavChild {
  key: string
  icon: string
  label: string
  to?: string
  enabled: boolean
}
interface NavSub {
  key: string
  icon: string
  label: string
  to?: string
  enabled?: boolean
  children?: NavChild[]
}
interface NavGroup {
  key: string
  icon: string
  label: string
  subs: NavSub[]
}

const LS_KEY = 'vertex_sidebar_collapsed'

const route = useRoute()

// Map route path -> active nav key (design used `.dc.html` file targets).
const activeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/categories')) return 'categories'
  if (p.startsWith('/attributes')) return 'attributes'
  if (p.startsWith('/pricing')) return 'fees'
  if (p.startsWith('/platforms')) return 'platforms'
  return 'dashboard'
})

const collapsed = ref(false)
const groupsOpen = reactive<Record<string, boolean>>({ inventory: true, orders: false, billing: false })
const subsOpen = reactive<Record<string, boolean>>({ product: true })
const flyout = ref<string | null>(null)

// SSR-safe: read persisted collapse only on the client, after mount.
onMounted(() => {
  try {
    collapsed.value = localStorage.getItem(LS_KEY) === '1'
  } catch {
    // ignore
  }
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function onDocClick() {
  if (flyout.value) flyout.value = null
}

function toggleCollapse() {
  collapsed.value = !collapsed.value
  flyout.value = null
  try {
    localStorage.setItem(LS_KEY, collapsed.value ? '1' : '0')
  } catch {
    // ignore
  }
}

const groupDefs: NavGroup[] = [
  {
    key: 'inventory',
    icon: 'i-lucide-boxes',
    label: 'Inventory',
    subs: [
      {
        key: 'product',
        icon: 'i-lucide-package',
        label: 'Product',
        enabled: true,
        children: [
          { key: 'dashboard', icon: 'i-lucide-layout-dashboard', label: 'Dashboard', to: '/dashboard', enabled: true },
          { key: 'categories', icon: 'i-lucide-folder-tree', label: 'Categories', to: '/categories', enabled: true },
          { key: 'attributes', icon: 'i-lucide-tags', label: 'Attributes', to: '/attributes', enabled: true },
          { key: 'fees', icon: 'i-lucide-circle-dollar-sign', label: 'Pricing Setting', to: '/pricing', enabled: true }
        ]
      },
      { key: 'platforms', icon: 'i-lucide-globe', label: 'Platforms', to: '/platforms', enabled: true },
      { key: 'operations', icon: 'i-lucide-wrench', label: 'Operations', enabled: false }
    ]
  },
  {
    key: 'orders',
    icon: 'i-lucide-shopping-cart',
    label: 'Orders',
    subs: [
      { key: 'order-list', icon: 'i-lucide-list', label: 'Order List', enabled: false },
      { key: 'returns', icon: 'i-lucide-undo-2', label: 'Returns', enabled: false }
    ]
  },
  {
    key: 'billing',
    icon: 'i-lucide-credit-card',
    label: 'Billing',
    subs: [
      { key: 'invoices', icon: 'i-lucide-file-text', label: 'Invoices', enabled: false },
      { key: 'plans', icon: 'i-lucide-layers', label: 'Plans', enabled: false }
    ]
  }
]

function groupContainsActive(g: NavGroup) {
  return g.subs.some(sub => sub.key === activeKey.value || (sub.children?.some(c => c.key === activeKey.value) ?? false))
}

function onGroupHeaderClick(g: NavGroup, e: MouseEvent) {
  e.stopPropagation()
  if (collapsed.value) {
    flyout.value = flyout.value === g.key ? null : g.key
  } else {
    groupsOpen[g.key] = !groupsOpen[g.key]
  }
}

function toggleSub(sub: NavSub, e: MouseEvent) {
  e.stopPropagation()
  subsOpen[sub.key] = !subsOpen[sub.key]
}

// leaf item classes (enabled/disabled + active state)
function leafClass(k: string) {
  return [
    'flex items-center gap-[9px] px-2.5 py-2 rounded-lg text-[13.5px] no-underline transition-colors',
    k === activeKey.value ? 'text-green-600 bg-emerald-50 font-bold' : 'text-slate-500 font-medium hover:bg-slate-100'
  ]
}
function childClass(k: string) {
  return [
    'flex items-center gap-[9px] py-[7px] pr-2.5 pl-[30px] rounded-lg text-[13px] no-underline transition-colors',
    k === activeKey.value ? 'text-green-600 bg-emerald-50 font-bold' : 'text-slate-500 font-medium hover:bg-slate-100'
  ]
}
</script>

<template>
  <div
    class="flex-shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col overflow-visible transition-[width] duration-200"
    :class="collapsed ? 'w-16' : 'w-[300px]'"
  >
    <!-- LOGO + COLLAPSE TOGGLE -->
    <div
      class="flex gap-2"
      :class="collapsed ? 'flex-col items-center pt-4 pb-5' : 'items-center justify-between px-3.5 pt-4 pb-5'"
    >
      <NuxtLink to="/dashboard" class="flex items-center gap-2 no-underline min-w-0">
        <div class="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0">
          V
        </div>
        <span
          v-if="!collapsed"
          class="text-[13px] font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
        >
          Vertex Digital<br>
          <span class="font-medium text-slate-500 text-[11px]">Marketing</span>
        </span>
      </NuxtLink>
      <UButton
        variant="ghost"

        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :ui="{ base: 'border border-slate-200 bg-white text-slate-500 w-[26px] h-[26px] rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 p-0 hover:bg-slate-100 transition-colors' }"
        @click="toggleCollapse"
      >
        <UIcon :name="collapsed ? 'i-lucide-chevrons-right' : 'i-lucide-chevrons-left'" class="w-3.5 h-3.5" />
      </UButton>
    </div>

    <!-- NAV GROUPS -->
    <div class="flex flex-col gap-0.5 flex-1 px-2.5 overflow-visible">
      <div v-for="g in groupDefs" :key="g.key" class="relative">
        <UButton
          variant="ghost"

          :title="g.label"
          :ui="{ base: ['flex items-center gap-2.5 w-full border-none bg-transparent rounded-lg cursor-pointer text-sm font-semibold hover:bg-slate-100 transition-colors', [
            collapsed ? 'justify-center py-2.5' : 'px-2.5 py-[9px]',
            groupContainsActive(g) ? (collapsed ? 'text-green-600 bg-emerald-50' : 'text-slate-900') : 'text-slate-500'
          ]] }"
          @click="onGroupHeaderClick(g, $event)"
        >
          <UIcon :name="g.icon" class="w-4 h-4 flex-shrink-0" />
          <template v-if="!collapsed">
            <span class="flex-1 text-left whitespace-nowrap">{{ g.label }}</span>
            <UIcon
              :name="groupsOpen[g.key] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              class="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
            />
          </template>
        </UButton>

        <!-- inline sub-items (expanded, group open) -->
        <div v-if="!collapsed && groupsOpen[g.key]" class="flex flex-col gap-0.5 pt-0.5 pb-1.5 pl-[26px]">
          <template v-for="sub in g.subs" :key="sub.key">
            <!-- parent sub with children -->
            <template v-if="sub.children">
              <UButton
                variant="ghost"

                :ui="{ base: ['flex items-center gap-[9px] px-2.5 py-2 rounded-lg text-[13.5px] w-full border-none bg-transparent cursor-pointer hover:bg-slate-100 transition-colors', sub.children.some(c => c.key === activeKey) ? 'text-slate-900 font-bold' : 'text-slate-500 font-semibold'] }"
                @click="toggleSub(sub, $event)"
              >
                <UIcon :name="sub.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="flex-1 text-left whitespace-nowrap">{{ sub.label }}</span>
                <UIcon
                  :name="subsOpen[sub.key] ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                  class="w-[13px] h-[13px] text-slate-400 flex-shrink-0"
                />
              </UButton>
              <div v-if="subsOpen[sub.key]" class="flex flex-col gap-0.5">
                <template v-for="child in sub.children" :key="child.key">
                  <NuxtLink v-if="child.enabled" :to="child.to || '#'" :class="childClass(child.key)">
                    <UIcon :name="child.icon" class="w-3.5 h-3.5 flex-shrink-0" />
                    <span class="whitespace-nowrap">{{ child.label }}</span>
                  </NuxtLink>
                  <div v-else :class="[...childClass(child.key), 'cursor-not-allowed opacity-45']" title="Coming soon">
                    <UIcon :name="child.icon" class="w-3.5 h-3.5 flex-shrink-0" />
                    <span class="whitespace-nowrap">{{ child.label }}</span>
                  </div>
                </template>
              </div>
            </template>
            <!-- leaf sub -->
            <template v-else>
              <NuxtLink v-if="sub.enabled" :to="sub.to || '#'" :class="leafClass(sub.key)">
                <UIcon :name="sub.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="whitespace-nowrap">{{ sub.label }}</span>
              </NuxtLink>
              <div v-else :class="[...leafClass(sub.key), 'cursor-not-allowed opacity-45']" title="Coming soon">
                <UIcon :name="sub.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="whitespace-nowrap">{{ sub.label }}</span>
              </div>
            </template>
          </template>
        </div>

        <!-- flyout (collapsed rail) -->
        <div
          v-if="collapsed && flyout === g.key"
          class="absolute left-[calc(100%+10px)] top-0 z-[60] bg-white border border-slate-200 rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-1.5 min-w-[170px]"
          @click.stop
        >
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-[0.05em] px-2.5 pt-1.5 pb-1">
            {{ g.label }}
          </div>
          <template v-for="sub in g.subs" :key="sub.key">
            <template v-if="sub.children">
              <div class="text-[11px] font-semibold text-slate-400 px-2.5 pt-2 pb-0.5 flex items-center gap-[7px]">
                <UIcon :name="sub.icon" class="w-3.5 h-3.5 flex-shrink-0" />
                <span class="whitespace-nowrap">{{ sub.label }}</span>
              </div>
              <NuxtLink
                v-for="child in sub.children"
                :key="child.key"
                :to="child.enabled ? (child.to || '#') : '#'"
                :class="leafClass(child.key)"
              >
                <UIcon :name="child.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="whitespace-nowrap">{{ child.label }}</span>
              </NuxtLink>
            </template>
            <template v-else>
              <NuxtLink v-if="sub.enabled" :to="sub.to || '#'" :class="leafClass(sub.key)">
                <UIcon :name="sub.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="whitespace-nowrap">{{ sub.label }}</span>
              </NuxtLink>
              <div v-else :class="[...leafClass(sub.key), 'cursor-not-allowed opacity-45']" title="Coming soon">
                <UIcon :name="sub.icon" class="w-[15px] h-[15px] flex-shrink-0" />
                <span class="whitespace-nowrap">{{ sub.label }}</span>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <!-- PROFILE -->
    <div
      class="border-t border-slate-100"
      :class="collapsed ? 'flex justify-center py-3.5' : 'flex items-center gap-2.5 p-3.5'"
    >
      <div
        class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0"
        title="Olivia Rhye"
      >
        OR
      </div>
      <template v-if="!collapsed">
        <div class="flex-1 min-w-0">
          <div class="text-[13px] font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
            Olivia Rhye
          </div>
          <div class="text-[11px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
            olivia@vertexdigital.com
          </div>
        </div>
        <UButton
          variant="ghost"

          title="Log out"
          :ui="{ base: 'border-none bg-transparent text-slate-400 w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 p-0 hover:bg-slate-100 transition-colors' }"
        >
          <UIcon name="i-lucide-log-out" class="w-[15px] h-[15px]" />
        </UButton>
      </template>
    </div>
  </div>
</template>
