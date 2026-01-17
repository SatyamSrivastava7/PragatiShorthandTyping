import { useState, useRef, useEffect } from "react";
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  useAuth,
  usePdf,
} from "@/lib/hooks";
import type { Result } from "@shared/schema";
import { generateResultPDF } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
  PlayCircle,
  Download,
  FileText,
  ShoppingCart,
  Folder,
  ArrowLeft,
  Loader2,
  Mic,
  QrCode,
  Eye,
  Search,
  Keyboard,
  Clock,
  Award,
  BarChart,
  BookOpen,
  Camera,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResultTextAnalysis } from "@/components/ResultTextAnalysis";
import { queryClient } from "@/lib/queryClient";

export default function StudentDashboard() {
  const { user: currentUser } = useAuth();
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const {
    folders: pdfFolders,
    resources: pdfResources,
    resourcesLoading,
    purchasePdf: buyPdf,
    consumePdfPurchase,
  } = usePdf(!!currentFolder, currentFolder); // Only fetch resources when folder is selected
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const isMountedRef = useRef(true);
  const fileReaderRef = useRef<FileReader | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort FileReader if component unmounts during read
      if (fileReaderRef.current) {
        try {
          fileReaderRef.current.abort();
        } catch (e) {
          // FileReader.abort() may not be available in all browsers
        }
        fileReaderRef.current = null;
      }
    };
  }, []);

  // const qrCodeUrl = settings?.qrCodeUrl || "";

  const today = new Date();

  // PDF Store State
  const [processingPdf, setProcessingPdf] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPdfForPurchase, setSelectedPdfForPurchase] = useState<{
    id: string;
    price: number;
  } | null>(null);

  // Payment Gateway State
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Search State
  const [typingSearch, setTypingSearch] = useState("");
  const [shorthandSearch, setShorthandSearch] = useState("");

  // Selected language folders for each tab (null = show folders)
  const [selectedTypingLanguage, setSelectedTypingLanguage] = useState<string | null>(null);
  const [selectedShorthandLanguage, setSelectedShorthandLanguage] = useState<string | null>(null);
  // Active main tab
  const [activeTab, setActiveTab] = useState<string>('typing_tests');
  // Pagination settings
  const PAGE_SIZE = 6;
  const PAGE_SIZE_RESULTS = 5;

  // Typing: useInfiniteQuery per language (cached by react-query)
  const typingQuery = useInfiniteQuery({
    queryKey: ['content', 'enabled', 'list', 'typing', selectedTypingLanguage],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await (await import('@/lib/api')).contentApi.getEnabledList({ type: 'typing', language: selectedTypingLanguage || 'english', limit: PAGE_SIZE, offset: pageParam });
      return res;
    },
    initialPageParam: 0,
    enabled: activeTab === 'typing_tests' && !!selectedTypingLanguage,
    getNextPageParam: (lastPage: any[], pages: any[][]) => (lastPage.length === PAGE_SIZE ? pages.reduce((acc: number, p: any[]) => acc + p.length, 0) : undefined),
    staleTime: 1000 * 60 * 5,
  });

  // Shorthand: useInfiniteQuery per language (cached by react-query)
  const shorthandQuery = useInfiniteQuery({
    queryKey: ['content', 'enabled', 'list', 'shorthand', selectedShorthandLanguage],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await (await import('@/lib/api')).contentApi.getEnabledList({ type: 'shorthand', language: selectedShorthandLanguage || 'english', limit: PAGE_SIZE, offset: pageParam });
      return res;
    },
    initialPageParam: 0,
    enabled: activeTab === 'shorthand_tests' && !!selectedShorthandLanguage,
    getNextPageParam: (lastPage: any[], pages: any[][]) => (lastPage.length === PAGE_SIZE ? pages.reduce((acc: number, p: any[]) => acc + p.length, 0) : undefined),
    staleTime: 1000 * 60 * 5,
  });

  // paging is handled by react-query `useInfiniteQuery` (typingQuery, shorthandQuery)

  // Results: counts and paged lists (5 per page) for typing and shorthand
  // With proper caching: staleTime = when to fetch fresh, gcTime = when to discard from memory
  const resultsCountsQuery = useQuery({
    queryKey: ['results', 'counts', currentUser?.id],
    queryFn: async () => {
      return await (await import('@/lib/api')).resultsApi.getCounts({ studentId: currentUser?.id });
    },
    enabled: !!currentUser?.id, // Fetch on page load for header display
    staleTime: 1000 * 60 * 3, // 3 minutes - refetch if older
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in memory
  });

  const typingResultsQuery = useInfiniteQuery({
    queryKey: ['results', 'paged', 'typing', currentUser?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await (await import('@/lib/api')).resultsApi.getPaged({ studentId: currentUser?.id, type: 'typing', limit: PAGE_SIZE_RESULTS, offset: pageParam });
      return res;
    },
    initialPageParam: 0,
    enabled: activeTab === 'results' && !!currentUser?.id,
    getNextPageParam: (lastPage: any[], pages: any[][]) => (lastPage.length === PAGE_SIZE_RESULTS ? pages.reduce((acc: number, p: any[]) => acc + p.length, 0) : undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });

  const shorthandResultsQuery = useInfiniteQuery({
    queryKey: ['results', 'paged', 'shorthand', currentUser?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await (await import('@/lib/api')).resultsApi.getPaged({ studentId: currentUser?.id, type: 'shorthand', limit: PAGE_SIZE_RESULTS, offset: pageParam });
      return res;
    },
    initialPageParam: 0,
    enabled: activeTab === 'results' && !!currentUser?.id,
    getNextPageParam: (lastPage: any[], pages: any[][]) => (lastPage.length === PAGE_SIZE_RESULTS ? pages.reduce((acc: number, p: any[]) => acc + p.length, 0) : undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });

  // When selection or active tab changes, react-query handles fetching (enabled flag)
  useEffect(() => {
    // no-op: selection and activeTab drive `useInfiniteQuery` enabled state
  }, [selectedTypingLanguage, selectedShorthandLanguage, activeTab]);

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    if (!currentUser?.id) {
      toast({ variant: "destructive", title: "Error", description: "Please log in again to upload a profile picture." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Please select an image under 2MB." });
      return;
    }

    const userId = currentUser.id;
    setIsUploadingProfilePic(true);
    try {
      const reader = new FileReader();
      fileReaderRef.current = reader;
      reader.onload = async () => {
        if (!isMountedRef.current) return;
        try {
          const base64 = reader.result as string;
          const { usersApi } = await import('@/lib/api');
          await usersApi.update(userId, { profilePicture: base64 });
          if (!isMountedRef.current) return;
          await queryClient.invalidateQueries({ queryKey: ['session'] });
          if (!isMountedRef.current) return;
          toast({ title: "Profile picture updated!" });
        } catch (err) {
          if (!isMountedRef.current) return;
          toast({ variant: "destructive", title: "Upload failed", description: "Could not update profile picture." });
        } finally {
          if (isMountedRef.current) {
            setIsUploadingProfilePic(false);
          }
          fileReaderRef.current = null;
        }
      };
      reader.onerror = () => {
        if (!isMountedRef.current) return;
        toast({ variant: "destructive", title: "Failed to read file" });
        setIsUploadingProfilePic(false);
        fileReaderRef.current = null;
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({ variant: "destructive", title: "Upload failed", description: "Could not update profile picture." });
      setIsUploadingProfilePic(false);
    }
  };


  const groupTestsByLanguage = (tests: any[]) => {
    return tests.reduce<Record<string, any[]>>((acc, t) => {
      const lang = (t.language || "English").toString().toLowerCase();
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(t);
      return acc;
    }, {});
  };

  const getResultForContent = (contentId: string) => {
    // Get all results from typing query
    const typingPages = typingResultsQuery.data?.pages ?? [];
    const typingResult = typingPages.flat().find((r: any) => r.contentId !== null && r.contentId.toString() === contentId);
    if (typingResult) return typingResult;
    
    // Get all results from shorthand query
    const shorthandPages = shorthandResultsQuery.data?.pages ?? [];
    const shorthandResult = shorthandPages.flat().find((r: any) => r.contentId !== null && r.contentId.toString() === contentId);
    return shorthandResult;
  };

  const handleDownloadResult = (result: Result) => {
    try {
      generateResultPDF(result);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "There was an error generating your result PDF.",
      });
    }
  };

  const initiateBuyPdf = (pdfId: string, price: number) => {
    setSelectedPdfForPurchase({ id: pdfId, price });
    setShowPaymentModal(true);
  };

  const confirmPurchase = async () => {
    if (!selectedPdfForPurchase) return;

    setIsVerifyingPayment(true);

    // Mock payment gateway delay
    await new Promise((r) => setTimeout(r, 2000));

    buyPdf(parseInt(selectedPdfForPurchase.id));
    setProcessingPdf(null);
    setSelectedPdfForPurchase(null);
    setShowPaymentModal(false);
    setIsVerifyingPayment(false);


    toast({
      variant: "success",
      title: "Payment Successful",
      description: `Payment verified. You can now download the file.`,
    });
  };

  const handleDownloadPdf = (pdfId: string, pdfUrl: string) => {
    toast({
      variant: "info",
      title: "Downloading...",
      description: "Your PDF download has started.",
    });

    // Create temporary link to trigger download
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `resource_${pdfId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revert to Pay button (consume purchase)
    consumePdfPurchase(parseInt(pdfId));
  };

  const typingResultsCount = (resultsCountsQuery.data?.typing) ?? 0;
  const shorthandResultsCount = resultsCountsQuery.data?.shorthand ?? 0;

  // Fetch lightweight counts for UI (avoid fetching full lists just for counts)
  const countsQuery = useQuery({
    queryKey: ['content', 'counts', 'enabled'],
    queryFn: async () => {
      return await (await import('@/lib/api')).contentApi.getCounts({ enabled: true });
    },
    staleTime: 1000 * 60 * 2,
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white shadow-xl">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="w-16 h-16 border-2 border-white/30 shadow-lg">
                {currentUser?.profilePicture ? (
                  <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
                ) : null}
                <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                  {currentUser?.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => profilePicInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                disabled={isUploadingProfilePic}
                data-testid="button-upload-profile-pic"
              >
                {isUploadingProfilePic ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              </button>
              <input
                ref={profilePicInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleProfilePicUpload}
              />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">Welcome, {currentUser?.name}!</h1>
              <p className="text-blue-100 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">ID: {currentUser?.studentId}</span>
                Student Dashboard
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center min-w-[100px]">
              <p className="text-2xl font-bold">{countsQuery.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-blue-500" /> : (countsQuery.data?.typing ?? 0)}</p>
              <p className="text-xs text-blue-100">Typing Tests</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center min-w-[100px]">
              <p className="text-2xl font-bold">{countsQuery.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-orange-500" /> : (countsQuery.data?.shorthand ?? 0)}</p>
              <p className="text-xs text-blue-100">Shorthand</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-3 text-center min-w-[100px]">
              <p className="text-2xl font-bold">{(typingResultsCount + shorthandResultsCount)}</p>
              <p className="text-xs text-blue-100">Results</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 bg-white shadow-md border p-1.5 rounded-xl h-auto">
          <TabsTrigger
            value="typing_tests"
            className="rounded-lg py-2.5 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
          >
            <Keyboard className="h-4 w-4" /> Typing Tests
          </TabsTrigger>
          <TabsTrigger
            value="shorthand_tests"
            className="rounded-lg py-2.5 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
          >
            <Mic className="h-4 w-4" /> Shorthand
          </TabsTrigger>
          <TabsTrigger
            value="results"
            className="rounded-lg py-2.5 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
          >
            <BarChart className="h-4 w-4" /> My Results
          </TabsTrigger>
          <TabsTrigger
            value="store"
            className="rounded-lg py-2.5 gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-600 data-[state=active]:shadow-md transition-all font-medium"
          >
            <BookOpen className="h-4 w-4" /> PDF Store
          </TabsTrigger>
        </TabsList>

        <TabsContent value="typing_tests">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Keyboard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Typing Tests</h3>
                  <p className="text-sm text-muted-foreground">{countsQuery?.isLoading ? 'Loading...' : `${countsQuery?.data?.typing ?? 0} tests available`}</p>
                </div>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={typingSearch}
                  onChange={(e) => setTypingSearch(e.target.value)}
                  className="pl-10 bg-white shadow-sm"
                  data-testid="input-search-typing"
                />
              </div>
            </div>
          </div>
          {typingQuery?.isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-3 text-muted-foreground">Loading tests...</span>
            </div>
          ) : (
            <div>
              {!selectedTypingLanguage ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['english', 'hindi'].map((lang) => (
                    <div
                      key={lang}
                      onClick={() => setSelectedTypingLanguage(lang)}
                      className="cursor-pointer border rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Folder className="h-12 w-12 text-blue-500 fill-blue-100" />
                      <span className="font-medium text-center capitalize">{lang?.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedTypingLanguage(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h4 className="text-sm font-semibold capitalize">{selectedTypingLanguage} Typing Tests</h4>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {((typingQuery.data?.pages ?? []) as any[])
                      .flat()
                      .filter((t: any) => ((t.language || 'english').toString().toLowerCase()) === (selectedTypingLanguage || 'english'))
                      .filter((t: any) => t.title.toLowerCase().includes(typingSearch.toLowerCase()))
                      .map((test: any) => {
                        const result = getResultForContent(test.id?.toString());
                        const isCompleted = !!result;

                        return (
                          <Card
                            key={test.id}
                            className="flex flex-col border-0 shadow-md hover:shadow-lg transition-all overflow-hidden group"
                          >
                            <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600" />
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg leading-tight">{test.title}</CardTitle>
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium shrink-0 capitalize">
                                  {test.language || "English"}
                                </span>
                              </div>
                              <CardDescription className="text-xs text-muted-foreground mt-2">
                                {format(new Date(test.dateFor), "PPP")}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 pb-4">
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium text-foreground">{test.duration} min</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Keyboard className="h-4 w-4" />
                                  <span>Typing</span>
                                </div>
                              </div>
                            </CardContent>
                            <CardFooter className="pt-4 border-t bg-slate-50">
                              <Button
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-md group-hover:shadow-lg transition-shadow"
                                onClick={() => setLocation(`/test/${test.id}`)}
                              >
                                <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })}
                  </div>
                  {typingQuery.hasNextPage && (
                    <div className="flex justify-center mt-4">
                      <Button onClick={() => typingQuery.fetchNextPage()} disabled={typingQuery.isFetchingNextPage}>
                        {typingQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </TabsContent>

        <TabsContent value="shorthand_tests">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Mic className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Shorthand Tests</h3>
                  <p className="text-sm text-muted-foreground">{countsQuery?.isLoading ? 'Loading...' : `${countsQuery?.data?.shorthand ?? 0} tests available`}</p>
                </div>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tests..."
                  value={shorthandSearch}
                  onChange={(e) => setShorthandSearch(e.target.value)}
                  className="pl-10 bg-white shadow-sm"
                  data-testid="input-search-shorthand"
                />
              </div>
            </div>
          </div>
          {shorthandQuery?.isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              <span className="ml-3 text-muted-foreground">Loading tests...</span>
            </div>
          ) : (
            <div>
              {!selectedShorthandLanguage ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['english', 'hindi'].map((lang) => (
                    <div
                      key={lang}
                      onClick={() => setSelectedShorthandLanguage(lang)}
                      className="cursor-pointer border rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Folder className="h-12 w-12 text-orange-500 fill-orange-100" />
                      <span className="font-medium text-center capitalize">{lang}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedShorthandLanguage(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h4 className="text-sm font-semibold capitalize">{selectedShorthandLanguage} Shorthand Tests</h4>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {((shorthandQuery.data?.pages ?? []) as any[])
                      .flat()
                      .filter((t: any) => ((t.language || 'english').toString().toLowerCase()) === (selectedShorthandLanguage || 'english'))
                      .filter((t: any) => t.title.toLowerCase().includes(shorthandSearch.toLowerCase()))
                      .map((test: any) => {
                        const result = getResultForContent(test.id?.toString());
                        const isCompleted = !!result;

                        return (
                          <Card
                            key={test.id}
                            className="flex flex-col border-0 shadow-md hover:shadow-lg transition-all overflow-hidden group"
                          >
                            <div className="h-2 bg-gradient-to-r from-orange-500 to-amber-500" />
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-lg leading-tight">{test.title}</CardTitle>
                                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium shrink-0 capitalize">
                                  {test.language || "English"}
                                </span>
                              </div>
                              <CardDescription className="text-xs text-muted-foreground mt-2">
                                {format(new Date(test.dateFor), "PPP")}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 pb-4">
                              <div className="flex items-center gap-4 text-sm mb-3">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  <span className="font-medium text-foreground">{test.duration} min</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Mic className="h-4 w-4" />
                                  <span>Shorthand</span>
                                </div>
                              </div>
                              <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2">
                                Listen to Audio, Write on Paper, Type Here
                              </p>
                            </CardContent>
                            <CardFooter className="pt-4 border-t bg-slate-50">
                              <Button
                                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 shadow-md group-hover:shadow-lg transition-shadow"
                                onClick={() => setLocation(`/test/${test.id}`)}
                              >
                                <PlayCircle className="mr-2 h-4 w-4" /> Start Test
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })}
                  </div>
                  {shorthandQuery.hasNextPage && (
                    <div className="flex justify-center mt-4">
                      <Button onClick={() => shorthandQuery.fetchNextPage()} disabled={shorthandQuery.isFetchingNextPage}>
                        {shorthandQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">My Results</h3>
                <p className="text-sm text-muted-foreground">{(typingResultsCount + shorthandResultsCount)} total results</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-0 shadow-md bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-100">Typing Tests</p>
                    <p className="text-2xl font-bold mt-1">{typingResultsCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Keyboard className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-100">Shorthand Tests</p>
                    <p className="text-2xl font-bold mt-1">{shorthandResultsCount}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Mic className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-100">Total Results</p>
                    <p className="text-2xl font-bold mt-1">{(typingResultsCount + shorthandResultsCount)}</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl">
                    <Award className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-0">
            <CardContent className="p-0">
              <Tabs defaultValue="typing_results" className="w-full">
                <div className="px-6 pt-4 border-b bg-slate-50">
                  <TabsList className="bg-white shadow-sm">
                    <TabsTrigger value="typing_results" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
                      <Keyboard className="h-4 w-4 mr-2" /> Typing Results
                    </TabsTrigger>
                    <TabsTrigger value="shorthand_results" className="data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700">
                      <Mic className="h-4 w-4 mr-2" /> Shorthand Results
                    </TabsTrigger>
                  </TabsList>
                </div>

                {["typing", "shorthand"].map((type) => {
                  const resultsQuery = type === 'typing' ? typingResultsQuery : shorthandResultsQuery;
                  const pages = resultsQuery.data?.pages ?? [];
                  const flatResults = pages.flat();

                  return (
                  <TabsContent key={type} value={`${type}_results`} className="p-6">
                    <div className="space-y-3">
                      {flatResults.length > 0 ? flatResults.map((result: any) => (
                          <div
                            key={result.id}
                            className="p-4 rounded-xl border bg-white hover:shadow-md transition-shadow flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg ${type === 'typing' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                                {type === 'typing' ? <Keyboard className="h-5 w-5 text-blue-600" /> : <Mic className="h-5 w-5 text-orange-600" />}
                              </div>
                              <div>
                                <h4 className="font-semibold">{result.contentTitle}</h4>
                                <p className="text-xs text-muted-foreground">{format(new Date(result.submittedAt), "PPP p")}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {result.contentType === "typing" ? (
                                <div className="flex items-center gap-3">
                                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                                    {result.grossSpeed} WPM
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {result.mistakes} mistakes
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${result.result === "Pass" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                    }`}>
                                    {result.result}
                                  </span>
                                  <span className="text-sm text-muted-foreground">
                                    {result.mistakes} mistakes
                                  </span>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadResult(result)}
                                >
                                  <Download className="h-4 w-4 mr-1" /> PDF
                                </Button>

                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-4 w-4 mr-1" /> View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                    <DialogHeader>
                                      <DialogTitle>Result Analysis</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="font-semibold">
                                            Test:
                                          </span>{" "}
                                          {result.contentTitle}
                                        </div>
                                        <div>
                                          <span className="font-semibold">
                                            Date:
                                          </span>{" "}
                                          {format(
                                            new Date(result.submittedAt),
                                            "PPP",
                                          )}
                                        </div>
                                        <div>
                                          <span className="font-semibold">
                                            Duration:
                                          </span>{" "}
                                          {result.time} minutes
                                        </div>
                                        <div>
                                          <span className="font-semibold">
                                            Mistakes:
                                          </span>{" "}
                                          <span className="text-red-600 font-bold">
                                            {result.mistakes}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="font-semibold">
                                            Total Original Words:
                                          </span>{" "}
                                          <span>
                                            {
                                              (result.originalText || "")
                                                .trim()
                                                .split(/\s+/).length
                                            }
                                          </span>
                                        </div>
                                        <div>
                                          {result.contentType === "typing" ? (
                                            <span>
                                              <span className="font-semibold">
                                                Gross Speed:
                                              </span>{" "}
                                              {result.grossSpeed} WPM
                                            </span>
                                          ) : (
                                            <span>
                                              <span className="font-semibold">
                                                Result:
                                              </span>{" "}
                                              <span
                                                className={
                                                  result.result === "Pass"
                                                    ? "text-green-600 font-bold"
                                                    : "text-red-600 font-bold"
                                                }
                                              >
                                                {" "}
                                                {result.result}
                                              </span>{" "}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="border rounded p-4 bg-muted/30">
                                        <h4 className="font-semibold mb-2">
                                          Your Input
                                        </h4>
                                        <ResultTextAnalysis
                                          originalText={result.originalText || ""}
                                          typedText={result.typedText}
                                          language={(result.language as 'english' | 'hindi') || undefined}
                                        />
                                      </div>

                                      <div className="border rounded p-4 bg-muted/30">
                                        <h4 className="font-semibold mb-2">
                                          Original Text
                                        </h4>
                                        <p className="text-sm whitespace-pre-wrap">
                                          {result.originalText}
                                        </p>
                                      </div>

                                      <div className="flex justify-end pt-4">
                                        <Button
                                          onClick={() =>
                                            handleDownloadResult(result)
                                          }
                                        >
                                          <Download className="mr-2 h-4 w-4" />{" "}
                                          Download PDF Report
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                          <div className={`flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-xl ${type === 'typing' ? 'border-blue-200 bg-blue-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                            <div className={`p-3 rounded-full mb-3 ${type === 'typing' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                              {type === 'typing' ? <Keyboard className="h-6 w-6 text-blue-400" /> : <Mic className="h-6 w-6 text-orange-400" />}
                            </div>
                            <p className="text-gray-600 font-medium">No {type} results yet</p>
                            <p className="text-sm text-muted-foreground mt-1">Complete a test to see your results here</p>
                          </div>
                        )}
                      {/* Load more button */}
                      {resultsQuery.hasNextPage && (
                        <div className="flex justify-center mt-4">
                          <Button onClick={() => resultsQuery.fetchNextPage()} disabled={resultsQuery.isFetchingNextPage}>
                            {resultsQuery.isFetchingNextPage ? 'Loading...' : 'Load more'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {currentFolder && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentFolder(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <CardTitle>
                  {currentFolder
                    ? pdfFolders.find((f) => f.id === parseInt(currentFolder))?.name
                    : "PDF Store"}
                </CardTitle>
              </div>
              <CardDescription>
                {currentFolder
                  ? "Browse and purchase study materials."
                  : "Select a folder to browse PDFs."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!currentFolder ? (
                // Folder View
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {pdfFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setCurrentFolder(folder.id.toString())}
                      className="cursor-pointer border rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors"
                    >
                      <Folder className="h-12 w-12 text-blue-500 fill-blue-100" />
                      <span className="font-medium text-center">
                        {folder.name}
                      </span>
                    </div>
                  ))}
                  {pdfFolders.length === 0 && (
                    <p className="col-span-full text-center text-muted-foreground">
                      No folders available.
                    </p>
                  )}
                </div>
              ) : (
                // PDF List View
                <div className="space-y-4">
                  {resourcesLoading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="ml-3 text-muted-foreground">Loading PDFs...</span>
                    </div>
                  ) : (
                    <>
                      {pdfResources
                        .filter((p) => p.folderId?.toString() === currentFolder)
                        .map((pdf) => {
                          const isPurchased = currentUser?.purchasedPdfs?.includes(
                            pdf.id.toString(),
                          );

                          return (
                            <div
                              key={pdf.id}
                              className="flex items-center justify-between p-4 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-red-500" />
                                <div>
                                  <h4 className="font-medium">{pdf.name}</h4>
                                  <p className="text-xs text-muted-foreground">
                                    {pdf.pageCount} Pages
                                  </p>
                                </div>
                              </div>

                              <div>
                                {isPurchased ? (
                                  <Button
                                    variant="outline"
                                    className="text-green-600 border-green-200 bg-green-50"
                                    onClick={() =>
                                      handleDownloadPdf(pdf.id.toString(), pdf.url)
                                    }
                                  >
                                    <Download className="mr-2 h-4 w-4" /> Download
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() =>
                                      initiateBuyPdf(pdf.id.toString(), parseInt(pdf.price))
                                    }
                                    disabled={processingPdf === pdf.id.toString()}
                                  >
                                    {processingPdf === pdf.id.toString() ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <ShoppingCart className="mr-2 h-4 w-4" />
                                    )}
                                    Buy for ₹{pdf.price}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {pdfResources.filter((p) => p.folderId?.toString() === currentFolder)
                        .length === 0 && (
                          <p className="text-center text-muted-foreground">
                            No PDFs in this folder.
                          </p>
                        )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Secure Payment Gateway</DialogTitle>
            <DialogDescription>
              Complete your purchase of ₹{selectedPdfForPurchase?.price}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <QrCode size={20} />
              <span className="font-medium">UPI Payment</span>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=pragatiinstiute@sbi&pn=PragatiInstitute&am=${selectedPdfForPurchase?.price}&cu=INR`}
                alt="Payment QR"
                className="w-48 h-48 object-contain"
              />
            </div>
            <p className="text-sm font-medium text-center mb-1">
              Scan to Pay ₹{selectedPdfForPurchase?.price}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Use any UPI App (GPay, PhonePe, Paytm)
            </p>
          </div>

          <DialogFooter className="sm:justify-between flex-row items-center gap-4 mt-4">
            <div className="text-xs text-muted-foreground flex-1">
              Secured by SSL Encryption
            </div>
            <Button
              onClick={confirmPurchase}
              disabled={isVerifyingPayment}
              className="w-full sm:w-auto"
            >
              {isVerifyingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                `Pay ₹${selectedPdfForPurchase?.price}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
