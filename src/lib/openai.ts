import OpenAI from 'openai'

// Shared OpenAI client
export const openai = new OpenAI({
	apiKey: import.meta.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
})
