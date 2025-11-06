/**
 * API service for communicating with the Fleetline backend
 */

// Get API URL - Next.js makes NEXT_PUBLIC_* variables available in both server and client
// Using a getter function to ensure it's evaluated at runtime
function getApiBaseUrl(): string {
  // In Next.js, process.env.NEXT_PUBLIC_* is available everywhere
  // Fallback to localhost:8000 if not set
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

const API_BASE_URL = getApiBaseUrl();

// Log the API URL in development to help debug
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE_URL);
}

export interface AskRequest {
  query: string;
}

export interface AskResponse {
  question: string;
  overview: string;
  overview_image: string | null;
  topics: Array<{ title: string; content: string }>;
  sources: Array<{
    id: number;
    title: string;
    url: string;
    image: string | null;
    extended_snippet?: string | null;
  }>;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
}

export interface RelatedQuestionsResponse {
  questions: string[];
}

/**
 * Check if the backend API is healthy
 */
export async function checkHealth(): Promise<HealthResponse> {
  const url = `${API_BASE_URL}/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Health check error:', {
      url,
      error: errorMessage,
    });
    throw new Error(
      `Backend health check failed at ${API_BASE_URL}. ` +
      `Make sure the backend is running. Error: ${errorMessage}`
    );
  }
}

/**
 * Send a query to the backend agent
 */
export async function askQuestion(request: AskRequest): Promise<AskResponse> {
  const url = `${API_BASE_URL}/api/ask`;
  
  try {
    console.log(`Making API request to: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more helpful error messages
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      console.error('API request failed - backend may not be running:', {
        url,
        error: errorMessage,
      });
      throw new Error(
        `Failed to connect to backend server at ${API_BASE_URL}. ` +
        `Make sure the backend is running on port 8000. ` +
        `Error: ${errorMessage}`
      );
    }
    
    console.error('API request error:', {
      url,
      error: errorMessage,
      request,
    });
    throw error;
  }
}

/**
 * Fetch related questions for a given query
 */
export async function getRelatedQuestions(query: string): Promise<RelatedQuestionsResponse> {
  const url = `${API_BASE_URL}/api/related-questions?query=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Request failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Related questions API error:', {
      url,
      error: errorMessage,
    });
    // Return empty array instead of throwing - related questions are not critical
    return { questions: [] };
  }
}

