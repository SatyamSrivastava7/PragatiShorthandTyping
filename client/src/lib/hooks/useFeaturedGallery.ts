import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { galleryApi } from '../api';

export function useFeaturedGallery() {
  const queryClient = useQueryClient();

  const {
    data: featuredImages = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['gallery', 'featured'],
    queryFn: async () => {
      try {
        const images = await galleryApi.getFeaturedImages();
        console.log('Featured images fetched:', images);
        return images;
      } catch (err) {
        console.error('Error fetching featured images:', err);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const { mutateAsync: updateImageOrder, isPending: isUpdating } = useMutation({
    mutationFn: (imageIds: number[]) => galleryApi.updateImageOrder(imageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery', 'featured'] });
    },
  });

  return {
    featuredImages,
    isLoading,
    error,
    isUpdating,
    updateImageOrder,
    refetch,
  };
}
