import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noticesApi } from "../api";
import type { Notice, InsertNotice } from "@shared/schema";

// Hook for lazy loading notices (don't fetch on mount)
export function useNotices(opts?: { enabled?: boolean; limit?: number; offset?: number; includeInactive?: boolean }) {
  const queryClient = useQueryClient();

  const { enabled = true, limit, offset, includeInactive } = opts || {};

  // Fetch notices with optional pagination and includeInactive flag.
  const { data: notices = [], isLoading, refetch } = useQuery({
    queryKey: ["notices", limit ?? null, offset ?? null, includeInactive ? 'inc' : 'pub'],
    queryFn: async () => {
      return await noticesApi.getPublic({ limit, offset, includeInactive });
    },
    enabled,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Create notice mutation
  const createMutation = useMutation({
    mutationFn: async (notice: InsertNotice) => {
      return await noticesApi.create(notice);
    },
    onSuccess: () => {
      // Invalidate notices queries so UI refreshes (public/admin variants)
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  // Create notice with file mutation
  const createWithFileMutation = useMutation({
    mutationFn: async ({ notice, pdfFile }: { notice: InsertNotice; pdfFile?: File }) => {
      // If no file, send JSON for better performance and simpler parsing
      if (!pdfFile) {
        return await noticesApi.create(notice);
      }
      
      // If file exists, send FormData
      const formData = new FormData();
      formData.append("heading", notice.heading);
      formData.append("content", notice.content);
      formData.append("pdf", pdfFile);
      return await noticesApi.createWithFile(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  // Helper function to call the mutation
  const createNoticeWithFile = async (
    notice: InsertNotice,
    pdfFile?: File
  ): Promise<Notice> => {
    return await createWithFileMutation.mutateAsync({ notice, pdfFile });
  };

  // Update notice mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: number } & Record<string, any>) => {
      const { id, ...data } = updates;
      return await noticesApi.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  // Delete notice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await noticesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notices"] });
    },
  });

  return {
    // Public/admin notices (paged)
    notices,
    isLoading,
    refetch,

    // Mutations
    createNotice: createMutation.mutate,
    createNoticeAsync: createMutation.mutateAsync,
    createNoticeWithFile,
    updateNotice: updateMutation.mutate,
    updateNoticeAsync: updateMutation.mutateAsync,
    deleteNotice: deleteMutation.mutate,
    deleteNoticeAsync: deleteMutation.mutateAsync,

    // States
    isCreating: createMutation.isPending || createWithFileMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: createMutation.error || createWithFileMutation.error || updateMutation.error || deleteMutation.error,
  };
}
