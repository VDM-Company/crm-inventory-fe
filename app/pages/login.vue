<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { safeRedirect } from '#shared/utils/auth'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Sign in — Vertex' })

const route = useRoute()
const { login } = useAuth()

const form = reactive({ email: '', password: '' })
const submitting = ref(false)
const formError = ref('')
const retryAfter = ref(0)

// Only shape is checked here. Whether the credentials are right is the API's
// answer to give, and a rule about password length would publish the policy.
const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email address').email('That does not look like an email address'),
  password: z.string().min(1, 'Enter your password')
})
type Schema = z.output<typeof schema>

/**
 * The 429 the API sends after too many attempts, counted down on screen.
 *
 * Without it the form just keeps failing with no indication that waiting is
 * what fixes it.
 */
let tick: number | null = null
function startCountdown(seconds: number) {
  retryAfter.value = seconds
  if (tick !== null) clearInterval(tick)
  tick = window.setInterval(() => {
    retryAfter.value -= 1
    if (retryAfter.value <= 0 && tick !== null) {
      clearInterval(tick)
      tick = null
      formError.value = ''
    }
  }, 1000)
}
onBeforeUnmount(() => {
  if (tick !== null) clearInterval(tick)
})

const disabled = computed(() => submitting.value || retryAfter.value > 0)

const submitLabel = computed(() => {
  if (retryAfter.value > 0) return `Try again in ${retryAfter.value}s`
  return submitting.value ? 'Signing in…' : 'Sign in'
})

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  if (disabled.value) return
  submitting.value = true
  formError.value = ''
  try {
    await login(form.email.trim(), form.password)
    // `safeRedirect` refuses anything that is not a path on this site — a
    // login form that forwards wherever it is told is an open redirect
    await navigateTo(safeRedirect(route.query.redirect))
  } catch (err) {
    const e = err as { status?: number, statusCode?: number, data?: { data?: { message?: string, code?: string } } }
    const status = e.status || e.statusCode
    const body = e.data?.data

    if (status === 429) {
      // the API sends Retry-After; fall back to a minute when it did not
      const wait = Number(body?.message?.match(/\d+/)?.[0]) || 60
      formError.value = 'Too many attempts.'
      startCountdown(wait)
    } else if (status === 401) {
      formError.value = 'That email and password do not match an account.'
    } else {
      formError.value = apiErrorMessage(err, 'Could not sign in. Try again.')
    }
    form.password = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-[400px]">
    <div class="flex items-center gap-2.5 justify-center mb-7">
      <div class="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
        V
      </div>
      <span class="text-[15px] font-bold text-slate-900 leading-tight">
        Vertex Digital<br>
        <span class="font-medium text-slate-500 text-xs">Marketing</span>
      </span>
    </div>

    <UCard class="p-7">
      <h1 class="text-xl font-bold text-slate-900 m-0 mb-1.5">
        Sign in
      </h1>
      <p class="text-[13px] text-slate-500 m-0 mb-6">
        Use your Vertex administrator account.
      </p>

      <UForm
        :schema="schema"
        :state="form"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField label="Email" name="email" required>
          <UInput
            v-model="form.email"
            type="email"
            autocomplete="username"
            placeholder="you@example.com"
            :disabled="disabled"
            :ui="fieldUi('w-full')"
          />
        </UFormField>

        <UFormField label="Password" name="password" required>
          <UInput
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            :disabled="disabled"
            :ui="fieldUi('w-full')"
          />
        </UFormField>

        <div
          v-if="formError"
          class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
        >
          <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <UButton
          type="submit"
          :disabled="disabled"
          :ui="{ base: 'w-full inline-flex items-center justify-center gap-2 bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed' }"
        >
          <UIcon v-if="submitting" name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
          {{ submitLabel }}
        </UButton>
      </UForm>
    </UCard>

    <p class="text-xs text-slate-400 text-center mt-5">
      Lost your password? Ask an administrator to send you a reset link.
    </p>
  </div>
</template>
