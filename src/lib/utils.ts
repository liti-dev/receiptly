export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateFile(file: File): { isValid: boolean; error?: string } {
	if (!ALLOWED_FILE_TYPES.includes(file.type)) {
		return {
			isValid: false,
			error: 'Invalid file type. Only images (JPG, PNG) and PDFs are allowed.'
		}
	}

	if (file.size > MAX_FILE_SIZE) {
		return {
			isValid: false,
			error: 'File too large. Maximum size is 10MB.'
		}
	}

	return { isValid: true }
}
