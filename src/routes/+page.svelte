<script lang="ts">
	import { supabase } from '$lib/supabaseClient'
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'

	let isLoggedIn = $state(false)

	let ctaText = $derived(isLoggedIn ? 'Go to Dashboard' : 'Get Started')
	let ctaAction = $derived(isLoggedIn ? goToDashboard : goToLogin)

	// check if user is already logged in
	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession()
		if (session) {
			isLoggedIn = true
		}
	})

	function goToDashboard() {
		goto('/dashboard')
	}

	function goToLogin() {
		goto('/login')
	}
</script>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
	<!-- Hero -->
	<div class="flex min-h-screen flex-col items-center justify-center p-4">
		<div class="max-w-4xl text-center">
			<h1 class="mb-6 text-5xl font-bold text-gray-800">
				Receipt<span class="text-blue-600">ly</span>
			</h1>
			<p class="mb-8 text-xl text-gray-600">
				Get insights into your grocery shopping habits and make smarter purchasing decisions
			</p>

			<!-- Features -->
			<div class="mb-12 grid gap-8 md:grid-cols-3">
				<div class="rounded-lg bg-white p-6 shadow-md">
					<div class="mb-4 text-3xl">📊</div>
					<h3 class="mb-2 text-lg font-semibold">Smart Analytics</h3>
					<p class="text-gray-600">Track spending patterns and discover where your money goes</p>
				</div>
				<div class="rounded-lg bg-white p-6 shadow-md">
					<div class="mb-4 text-3xl">🌱</div>
					<h3 class="mb-2 text-lg font-semibold">Environmental Impact</h3>
					<p class="text-gray-600">Monitor your carbon footprint and make eco-friendly choices</p>
				</div>
				<div class="mb-4 rounded-lg bg-white p-6 shadow-md">
					<div class="mb-4 text-3xl">💡</div>
					<h3 class="mb-2 text-lg font-semibold">Personalized Insights</h3>
					<p class="text-gray-600">Get tailored recommendations based on your shopping history</p>
				</div>
			</div>

			<!-- CTA Section -->
			<div class="rounded-lg bg-white p-8 shadow-lg">
				<h2 class="mb-4 text-2xl font-semibold">
					{isLoggedIn ? 'Welcome back!' : 'Start Your Journey'}
				</h2>
				{#if !isLoggedIn}
					<p class="mb-6 text-gray-600">Ready to get insights into your grocery shopping habits?</p>
				{/if}

				<button
					onclick={ctaAction}
					class="rounded-lg bg-blue-600 px-8 py-3 text-white transition hover:bg-blue-700"
				>
					{ctaText}
				</button>
			</div>
		</div>
	</div>

	<!-- Additional Info -->
	<div class="bg-white py-16">
		<div class="mx-auto max-w-4xl px-4">
			<h2 class="mb-8 text-center text-3xl font-bold text-gray-800">How Receiptly Works</h2>
			<div class="grid gap-8 md:grid-cols-3">
				<div class="text-center">
					<div class="mb-4 text-4xl">📱</div>
					<h3 class="mb-2 text-xl font-semibold">Upload Receipts</h3>
					<p class="text-gray-600">Simply upload photos of your grocery receipts</p>
				</div>
				<div class="text-center">
					<div class="mb-4 text-4xl">🤖</div>
					<h3 class="mb-2 text-xl font-semibold">AI Analysis</h3>
					<p class="text-gray-600">Our AI extracts and categorizes your purchases automatically</p>
				</div>
				<div class="text-center">
					<div class="mb-4 text-4xl">📈</div>
					<h3 class="mb-2 text-xl font-semibold">Get Insights</h3>
					<p class="text-gray-600">Receive detailed analytics and personalized recommendations</p>
				</div>
			</div>
		</div>
	</div>
</main>
