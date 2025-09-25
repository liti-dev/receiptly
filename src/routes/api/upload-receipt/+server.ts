import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { supabase } from '$lib/supabaseClient'
import { createClient } from '@supabase/supabase-js'
import { validateFile } from '$lib/utils'
import { openai } from '$lib/openai'

import { writeFile, mkdir } from 'fs/promises'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Tesseract from 'tesseract.js'

interface FoodItem {
	name: string
	category: string
}

interface OCRResult {
	rawText: string
	items: FoodItem[]
}

async function processReceiptOCR(filePath: string): Promise<OCRResult> {
	try {
		const {
			data: { text }
		} = await Tesseract.recognize(filePath, 'eng', {
			logger: (m) => console.log(m) // log OCR progress
		})

		return {
			rawText: text,
			items: [] // let OpenAI handle categorisation
		}
	} catch (error) {
		console.error('OCR processing error:', error)
		throw new Error('Failed to process receipt with OCR')
	}
}

async function extractFoodItems(rawText: string): Promise<FoodItem[]> {
	try {
		// console.log('Raw OCR text length:', rawText.length)
		// console.log('Raw OCR text preview:', rawText.substring(0, 200))

		const lines = rawText
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.slice(0, 50) // limit total lines to avoid token limits

		// console.log('Total lines found:', lines.length)
		// console.log('First 10 lines:', lines.slice(0, 10))

		let foodItems: FoodItem[] = []
		if (lines.length > 0) {
			// console.log('Sending to OpenAI:', lines)
			const openaiStartTime = Date.now()
			const prompt = `You are analyzing a grocery receipt. Extract and categorize ONLY the food/grocery items from this OCR text. Many lines may not be food items.

OCR Lines:
${lines.join('\n')}

Instructions:
- ONLY extract items that are clearly food, drinks, or grocery products
- Ignore prices, store info, dates, totals, non-food items
- Fix OCR spelling errors (e.g., "BANAN4S" → "Bananas")
- Use proper capitalization
- Categorize EXACTLY as "fresh food" or "processed food" (no other categories allowed)
- Fresh food: fruits, vegetables, raw meat, fresh fish, dairy, bread, eggs
- Processed food: canned goods, snacks, ready meals, packaged items, fishcakes, sausages, frozen foods, cereals
- If you're not sure it's food, don't include it
- Return empty array if no food items found

IMPORTANT: Only use these exact categories: "fresh food" or "processed food"

Return valid JSON array: [{"name": "Item Name", "category": "processed food"}]`

			try {
				const completion = await openai.chat.completions.create({
					model: 'gpt-3.5-turbo',
					messages: [
						{
							role: 'system',
							content: 'You categorize food items from receipts. Return only JSON arrays.'
						},
						{
							role: 'user',
							content: prompt
						}
					],
					temperature: 0.1,
					max_tokens: 800
				})

				const responseText = completion.choices[0]?.message?.content?.trim()
				console.log('OpenAI raw response:', responseText)

				if (responseText) {
					const cleanResponse = responseText.replace(/```json\n?/, '').replace(/\n?```$/, '')
					console.log('Cleaned response:', cleanResponse)

					try {
						const parsedItems = JSON.parse(cleanResponse)
						console.log('Parsed food items:', parsedItems)

						if (Array.isArray(parsedItems)) {
							const beforeFilter = parsedItems.length
							foodItems = parsedItems.filter(
								(item: unknown): item is FoodItem =>
									typeof item === 'object' &&
									item !== null &&
									'name' in item &&
									'category' in item &&
									typeof (item as FoodItem).name === 'string' &&
									typeof (item as FoodItem).category === 'string' &&
									['fresh food', 'processed food'].includes((item as FoodItem).category)
							)

							// Log any items that were filtered out due to invalid categories
							const invalidItems = parsedItems.filter((item: unknown) => {
								if (typeof item === 'object' && item !== null && 'category' in item) {
									const category = (item as FoodItem).category
									return !['fresh food', 'processed food'].includes(category)
								}
								return false
							})

							if (invalidItems.length > 0) {
								console.log('Items filtered out due to invalid categories:', invalidItems)
							}
							console.log(`Filtered ${beforeFilter} items down to ${foodItems.length} valid items`)
						} else {
							console.error('OpenAI response is not an array:', typeof parsedItems)
						}
					} catch (parseError) {
						console.error('Failed to parse OpenAI JSON response:', parseError)
						console.error('Response that failed to parse:', cleanResponse)
					}
				} else {
					console.error('No response text from OpenAI')
				}
			} catch (openaiError) {
				console.error('OpenAI API error:', openaiError)
			}
			const openaiTime = Date.now() - openaiStartTime
			console.log(`OpenAI processing took ${openaiTime}ms for ${lines.length} items`)
		} else {
			console.log('No lines found to process')
		}

		console.log(`Total extracted: ${foodItems.length} food items`)
		return foodItems
	} catch (error) {
		console.error('Food extraction failed:', error)
		return []
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Check authentication
		const authHeader = request.headers.get('authorization')
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			return new Response('Unauthorized', { status: 401 })
		}

		const token = authHeader.split(' ')[1]

		// Create authenticated client with auth headers
		const authenticatedSupabase = createClient(
			import.meta.env.VITE_SUPABASE_URL,
			import.meta.env.VITE_SUPABASE_ANON_KEY,
			{
				global: {
					headers: {
						Authorization: `Bearer ${token}`
					}
				}
			}
		)

		// Verify the JWT token with Supabase
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser(token)
		if (authError || !user) {
			return new Response('Invalid token', { status: 401 })
		}

		// Parse multipart form data
		const formData = await request.formData()
		const file = formData.get('receipt') as File

		if (!file) {
			return new Response('No file provided', { status: 400 })
		}

		// Validate file
		const validation = validateFile(file)
		if (!validation.isValid) {
			return new Response(validation.error, { status: 400 })
		}

		// Generate unique filename
		const timestamp = Date.now()
		const fileExtension = file.name.split('.').pop()
		const fileName = `receipt_${user.id}_${timestamp}.${fileExtension}`

		// Convert file to buffer
		const arrayBuffer = await file.arrayBuffer()
		const buffer = new Uint8Array(arrayBuffer)

		// Create tmp directory if it doesn't exist
		const tmpDir = tmpdir()
		const receiptsDir = join(tmpDir, 'receiptly-uploads')
		if (!existsSync(receiptsDir)) {
			await mkdir(receiptsDir, { recursive: true })
		}

		// Save file temporarily to /tmp folder
		const tempFilePath = join(receiptsDir, fileName)
		await writeFile(tempFilePath, buffer)

		// Process OCR only for images (skip PDFs for now)
		let ocrResult: OCRResult | null = null
		let shouldCleanupFile = false

		if (file.type.startsWith('image/')) {
			try {
				ocrResult = await processReceiptOCR(tempFilePath)

				// Extract food items
				if (ocrResult && ocrResult.rawText) {
					const foodItems = await extractFoodItems(ocrResult.rawText)
					ocrResult.items = foodItems
				}

				shouldCleanupFile = true // Mark for cleanup after successful OCR
			} catch (error) {
				console.error('OCR processing failed:', error)
				shouldCleanupFile = true // Still cleanup even if OCR failed
				// Continue without OCR data - we'll still save the receipt
			}
		}

		// Cleanup temporary file immediately after OCR processing
		if (shouldCleanupFile) {
			try {
				unlinkSync(tempFilePath)
				console.log(`Temporary file deleted: ${tempFilePath}`)
			} catch (cleanupError) {
				console.error('Failed to delete temporary file:', cleanupError)
				// Don't fail the request if cleanup fails
			}
		}

		// Create receipt record in database using authenticated client with anon key
		const { data: receiptData, error: dbError } = await authenticatedSupabase
			.from('receipts')
			.insert({
				user_id: user.id,
				receipt_items: ocrResult?.items || [], // JSONB
				raw_text: ocrResult?.rawText || null // fallback OCR dump
			})
			.select()
			.single()

		if (dbError) {
			console.error('Database error:', dbError)
			return new Response(`Failed to save receipt record: ${dbError.message}`, { status: 500 })
		}

		return json({
			success: true,
			receiptId: receiptData.id,
			items: ocrResult?.items || []
		})
	} catch (error) {
		console.error('Upload error:', error)
		return new Response('Internal server error', { status: 500 })
	}
}
