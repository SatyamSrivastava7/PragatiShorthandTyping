import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testFolderApi } from "@/lib/api";
import type { TestFolder } from "@shared/schema";

const FOLDERS_PAGE_SIZE = 6;

/**
 * Hook to fetch test folders by language with caching
 * Minimizes API calls by caching folder data with 5-minute stale time
 */
export const useTestFolders = (language: string, type?: string) => {
  return useQuery({
    queryKey: ["testFolders", language, type],
    queryFn: () => testFolderApi.getByLanguage(language, type),
    staleTime: 5 * 60 * 1000, // 5 minutes before considering data stale
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Retry once on failure
    enabled: !!language, // Only run if language is provided
  });
};

/**
 * Hook to fetch latest test folders by language with pagination
 * Returns paginated results with "load more" functionality
 */
export const useLatestTestFolders = (language: string, limit: number = FOLDERS_PAGE_SIZE, type?: string) => {
  return useInfiniteQuery({
    queryKey: ["testFolders", "latest", language, limit, type],
    queryFn: async ({ pageParam = 0 }) => {
      return await testFolderApi.getLatestByLanguage(language, limit, pageParam, type);
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: TestFolder[], pages: TestFolder[][]) => {
      // If the last page has fewer items than the limit, there are no more pages
      if (lastPage.length < limit) {
        return undefined;
      }
      // Otherwise, calculate the offset for the next page
      return pages.reduce((acc, p) => acc + p.length, 0);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Mutation to create a new test folder
 */
export const useCreateTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; language: string; type?: string }) =>
      testFolderApi.create(data),
    onSuccess: (newFolder) => {
      // Invalidate the language-specific folders cache to refetch
      queryClient.invalidateQueries({
        queryKey: ["testFolders", newFolder.language],
      });
      // Also invalidate latest folders cache
      queryClient.invalidateQueries({
        queryKey: ["testFolders", "latest", newFolder.language],
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
      // Also invalidate latest folders cache
      queryClient.invalidateQueries({
        queryKey: ["testFolders", "latest", updatedFolder.language],
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
