<script lang="ts">
	import { supabase } from '$lib/supabaseClient'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'

	let email = $state('')
	let message = $state('')
	let errorMessage = $state('')

	let isValidEmail = $derived(email.includes('@') && email.includes('.'))
	let hasMessage = $derived(message || errorMessage)
	let isSuccess = $derived(message.length > 0)

	// check if user is already logged in
	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession()
		if (session) {
			goto('/dashboard')
		}
	})

	async function signInWithMagicLink() {
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: `${window.location.origin}/dashboard` }
		})

		if (error) {
			errorMessage = error.message
			message = ''
		} else {
			message = `Check ${email} for your login link!`
			errorMessage = ''
		}
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
	<div class="flex min-h-screen flex-col items-center justify-center p-4">
		<div class="w-full max-w-md">
			<div class="mb-8 text-center">
				<h1 class="mb-2 text-4xl font-bold text-gray-800">
					Welcome to Receiptly<span class="text-blue-600">ly</span>
				</h1>
				<p class="text-gray-600">Sign in to access your dashboard</p>
			</div>

			<div class="rounded-lg bg-white p-8 shadow-lg">
				<h2 class="mb-6 text-center text-2xl font-semibold">Sign In</h2>

				<div class="space-y-4">
					<input
						type="email"
						placeholder="Your email address"
						bind:value={email}
						class="w-full rounded-lg border border-gray-300 px-4 py-3"
					/>
					<button
						onclick={signInWithMagicLink}
						disabled={!isValidEmail}
						class="w-full rounded-lg px-8 py-3 text-white transition
							{isValidEmail ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-400'}"
					>
						Send Magic Link
					</button>
				</div>

				{#if hasMessage}
					<p class="mt-4 text-center {isSuccess ? 'text-green-600' : 'text-red-600'}">
						{message || errorMessage}
					</p>
				{/if}

				<div class="mt-6 text-center">
					<a href="/" class="text-blue-600 hover:text-blue-700">← Back to home</a>
				</div>
			</div>
		</div>
	</div>
</main>
