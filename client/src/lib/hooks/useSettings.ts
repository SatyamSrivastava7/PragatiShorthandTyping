import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useGallery() {
  const queryClient = useQueryClient();

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: galleryApi.getImages,
    staleTime: 30000,
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
    images: images.map(img => img.url),
    isLoading,
    addImage: addMutation.mutateAsync,
    deleteImage: deleteMutation.mutateAsync,
  };
}

export function useSelectedCandidates() {
  const queryClient = useQueryClient();

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['selected-candidates'],
    queryFn: selectedCandidatesApi.getAll,
    staleTime: 30000,
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
    candidates,
    isLoading,
    addCandidate: createMutation.mutateAsync,
    deleteCandidate: deleteMutation.mutateAsync,
  };
}
