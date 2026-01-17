import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { contentApi } from '../api';
import type { Content } from '@shared/schema';

export function usePrefetchContent() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    // Prefetch lightweight content list (excludes text and mediaUrl) for faster initial load
    queryClient.prefetchQuery({
      queryKey: ['content', 'list'],
      queryFn: async () => {
        return await contentApi.getAllList();
      },
      staleTime: 60000,
    });
  }, [queryClient]);
}

export function useContentById(id: number | undefined) {
  return useQuery({
    queryKey: ['content', 'full', id],
    queryFn: () => contentApi.getById(id!),
    enabled: !!id, // Only fetch when id is provided (dialog is opened)
    staleTime: 60000,
    gcTime: 300000,
    // Don't refetch on window focus or mount if data exists
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useContent() {
  const queryClient = useQueryClient();

  // Use lightweight endpoint (excludes text field) for faster initial loading
  // Full content is loaded on-demand when needed (e.g., preview dialogs)
  const { data: content = [], isLoading, error } = useQuery({
    queryKey: ['content', 'list'],
    queryFn: async () => {
      try {
        return await contentApi.getAllList();
      } catch (err) {
        console.error('Error fetching content list:', err);
        throw err;
      }
    },
    staleTime: 60000,
    gcTime: 300000,
    retry: 2,
  });

  // Use lightweight endpoint (excludes text field) for faster initial loading
  // Full content is loaded on-demand when user starts a test via useContentById
  const { data: enabledContent = [], isLoading: isEnabledLoading } = useQuery({
    queryKey: ['content', 'enabled', 'list'],
    queryFn: async () => {
      try {
        return await contentApi.getEnabledList();
      } catch (err) {
        console.error('Error fetching enabled content list:', err);
        throw err;
      }
    },
    staleTime: 60000,
    gcTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: contentApi.create,
    onMutate: async (newContent) => {
      await queryClient.cancelQueries({ queryKey: ['content', 'list'] });
      const previousContent = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list']);
      
      const { text, mediaUrl, ...optimisticContent } = {
        id: -Math.floor(Math.random() * 1000000),
        title: newContent.title,
        type: newContent.type,
        text: newContent.text,
        duration: newContent.duration,
        dateFor: newContent.dateFor,
        language: newContent.language || 'english',
        mediaUrl: newContent.mediaUrl || null,
        isEnabled: false,
        autoScroll: true,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) => [optimisticContent, ...old]);
      
      return { previousContent };
    },
    onError: (err, newContent, context) => {
      if (context?.previousContent) {
        queryClient.setQueryData(['content', 'list'], context.previousContent);
      }
    },
    onSuccess: (newContent) => {
      // Update with real data from server (without refetching entire list)
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) => {
        const { text, mediaUrl, ...contentWithoutLargeFields } = newContent;
        return old.map(item => 
          item.id < 0 ? contentWithoutLargeFields : item
        );
      });
    },
    onSettled: () => {
      // Only invalidate enabled list, not the full list (to avoid refetching all audio files)
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled', 'list'] });
      // Don't invalidate the main list - we've already updated it optimistically
    },
  });

  // Mutation for FormData uploads (faster, no client-side base64 conversion)
  const createWithFileMutation = useMutation({
    mutationFn: contentApi.createWithFile,
    onMutate: async (formData) => {
      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['content', 'list'] });
      const previousContent = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list']);
      
      // Extract title from FormData for optimistic update
      const title = formData.get('title') as string;
      const type = formData.get('type') as 'typing' | 'shorthand';
      const duration = parseInt(formData.get('duration') as string);
      const dateFor = formData.get('dateFor') as string;
      const language = (formData.get('language') as string) || 'english';
      const autoScroll = formData.get('autoScroll') === 'true';
      
      // Optimistic update - add new content without mediaUrl/text
      const optimisticContent: Omit<Content, 'text' | 'mediaUrl'> = {
        id: -Math.floor(Math.random() * 1000000),
        title,
        type,
        duration,
        dateFor,
        language: language as 'english' | 'hindi',
        isEnabled: false,
        autoScroll,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) => [optimisticContent, ...old]);
      
      return { previousContent };
    },
    onError: (err, formData, context) => {
      // Rollback on error
      if (context?.previousContent) {
        queryClient.setQueryData(['content', 'list'], context.previousContent);
      }
    },
    onSuccess: (newContent) => {
      // Update with real data from server (without refetching entire list)
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) => {
        const { text, mediaUrl, ...contentWithoutLargeFields } = newContent;
        return old.map(item => 
          item.id < 0 ? contentWithoutLargeFields : item
        );
      });
    },
    onSettled: () => {
      // Only invalidate enabled list, not the full list (to avoid refetching all audio files)
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled', 'list'] });
      // Don't invalidate the main list - we've already updated it optimistically
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => {
      if (id < 0) {
        return Promise.resolve({ id, isEnabled: false });
      }
      return contentApi.toggle(id);
    },
    onMutate: async (id) => {
      if (id < 0) return;
      await queryClient.cancelQueries({ queryKey: ['content', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled', 'list'] });
      
      const previousContent = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list']);
      const previousEnabled = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list']);
      
      // Optimistically update the list
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) =>
        old.map((item) =>
          item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
        )
      );
      
      // Optimistically update enabled list
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list'], (old = []) => {
        const item = previousContent?.find(c => c.id === id);
        if (!item) return old;
        const newIsEnabled = !item.isEnabled;
        if (newIsEnabled) {
          // Add to enabled list
          return [...old, { ...item, isEnabled: true }];
        } else {
          // Remove from enabled list
          return old.filter(c => c.id !== id);
        }
      });
      
      return { previousContent, previousEnabled };
    },
    onSuccess: (result, id) => {
      // Update with server response (lightweight - only id and isEnabled)
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) =>
        old.map((item) =>
          item.id === id ? { ...item, isEnabled: result.isEnabled } : item
        )
      );
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list'], (old = []) => {
        if (result.isEnabled) {
          // Add to enabled list if not already there
          const exists = old.some(c => c.id === id);
          if (!exists) {
            const item = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'])?.find(c => c.id === id);
            if (item) {
              return [...old, { ...item, isEnabled: true }];
            }
          }
          return old;
        } else {
          // Remove from enabled list
          return old.filter(c => c.id !== id);
        }
      });
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousContent) {
        queryClient.setQueryData(['content', 'list'], context.previousContent);
      }
      if (context?.previousEnabled) {
        queryClient.setQueryData(['content', 'enabled', 'list'], context.previousEnabled);
      }
    },
    // Don't invalidate queries - we've already updated optimistically
    // This prevents refetching all content with audio files
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      if (id < 0) {
        return Promise.resolve(null);
      }
      return contentApi.delete(id);
    },
    onMutate: async (id) => {
      if (id < 0) return;
      await queryClient.cancelQueries({ queryKey: ['content', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled', 'list'] });
      
      const previousContent = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list']);
      const previousEnabled = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list']);
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) =>
        old.filter((item) => item.id !== id)
      );
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list'], (old = []) =>
        old.filter((item) => item.id !== id)
      );
      
      return { previousContent, previousEnabled };
    },
    onError: (err, id, context) => {
      if (context?.previousContent) {
        queryClient.setQueryData(['content', 'list'], context.previousContent);
      }
      if (context?.previousEnabled) {
        queryClient.setQueryData(['content', 'enabled', 'list'], context.previousEnabled);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled', 'list'] });
    },
  });

  return {
    content,
    enabledContent,
    isLoading,
    isEnabledLoading,
    error,
    createContent: createMutation.mutateAsync,
    createContentWithFile: createWithFileMutation.mutateAsync,
    toggleContent: toggleMutation.mutateAsync,
    deleteContent: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isCreatingWithFile: createWithFileMutation.isPending,
  };
}
