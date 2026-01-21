import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testFolderApi } from "@/lib/api";
import type { TestFolder } from "@shared/schema";

/**
 * Hook to fetch test folders by language with caching
 * Minimizes API calls by caching folder data with 5-minute stale time
 */
export const useTestFolders = (language: string) => {
  return useQuery({
    queryKey: ["testFolders", language],
    queryFn: () => testFolderApi.getByLanguage(language),
    staleTime: 5 * 60 * 1000, // 5 minutes before considering data stale
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
};

/**
 * Mutation to create a new test folder
 */
export const useCreateTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; language: string }) =>
      testFolderApi.create(data),
    onSuccess: (newFolder) => {
      // Invalidate the language-specific folders cache to refetch
      queryClient.invalidateQueries({
        queryKey: ["testFolders", newFolder.language],
      });
    },
  });
};

/**
 * Mutation to update a test folder name
 */
export const useUpdateTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { id: number; updates: { name: string } }) =>
      testFolderApi.update(data.id, data.updates),
    onSuccess: (updatedFolder) => {
      // Invalidate the language-specific folders cache to refetch
      queryClient.invalidateQueries({
        queryKey: ["testFolders", updatedFolder.language],
      });
    },
  });
};

/**
 * Mutation to delete a test folder
 */
export const useDeleteTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => testFolderApi.delete(id),
    onSuccess: (_data, id) => {
      // Invalidate all folder caches since we don't know which language was affected
      queryClient.invalidateQueries({
        queryKey: ["testFolders"],
      });
    },
  });
};
