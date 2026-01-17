import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { settingsApi, galleryApi, selectedCandidatesApi } from '../api';

interface GalleryImage {
  url: string;
}

interface SelectedCandidate {
  id: number;
  name: string;
  designation: string;
  year: string;
  imageUrl: string;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onMutate: async (newSettings) => {
      await queryClient.cancelQueries({ queryKey: ['settings'] });
      const previousSettings = queryClient.getQueryData(['settings']);
      
      queryClient.setQueryData(['settings'], (old: any) => ({
        ...old,
        ...newSettings,
      }));
      
      return { previousSettings };
    },
    onError: (err, newSettings, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(['settings'], context.previousSettings);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateMutation.mutateAsync,
  };
}

export function useGallery(enabled: boolean = false) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['gallery'],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        return await galleryApi.getImagesPaged(18, pageParam);
      } catch (err) {
        console.error('Error fetching gallery images:', err);
        return [] as { url: string }[];
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any[], allPages: any[][]) => {
      // If we got 18 images, there might be more
      return lastPage.length === 18 ? allPages.reduce((acc, p) => acc + p.length, 0) : undefined;
    },
    enabled: enabled,
    staleTime: 30000,
    retry: 1,
    gcTime: 300000,
  });

  const addMutation = useMutation({
    mutationFn: galleryApi.addImage,
    onMutate: async (url) => {
      await queryClient.cancelQueries({ queryKey: ['gallery'] });
      const previousImages = queryClient.getQueryData<GalleryImage[]>(['gallery']);
      
      queryClient.setQueryData<GalleryImage[]>(['gallery'], (old = []) => [...old, { url }]);
      
      return { previousImages };
    },
    onError: (err, url, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['gallery'], context.previousImages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: galleryApi.deleteImage,
    onMutate: async (url) => {
      await queryClient.cancelQueries({ queryKey: ['gallery'] });
      const previousImages = queryClient.getQueryData<GalleryImage[]>(['gallery']);
      
      queryClient.setQueryData<GalleryImage[]>(['gallery'], (old = []) =>
        old.filter((img) => img.url !== url)
      );
      
      return { previousImages };
    },
    onError: (err, url, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['gallery'], context.previousImages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  return {
    images: (data?.pages || []).flatMap((page: any[]) => page.map((img: any) => img.url)),
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    addImage: addMutation.mutateAsync,
    deleteImage: deleteMutation.mutateAsync,
  };
}

export function useSelectedCandidates(enabled: boolean = false) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['selected-candidates'],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        return await selectedCandidatesApi.getPaged(10, pageParam);
      } catch (err) {
        console.error('Error fetching selected candidates:', err);
        return [] as { id: number; name: string; designation: string; year: string; imageUrl: string }[];
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any[], allPages: any[][]) => {
      return lastPage.length === 10 ? allPages.reduce((acc, p) => acc + p.length, 0) : undefined;
    },
    enabled: enabled,
    staleTime: 30000,
    retry: 1,
    gcTime: 300000,
  });

  const createMutation = useMutation({
    mutationFn: selectedCandidatesApi.create,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['selected-candidates'] });
      const previousCandidates = queryClient.getQueryData<SelectedCandidate[]>(['selected-candidates']);
      
      const optimisticCandidate: SelectedCandidate = {
        id: -Math.floor(Math.random() * 1000000),
        name: data.name,
        designation: data.designation,
        year: data.year,
        imageUrl: data.imageUrl,
      };
      
      queryClient.setQueryData<SelectedCandidate[]>(['selected-candidates'], (old = []) => [...old, optimisticCandidate]);
      
      return { previousCandidates };
    },
    onError: (err, data, context) => {
      if (context?.previousCandidates) {
        queryClient.setQueryData(['selected-candidates'], context.previousCandidates);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['selected-candidates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: selectedCandidatesApi.delete,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['selected-candidates'] });
      const previousCandidates = queryClient.getQueryData<SelectedCandidate[]>(['selected-candidates']);
      
      queryClient.setQueryData<SelectedCandidate[]>(['selected-candidates'], (old = []) =>
        old.filter((candidate) => candidate.id !== id)
      );
      
      return { previousCandidates };
    },
    onError: (err, id, context) => {
      if (context?.previousCandidates) {
        queryClient.setQueryData(['selected-candidates'], context.previousCandidates);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['selected-candidates'] });
    },
  });

  return {
    candidates: (data?.pages || []).flatMap((page: any[]) => page),
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    addCandidate: createMutation.mutateAsync,
    deleteCandidate: deleteMutation.mutateAsync,
  };
}
