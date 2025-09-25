import { browser } from '$app/environment'

// Get environment variables with Railway-specific handling
export const config = {
	supabase: {
		url: browser
			? import.meta.env.VITE_SUPABASE_URL
			: process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL,
		anonKey: browser
			? import.meta.env.VITE_SUPABASE_ANON_KEY
			: process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
	},
	openai: {
		apiKey: browser
			? import.meta.env.VITE_OPENAI_API_KEY
			: process.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_OPENAI_API_KEY
	},
	app: {
		url: browser
			? import.meta.env.VITE_APP_URL
			: process.env.VITE_APP_URL || import.meta.env.VITE_APP_URL || 'http://localhost:5173'
	}
}
