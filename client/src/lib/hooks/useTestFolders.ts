import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testFolderApi } from "@/lib/api";
import type { TestFolder } from "@shared/schema";

const FOLDERS_PAGE_SIZE = 6;

/**
 * Hook to fetch test folders by language with caching
 * Caches folder data across the entire app to avoid unnecessary API calls
 * Stale time: 30 minutes - reduces refetches when navigating between tabs
 * Cache time: 1 hour - keeps data available even after tab switches
 */
export const useTestFolders = (language: string, type?: string) => {
  return useQuery({
    queryKey: ["testFolders", language, type],
    queryFn: () => testFolderApi.getByLanguage(language, type),
    staleTime: 30 * 60 * 1000, // 30 minutes before considering data stale
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    retry: 1, // Retry once on failure
    enabled: !!language, // Only run if language is provided
  });
};

/**
 * Hook to fetch latest test folders by language with pagination
 * Returns paginated results with "load more" functionality
 * Uses same cache settings as useTestFolders for consistency
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
    staleTime: 30 * 60 * 1000, // 30 minutes - consistent with useTestFolders
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

/**
 * Mutation to create a new test folder
 * Invalidates folder caches for the specific language and type to ensure fresh data
 */
export const useCreateTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; language: string; type: string }) =>
      testFolderApi.create(data),
    onSuccess: (newFolder) => {
      const folderType = newFolder.type || "typing";
      const folderLanguage = newFolder.language || "english";
      
      // Invalidate the specific language+type cache with exact queryKey match
      queryClient.invalidateQueries({
        queryKey: ["testFolders", folderLanguage, folderType],
        exact: true,
      });
      
      // Also invalidate all latest folders cache
      queryClient.invalidateQueries({
        queryKey: ["testFolders", "latest"],
      });
    },
  });
};

/**
 * Mutation to update a test folder name
 * Invalidates caches for the folder's language and type
 */
export const useUpdateTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { id: number; updates: { name: string } }) =>
      testFolderApi.update(data.id, data.updates),
    onSuccess: (updatedFolder) => {
      const folderType = updatedFolder.type || "typing";
      const folderLanguage = updatedFolder.language || "english";
      
      // Invalidate the specific language+type cache with exact queryKey match
      queryClient.invalidateQueries({
        queryKey: ["testFolders", folderLanguage, folderType],
        exact: true,
      });
      
      // Also invalidate all latest folders cache
      queryClient.invalidateQueries({
        queryKey: ["testFolders", "latest"],
      });
    },
  });
};

/**
 * Mutation to delete a test folder
 * Invalidates all folder caches to ensure consistency across the app
 */
export const useDeleteTestFolder = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => testFolderApi.delete(id),
    onSuccess: () => {
      // Invalidate all testFolder queries to ensure data consistency across app
      // This handles deletion since we don't know the folder's language/type details
      queryClient.invalidateQueries({
        queryKey: ["testFolders"],
      });
    },
  });
};
