import { create } from 'zustand'
import { Repository, FileNode, ArchitectureReport } from '@/lib/types'
import apiClient from '@/lib/api/client'

interface RepoStore {
  repositories: Repository[]
  currentRepo: Repository | null
  fileTree: FileNode[]
  selectedFile: FileNode | null
  architectureReport: ArchitectureReport | null
  isLoadingRepo: boolean
  isLoadingTree: boolean
  isLoadingArchitecture: boolean
  error: string | null

  setRepositories: (repos: Repository[]) => void
  setCurrentRepo: (repo: Repository | null) => void
  setSelectedFile: (file: FileNode | null) => void
  fetchRepo: (repoId: string) => Promise<void>
  fetchFileTree: (repoId: string) => Promise<void>
  fetchArchitecture: (repoId: string) => Promise<void>
  updateRepoStatus: (repoId: string, status: Repository['indexStatus'], progress?: number) => void
  clearError: () => void
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repositories: [],
  currentRepo: null,
  fileTree: [],
  selectedFile: null,
  architectureReport: null,
  isLoadingRepo: false,
  isLoadingTree: false,
  isLoadingArchitecture: false,
  error: null,

  setRepositories: (repos) => set({ repositories: repos }),

  setCurrentRepo: (repo) => set({ currentRepo: repo }),

  setSelectedFile: (file) => set({ selectedFile: file }),

  fetchRepo: async (repoId: string) => {
    set({ isLoadingRepo: true, error: null })
    try {
      const response = await apiClient.get(`/repositories/${repoId}`)
      set({ currentRepo: response.data, isLoadingRepo: false })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to fetch repository', isLoadingRepo: false })
    }
  },

  fetchFileTree: async (repoId: string) => {
    set({ isLoadingTree: true })
    try {
      const response = await apiClient.get(`/repositories/${repoId}/tree`)
      set({ fileTree: response.data, isLoadingTree: false })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to fetch file tree', isLoadingTree: false })
    }
  },

  fetchArchitecture: async (repoId: string) => {
    // Check cache
    const { architectureReport, currentRepo } = get()
    if (architectureReport && currentRepo?.id === repoId) return

    set({ isLoadingArchitecture: true })
    try {
      const response = await apiClient.get(`/repositories/${repoId}/architecture`)
      set({ architectureReport: response.data, isLoadingArchitecture: false })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to fetch architecture', isLoadingArchitecture: false })
    }
  },

  updateRepoStatus: (repoId, status, progress) => {
    set((state) => ({
      repositories: state.repositories.map((r) =>
        r.id === repoId ? { ...r, indexStatus: status, indexProgress: progress } : r
      ),
      currentRepo:
        state.currentRepo?.id === repoId
          ? { ...state.currentRepo, indexStatus: status, indexProgress: progress }
          : state.currentRepo,
    }))
  },

  clearError: () => set({ error: null }),
}))
