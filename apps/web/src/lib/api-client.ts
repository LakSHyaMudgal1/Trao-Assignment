/**
 * API Client for PrepKit Web Application
 * Handles authentication headers, credentials forwarding, and standard error parsing.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorBody.error || errorMessage;
    } catch {
      // Ignore JSON parse error on non-JSON response
    }
    throw new Error(errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Kits
  async getKits(): Promise<any[]> {
    const res = await request<{ status: string; data: { kits: any[] } }>('/api/kits');
    return res.data.kits;
  },

  async getKit(id: string): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(`/api/kits/${id}`);
    return res.data.kit;
  },

  async updateKit(id: string, data: any): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(`/api/kits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data.kit;
  },

  async deleteKit(id: string): Promise<void> {
    await request(`/api/kits/${id}`, { method: 'DELETE' });
  },

  async exportAppendixA(id: string): Promise<any> {
    return request<any>(`/api/kits/${id}/export`);
  },

  // Brief
  async updateBrief(id: string, brief: { summary: string; what_they_do: string }): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(`/api/kits/${id}/brief`, {
      method: 'PATCH',
      body: JSON.stringify(brief),
    });
    return res.data.kit;
  },

  // Questions
  async addQuestion(
    kitId: string,
    question: {
      prompt: string;
      answer_outline: string;
      category: 'technical' | 'behavioural' | 'system-design' | 'company-fit';
      difficulty: number;
      requirement_ids: string[];
    }
  ): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(`/api/kits/${kitId}/questions`, {
      method: 'POST',
      body: JSON.stringify(question),
    });
    return res.data.kit;
  },

  async updateQuestion(
    kitId: string,
    questionId: string,
    patch: {
      prompt?: string;
      answer_outline?: string;
      category?: string;
      difficulty?: number;
      requirement_ids?: string[];
      is_pinned?: boolean;
    }
  ): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/questions/${questionId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    );
    return res.data.kit;
  },

  async deleteQuestion(kitId: string, questionId: string): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/questions/${questionId}`,
      {
        method: 'DELETE',
      }
    );
    return res.data.kit;
  },

  async reorderQuestions(kitId: string, orderedIds: string[]): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/questions/reorder`,
      {
        method: 'PUT',
        body: JSON.stringify({ ordered_ids: orderedIds }),
      }
    );
    return res.data.kit;
  },

  // Flashcards
  async addFlashcard(
    kitId: string,
    card: { front: string; back: string; requirement_ids: string[] }
  ): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(`/api/kits/${kitId}/flashcards`, {
      method: 'POST',
      body: JSON.stringify(card),
    });
    return res.data.kit;
  },

  async updateFlashcard(
    kitId: string,
    cardId: string,
    patch: { front?: string; back?: string; requirement_ids?: string[] }
  ): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/flashcards/${cardId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }
    );
    return res.data.kit;
  },

  async deleteFlashcard(kitId: string, cardId: string): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/flashcards/${cardId}`,
      {
        method: 'DELETE',
      }
    );
    return res.data.kit;
  },

  async recordFlashcardReview(kitId: string, cardId: string, confidence: number): Promise<any> {
    const res = await request<{ status: string; data: { kit: any } }>(
      `/api/kits/${kitId}/flashcards/${cardId}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ confidence }),
      }
    );
    return res.data.kit;
  },

  // Generation
  async generateKit(data: { company_url: string; jd: string; days: number }): Promise<{
    jobId: string;
    statusUrl: string;
    streamUrl: string;
  }> {
    const res = await request<{
      status: string;
      data: { jobId: string; statusUrl: string; streamUrl: string };
    }>('/api/kits/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  },

  async getJobStatus(jobId: string): Promise<any> {
    const res = await request<{ status: string; data: { job: any } }>(`/api/jobs/${jobId}`);
    return res.data.job;
  },

  async regenerateSection(
    kitId: string,
    target: 'company_brief' | 'category' | 'schedule',
    category?: string
  ): Promise<{ kit: any; report: any }> {
    const res = await request<{ status: string; data: { kit: any; report: any } }>(
      `/api/kits/${kitId}/regenerate`,
      {
        method: 'POST',
        body: JSON.stringify({ target, category }),
      }
    );
    return res.data;
  },
};
