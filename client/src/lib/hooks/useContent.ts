import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { contentApi } from '../api';
import type { Content } from '@shared/schema';

export function usePrefetchContent() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['content'],
      queryFn: contentApi.getAll,
      staleTime: 60000,
    });
  }, [queryClient]);
}

export function useContent() {
  const queryClient = useQueryClient();

  const { data: content = [], isLoading } = useQuery({
    queryKey: ['content'],
    queryFn: contentApi.getAll,
    staleTime: 60000,
    gcTime: 300000,
  });

  const { data: enabledContent = [], isLoading: isEnabledLoading } = useQuery({
    queryKey: ['content', 'enabled'],
    queryFn: contentApi.getEnabled,
    staleTime: 60000,
    gcTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: contentApi.create,
    onMutate: async (newContent) => {
      await queryClient.cancelQueries({ queryKey: ['content'] });
      const previousContent = queryClient.getQueryData<Content[]>(['content']);
      
      const optimisticContent: Content = {
        id: Date.now(),
        title: newContent.title,
        type: newContent.type,
        text: newContent.text,
        duration: newContent.duration,
        dateFor: newContent.dateFor,
        language: newContent.language || 'english',
        mediaUrl: newContent.mediaUrl || null,
        isEnabled: false,
        createdAt: new Date(),
      };
      
      queryClient.setQueryData<Content[]>(['content'], (old = []) => [optimisticContent, ...old]);
      
      return { previousContent };
    },
    onError: (err, newContent, context) => {
      if (context?.previousContent) {
        queryClient.setQueryData(['content'], context.previousContent);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: contentApi.toggle,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['content'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled'] });
      
      const previousContent = queryClient.getQueryData<Content[]>(['content']);
      const previousEnabled = queryClient.getQueryData<Content[]>(['content', 'enabled']);
      
      queryClient.setQueryData<Content[]>(['content'], (old = []) =>
        old.map((item) =>
          item.id === id ? { ...item, isEnabled: !item.isEnabled } : item
        )
      );
      
      queryClient.setQueryData<Content[]>(['content', 'enabled'], (old = []) => {
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
        queryClient.setQueryData(['content'], context.previousContent);
      }
      if (context?.previousEnabled) {
        queryClient.setQueryData(['content', 'enabled'], context.previousEnabled);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contentApi.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['content'] });
      await queryClient.cancelQueries({ queryKey: ['content', 'enabled'] });
      
      const previousContent = queryClient.getQueryData<Content[]>(['content']);
      const previousEnabled = queryClient.getQueryData<Content[]>(['content', 'enabled']);
      
      queryClient.setQueryData<Content[]>(['content'], (old = []) =>
        old.filter((item) => item.id !== id)
      );
      
      queryClient.setQueryData<Content[]>(['content', 'enabled'], (old = []) =>
        old.filter((item) => item.id !== id)
      );
      
      return { previousContent, previousEnabled };
    },
    onError: (err, id, context) => {
      if (context?.previousContent) {
        queryClient.setQueryData(['content'], context.previousContent);
      }
      if (context?.previousEnabled) {
        queryClient.setQueryData(['content', 'enabled'], context.previousEnabled);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      queryClient.invalidateQueries({ queryKey: ['content', 'enabled'] });
    },
  });

  return {
    content,
    enabledContent,
    isLoading,
    isEnabledLoading,
    createContent: createMutation.mutateAsync,
    toggleContent: toggleMutation.mutateAsync,
    deleteContent: deleteMutation.mutateAsync,
  };
}
