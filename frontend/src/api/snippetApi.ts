import axiosClient from "./axiosClient";

export interface Snippet {
  _id: string;
  owner: string;
  title: string;
  html: string;
  css: string;
  js: string;
  isPublic: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSnippetPayload {
  title: string;
  html: string;
  css: string;
  js: string;
  isPublic?: boolean;
}

export interface UpdateSnippetPayload {
  title?: string;
  html?: string;
  css?: string;
  js?: string;
  isPublic?: boolean;
}

export const snippetApi = {
  async listPublic(page = 1): Promise<Snippet[]> {
    const res = await axiosClient.get<Snippet[]>("/snippets", {
      params: { page },
    });
    return res.data;
  },

  async getById(id: string): Promise<Snippet> {
    const res = await axiosClient.get<Snippet>(`/snippets/${id}`);
    return res.data;
  },

  async create(payload: CreateSnippetPayload): Promise<Snippet> {
    const res = await axiosClient.post<Snippet>("/snippets", payload);
    return res.data;
  },

  async update(id: string, payload: UpdateSnippetPayload): Promise<Snippet> {
    const res = await axiosClient.put<Snippet>(`/snippets/${id}`, payload);
    return res.data;
  },

  async fork(id: string): Promise<Snippet> {
    const res = await axiosClient.post<Snippet>(`/snippets/${id}/fork`);
    return res.data;
  },

  // DELETE snippet
  async delete(id: string): Promise<{ message?: string }> {
    const res = await axiosClient.delete<{ message?: string }>(`/snippets/${id}`);
    return res.data;
  },
};
