import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { noticesApi } from "../api";
import type { Notice, InsertNotice } from "@shared/schema";

export function useNotices() {
  const queryClient = useQueryClient();

  // Fetch all active notices (for public view) - CACHED
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ["notices"],
    queryFn: async () => {
      return await noticesApi.getPublic();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch all notices including inactive (admin view) - CACHED
  const { data: allNotices = [], isLoading: isLoadingAll, refetch: refetchAll } = useQuery({
    queryKey: ["notices", "all"],
    queryFn: async () => {
      return await noticesApi.getAll();
    },
    enabled: false, // Only fetch when explicitly requested
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
      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      queryClient.invalidateQueries({ queryKey: ["notices", "all"] });
    },
  });

  // Create notice with file mutation
  const createNoticeWithFile = async (
    notice: InsertNotice,
    pdfFile?: File
  ): Promise<Notice> => {
    const formData = new FormData();
    formData.append("heading", notice.heading);
    formData.append("content", notice.content);
    if (pdfFile) {
      formData.append("pdf", pdfFile);
    }

    const result = await noticesApi.createWithFile(formData);
    
    // Invalidate both caches
    queryClient.invalidateQueries({ queryKey: ["notices"] });
    queryClient.invalidateQueries({ queryKey: ["notices", "all"] });
    
    return result;
  };

  // Update notice mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: number } & Record<string, any>) => {
      const { id, ...data } = updates;
      return await noticesApi.update(id, data);
    },
    onSuccess: () => {
      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      queryClient.invalidateQueries({ queryKey: ["notices", "all"] });
    },
  });

  // Delete notice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await noticesApi.delete(id);
    },
    onSuccess: () => {
      // Invalidate both caches
      queryClient.invalidateQueries({ queryKey: ["notices"] });
      queryClient.invalidateQueries({ queryKey: ["notices", "all"] });
    },
  });

  return {
    // Public notices
    notices,
    isLoading,
    
    // Admin notices
    allNotices,
    isLoadingAll,
    refetchAll,

    // Mutations
    createNotice: createMutation.mutate,
    createNoticeAsync: createMutation.mutateAsync,
    createNoticeWithFile,
    updateNotice: updateMutation.mutate,
    updateNoticeAsync: updateMutation.mutateAsync,
    deleteNotice: deleteMutation.mutate,
    deleteNoticeAsync: deleteMutation.mutateAsync,

    // States
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    error: createMutation.error || updateMutation.error || deleteMutation.error,
  };
}
