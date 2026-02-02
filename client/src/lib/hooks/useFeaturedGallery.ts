import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { galleryApi } from '../api';

export function useFeaturedGallery(enabled: boolean = true) {
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
        console.log('Featured images fetched from API:', images.length > 0 ? images : 'No images');
        return images;
      } catch (err) {
        console.error('Error fetching featured images:', err);
        throw err;
      }
    },
    staleTime: 3 * 60 * 1000, // 3 minutes - keep data fresh
    gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer to avoid re-fetching
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    enabled, // Only fetch when enabled (e.g., when gallery tab is active)
  });

  const { mutateAsync: updateImageOrder, isPending: isUpdating } = useMutation({
    mutationFn: (imageIds: number[]) => {
      console.log('Calling API to update image order with IDs:', imageIds);
      return galleryApi.updateImageOrder(imageIds);
    },
    onSuccess: (data) => {
      console.log('Featured images updated successfully on server:', data);
      
      // Set data as stale so it will be refetched on next access
      queryClient.invalidateQueries({ 
        queryKey: ['gallery', 'featured'],
        exact: true 
      });
      
      // Immediately refetch to get latest data
      console.log('Refetching featured images...');
      return queryClient.refetchQueries({ 
        queryKey: ['gallery', 'featured'],
        exact: true,
        type: 'active'
      });
    },
    onError: (error) => {
      console.error('Failed to update featured images:', error);
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
