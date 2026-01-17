export function useDictations() {
  // Dictations API removed server-side. Provide a harmless client-side stub so
  // components that import this hook don't crash. All operations are no-ops.
  return {
    dictations: [] as Array<unknown>,
    isLoading: false,
    createDictation: async () => undefined,
    toggleDictation: async () => undefined,
    deleteDictation: async () => undefined,
  };
}
