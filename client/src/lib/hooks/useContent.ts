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
      queryFn: contentApi.getAllList,
      staleTime: 60000,
    });
  }, [queryClient]);
}

export function useContentById(id: number | undefined) {
  return useQuery({
    queryKey: ['content', 'full', id],
    queryFn: () => contentApi.getById(id!),
    enabled: !!id,
    staleTime: 60000,
    gcTime: 300000,
  });
}

export function useContent() {
  const queryClient = useQueryClient();

  // Use lightweight endpoint (excludes text field) for faster initial loading
  // Full content is loaded on-demand when needed (e.g., preview dialogs)
  const { data: content = [], isLoading } = useQuery({
    queryKey: ['content', 'list'],
    queryFn: contentApi.getAllList,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Use lightweight endpoint (excludes text field) for faster initial loading
  // Full content is loaded on-demand when user starts a test via useContentById
  const { data: enabledContent = [], isLoading: isEnabledLoading } = useQuery({
    queryKey: ['content', 'enabled', 'list'],
    queryFn: contentApi.getEnabledList,
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled', 'list'] });
    },
  });

  // Mutation for FormData uploads (faster, no client-side base64 conversion)
  const createWithFileMutation = useMutation({
    mutationFn: contentApi.createWithFile,
    onSettled: () => {
      // Invalidate all content queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled', 'list'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => {
      if (id < 0) {
        return Promise.resolve(null);
      }
      return contentApi.toggle(id);
    },
    onMutate: async (id) => {
      if (id < 0) return;
      await queryClient.cancelQueries({ queryKey: ['content', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled', 'list'] });
      
      const previousContent = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list']);
      const previousEnabled = queryClient.getQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list']);
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'list'], (old = []) =>
        old.map((item) =>
          item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
        )
      );
      
      queryClient.setQueryData<Omit<Content, 'text' | 'mediaUrl'>[]>(['content', 'enabled', 'list'], (old = []) => {
        const item = previousContent?.find(c => c.id === id);
        if (!item) return old;
        if (item.isEnabled) {
          return old.filter(c => c.id !== id);
        } else {
          return [...old, { ...item, isEnabled: true }];
        }
      });
      
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
    createContent: createMutation.mutateAsync,
    createContentWithFile: createWithFileMutation.mutateAsync,
    toggleContent: toggleMutation.mutateAsync,
    deleteContent: deleteMutation.mutateAsync,
  };
}
