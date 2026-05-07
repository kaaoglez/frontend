import { create } from 'zustand';

export type Section = 'dashboard' | 'disks' | 'library' | 'music' | 'radio' | 'movies' | 'tvshows' | 'images' | 'printers';

export interface MediaItem {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  extension: string;
  type: 'audio' | 'video';
}

export interface MediaFolder {
  name: string;
  path: string;
  itemCount: number;
}

export interface ServerStats {
  homeDir: string;
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  uptime: number;
  cpuCores: number;
  cpuModel: string;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  totalDiskSpace: number;
  freeDiskSpace: number;
  usedDiskSpace: number;
  diskUsagePercent: number;
  networkInterfaces: Array<{ name: string; address: string; family: string }>;
}

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
  extension?: string;
}

export interface PrintJob {
  id: string;
  fileName: string;
  filePath: string;
  printerName: string | null;
  status: string;
  copies: number;
  pages: number | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterInfo {
  name: string;
  status: string;
  isDefault: boolean;
  description?: string;
}

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  isbn?: string;
  publisher?: string;
  yearPublished?: number;
  pages?: number;
  language: string;
  format: string;
  coverUrl?: string;
  location?: string;
  status: string;
  rating?: number;
  notes?: string;
  categoryId?: string;
  category?: { id: string; name: string; color: string };
  tags?: Array<{ tagId: string; tag: { id: string; name: string } }>;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  color: string;
  isPredefined: boolean;
  order: number;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { books: number };
}

interface AppState {
  // Navigation
  currentSection: Section;
  setCurrentSection: (section: Section) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Server stats
  serverStats: ServerStats | null;
  setServerStats: (stats: ServerStats) => void;

  // Disk explorer
  currentPath: string;
  setCurrentPath: (path: string) => void;
  pathHistory: string[];
  setPathHistory: (history: string[]) => void;
  diskPaths: string[];
  setDiskPaths: (paths: string[]) => void;
  selectedFiles: string[];
  setSelectedFiles: (files: string[]) => void;
  toggleFileSelection: (path: string) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;

  // Library
  libraryCurrentPath: string;
  setLibraryCurrentPath: (path: string) => void;
  libraryPathHistory: string[];
  setLibraryPathHistory: (history: string[]) => void;
  libraryLibraryPaths: string[];
  setLibraryLibraryPaths: (paths: string[]) => void;

  // Music
  musicBasePath: string;
  setMusicBasePath: (path: string) => void;
  musicLibraryPaths: string[];
  setMusicLibraryPaths: (paths: string[]) => void;
  musicCurrentPath: string;
  setMusicCurrentPath: (path: string) => void;
  musicPathHistory: string[];
  setMusicPathHistory: (history: string[]) => void;
  currentTrack: MediaItem | null;
  setCurrentTrack: (track: MediaItem | null) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  musicQueue: MediaItem[];
  setMusicQueue: (queue: MediaItem[]) => void;
  shuffleMode: boolean;
  setShuffleMode: (shuffle: boolean) => void;
  repeatMode: 'none' | 'all' | 'one';
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;

  // Movies
  movieBasePath: string;
  setMovieBasePath: (path: string) => void;
  movieLibraryPaths: string[];
  setMovieLibraryPaths: (paths: string[]) => void;
  movieCurrentPath: string;
  setMovieCurrentPath: (path: string) => void;
  moviePathHistory: string[];
  setMoviePathHistory: (history: string[]) => void;
  currentMovie: MediaItem | null;
  setCurrentMovie: (movie: MediaItem | null) => void;

  // TV Shows
  tvshowBasePath: string;
  setTvshowBasePath: (path: string) => void;
  tvshowLibraryPaths: string[];
  setTvshowLibraryPaths: (paths: string[]) => void;
  tvshowCurrentPath: string;
  setTvshowCurrentPath: (path: string) => void;
  tvshowPathHistory: string[];
  setTvshowPathHistory: (history: string[]) => void;

  // Radio
  radioStation: { id: string; name: string; genre: string; url: string; country: string } | null;
  setRadioStation: (station: { id: string; name: string; genre: string; url: string; country: string } | null) => void;
  radioPlaying: boolean;
  setRadioPlaying: (playing: boolean) => void;
  radioVolume: number;
  setRadioVolume: (volume: number) => void;

  // Images
  imageBasePath: string;
  setImageBasePath: (path: string) => void;
  imageLibraryPaths: string[];
  setImageLibraryPaths: (paths: string[]) => void;
  imageCurrentPath: string;
  setImageCurrentPath: (path: string) => void;
  imagePathHistory: string[];
  setImagePathHistory: (history: string[]) => void;
  currentImage: MediaItem | null;
  setCurrentImage: (image: MediaItem | null) => void;

  // Sleep Timer
  sleepTimerEnabled: boolean;
  setSleepTimerEnabled: (enabled: boolean) => void;
  stopAllMedia: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentSection: 'dashboard',
  setCurrentSection: (section) => set({ currentSection: section }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  // Server stats
  serverStats: null,
  setServerStats: (stats) => set({ serverStats: stats }),

  // Disk explorer
  currentPath: '/',
  setCurrentPath: (path) => set({ currentPath: path }),
  pathHistory: ['/'],
  setPathHistory: (history) => set({ pathHistory: history }),
  diskPaths: ['/mnt/Canal', '/mnt/Tools', '/home/osmany'],
  setDiskPaths: (paths) => set({ diskPaths: paths }),
  selectedFiles: [],
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  toggleFileSelection: (path) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(path)
        ? state.selectedFiles.filter((f) => f !== path)
        : [...state.selectedFiles, path],
    })),
  viewMode: 'grid',
  setViewMode: (mode) => set({ viewMode: mode }),

  // Library
  libraryCurrentPath: '/mnt/Canal',
  setLibraryCurrentPath: (path) => set({ libraryCurrentPath: path }),
  libraryPathHistory: ['/mnt/Canal'],
  setLibraryPathHistory: (history) => set({ libraryPathHistory: history }),
  libraryLibraryPaths: [],
  setLibraryLibraryPaths: (paths) => set({ libraryLibraryPaths: paths }),

  // Music
  musicBasePath: '/home/z',
  setMusicBasePath: (path) => set({ musicBasePath: path }),
  musicLibraryPaths: [],
  setMusicLibraryPaths: (paths) => set({ musicLibraryPaths: paths }),
  musicCurrentPath: '/home/z',
  setMusicCurrentPath: (path) => set({ musicCurrentPath: path }),
  musicPathHistory: ['/home/z'],
  setMusicPathHistory: (history) => set({ musicPathHistory: history }),
  currentTrack: null,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  musicQueue: [],
  setMusicQueue: (queue) => set({ musicQueue: queue }),
  shuffleMode: false,
  setShuffleMode: (shuffle) => set({ shuffleMode: shuffle }),
  repeatMode: 'none',
  setRepeatMode: (mode) => set({ repeatMode: mode }),

  // Movies
  movieBasePath: '/home/z',
  setMovieBasePath: (path) => set({ movieBasePath: path }),
  movieLibraryPaths: [],
  setMovieLibraryPaths: (paths) => set({ movieLibraryPaths: paths }),
  movieCurrentPath: '/home/z',
  setMovieCurrentPath: (path) => set({ movieCurrentPath: path }),
  moviePathHistory: ['/home/z'],
  setMoviePathHistory: (history) => set({ moviePathHistory: history }),
  currentMovie: null,
  setCurrentMovie: (movie) => set({ currentMovie: movie }),

  // TV Shows
  tvshowBasePath: '/home/z',
  setTvshowBasePath: (path) => set({ tvshowBasePath: path }),
  tvshowLibraryPaths: [],
  setTvshowLibraryPaths: (paths) => set({ tvshowLibraryPaths: paths }),
  tvshowCurrentPath: '/home/z',
  setTvshowCurrentPath: (path) => set({ tvshowCurrentPath: path }),
  tvshowPathHistory: ['/home/z'],
  setTvshowPathHistory: (history) => set({ tvshowPathHistory: history }),

  // Radio
  radioStation: null,
  setRadioStation: (station) => set({ radioStation: station }),
  radioPlaying: false,
  setRadioPlaying: (playing) => set({ radioPlaying: playing }),
  radioVolume: 0.8,
  setRadioVolume: (volume) => set({ radioVolume: volume }),

  // Images
  imageBasePath: '/home/z',
  setImageBasePath: (path) => set({ imageBasePath: path }),
  imageLibraryPaths: [],
  setImageLibraryPaths: (paths) => set({ imageLibraryPaths: paths }),
  imageCurrentPath: '/home/z',
  setImageCurrentPath: (path) => set({ imageCurrentPath: path }),
  imagePathHistory: ['/home/z'],
  setImagePathHistory: (history) => set({ imagePathHistory: history }),
  currentImage: null,
  setCurrentImage: (image) => set({ currentImage: image }),

  // Sleep Timer
  sleepTimerEnabled: false,
  setSleepTimerEnabled: (enabled) => set({ sleepTimerEnabled: enabled }),
  stopAllMedia: () => {
    // Pause all HTML5 audio/video elements in the DOM first
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio, video').forEach((el) => {
        el.pause();
        (el as HTMLMediaElement).currentTime = 0;
      });
    }
    set({
      isPlaying: false,
      currentTrack: null,
      musicQueue: [],
      radioPlaying: false,
      radioStation: null,
      currentMovie: null,
      currentImage: null,
    });
  },
}));