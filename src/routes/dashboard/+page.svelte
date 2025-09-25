<script lang="ts">
	import { onMount } from 'svelte'
	import { supabase } from '$lib/supabaseClient'
	import { goto } from '$app/navigation'
	import { validateFile } from '$lib/utils'
	import type { User } from '@supabase/supabase-js'

	type Receipt = {
		id: string
		user_id: string
		store_name?: string
		date?: string
		total_price?: number
		receipt_items?: ReceiptItem[] // JSONB array
		raw_text?: string
		created_at?: string
	}

	type ReceiptItem = {
		name: string
		price: number
		category?: string
	}

	let user = $state<User | null>(null)
	let receipts = $state<Receipt[]>([])
	let loading = $state(true)
	let errorMessage = $state('')
	let uploading = $state(false)
	let uploadMessage = $state('')
	let fileInput: HTMLInputElement

	let totalSpent = $derived(receipts.reduce((sum, receipt) => sum + (receipt.total_price || 0), 0))
	let receiptCount = $derived(receipts.length)
	let isUploadSuccess = $derived(uploadMessage.includes('successfully'))

	// check session & fetch receipts
	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession()
		if (!session) {
			goto('/')
			return
		}

		user = session.user

		try {
			const { data, error } = await supabase
				.from('receipts')
				.select('*')
				.eq('user_id', user.id)
				.order('date', { ascending: false })

			if (error) {
				errorMessage = error.message
			} else {
				receipts = data
			}
		} catch (err) {
			errorMessage = 'Failed to load receipts.'
		} finally {
			loading = false
		}
	})

	async function uploadReceipt() {
		const file = fileInput.files?.[0]
		if (!file) {
			uploadMessage = 'Please select a file first'
			return
		}

		// Validate file
		const validation = validateFile(file)
		if (!validation.isValid) {
			uploadMessage = validation.error || 'Invalid file'
			return
		}

		uploading = true
		uploadMessage = 'Uploading...'

		try {
			const {
				data: { session }
			} = await supabase.auth.getSession()
			if (!session) {
				uploadMessage = 'Please log in to upload receipts'
				return
			}

			const formData = new FormData()
			formData.append('receipt', file)

			const response = await fetch('/api/upload-receipt', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.access_token}`
				},
				body: formData
			})

			if (response.ok) {
				uploadMessage = 'Receipt uploaded successfully!'
				fileInput.value = ''
				// Refresh receipts list
				location.reload()
			} else {
				const error = await response.text()
				uploadMessage = `Upload failed: ${error}`
			}
		} catch (error) {
			uploadMessage = `Upload failed: ${error}`
		} finally {
			uploading = false
		}
	}

	function triggerFileInput() {
		fileInput.click()
	}

	async function logout() {
		await supabase.auth.signOut()
		goto('/')
	}
</script>

<main class="mx-auto max-w-4xl p-4">
	<div class="mb-6">
		<div class="mb-4">
			<a href="/" class="text-sm text-blue-600 hover:text-blue-700">← Back to Home</a>
		</div>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold">Welcome, {user?.email}</h1>
				{#if receiptCount > 0}
					<p class="mt-1 text-gray-600">
						{receiptCount} receipt{receiptCount === 1 ? '' : 's'} • Total spent: ${totalSpent.toFixed(
							2
						)}
					</p>
				{/if}
			</div>
			<div class="flex gap-3">
				<button
					onclick={triggerFileInput}
					disabled={uploading}
					class="rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700 disabled:bg-gray-400"
				>
					{uploading ? 'Uploading...' : 'Upload Receipt'}
				</button>
				<button
					onclick={logout}
					class="rounded-lg bg-gray-600 px-6 py-3 text-white transition hover:bg-gray-700"
				>
					Logout
				</button>
			</div>
		</div>
	</div>

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*,.pdf"
		onchange={uploadReceipt}
		class="hidden"
	/>

	{#if uploadMessage}
		<div
			class="mb-4 rounded-lg p-4 {isUploadSuccess
				? 'bg-green-100 text-green-700'
				: 'bg-red-100 text-red-700'}"
		>
			{uploadMessage}
		</div>
	{/if}

	{#if loading}
		<p>Loading your receipts...</p>
	{:else if errorMessage}
		<p class="text-red-600">{errorMessage}</p>
	{:else if receipts.length === 0}
		<p>You have no receipts yet. Upload one to get started!</p>
	{:else}
		{#each receipts as receipt}
			<div class="mb-6 rounded-lg border bg-white p-6 shadow-md">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h3 class="text-xl font-semibold">{receipt.store_name || 'Unknown Store'}</h3>
						<p class="text-gray-600">{receipt.date || 'No date'}</p>
					</div>
					<div class="text-right">
						<p class="text-sm text-gray-500">{receipt.receipt_items?.length || 0} items</p>
					</div>
				</div>

				{#if receipt.receipt_items && receipt.receipt_items.length > 0}
					<!-- Group items by category -->
					{@const itemsByCategory = receipt.receipt_items.reduce(
						(acc: Record<string, ReceiptItem[]>, item) => {
							const category = item.category || 'others'
							if (!acc[category]) acc[category] = []
							acc[category].push(item)
							return acc
						},
						{} as Record<string, ReceiptItem[]>
					)}

					<div class="space-y-4">
						{#each Object.entries(itemsByCategory) as [category, items]}
							<div
								class="border-l-4 pl-4 {category === 'fresh food'
									? 'border-green-500'
									: category === 'processed food'
										? 'border-orange-500'
										: 'border-gray-500'}"
							>
								<h4 class="mb-2 font-medium text-gray-800 capitalize">
									{category === 'fresh food'
										? '🥬 Fresh Food'
										: category === 'processed food'
											? '🍿 Processed Food'
											: '🛒 Others'}
								</h4>
								<div class="grid gap-2">
									{#each items as item}
										<div class="py-1">
											<span class="text-gray-700">{item.name}</span>
										</div>
									{/each}
								</div>
								<div class="mt-2 border-t border-gray-200 pt-2">
									<div class="text-sm font-medium text-gray-600">
										{items.length} item{items.length === 1 ? '' : 's'}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500 italic">No items found</p>
				{/if}
			</div>
		{/each}
	{/if}
</main>
