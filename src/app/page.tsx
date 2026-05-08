'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore, type Section, type FileItem, type MediaItem, type PrintJob, type PrinterInfo, type ServerStats } from '@/lib/store';
import { toast } from 'sonner';
import {
  LayoutDashboard, HardDrive, Printer, Library as LibraryIcon,
  Menu, X, RefreshCw, Upload, Download, Trash2, FolderPlus,
  ChevronRight, ChevronLeft, ChevronUp, Home as HomeIcon, Cpu, MemoryStick, Wifi, Clock,
  Search, Filter, Plus, Edit, BookOpen, Star, Grid3X3, List,
  Eye, FileText, FolderOpen, Folder, ArrowLeft, MoreVertical, ExternalLink, ArrowUpDown,
  File, Image as ImageIcon, Archive, Music, Film, Code, FileType,
  AlertTriangle, CheckCircle, PrinterIcon, CircleDot, Send,
  Tag, BookMarked, BarChart3, Clock as ClockIcon, Activity, Copy,
  Bookmark, BookmarkCheck, BookmarkPlus, Heart,
  Monitor, Server as ServerIcon, Shield, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Shuffle, Maximize, Minimize,
  Disc3, FilmIcon, Music2, Radio, Headphones, Newspaper, Calendar, Globe,
  Moon, Timer, TimerOff, GripVertical,
} from 'lucide-react';

const SearchIcon = Search;

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ─── Helpers ──────────────────────────────────────────────────

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `hace ${diffDay}d`;
  if (diffHr > 0) return `hace ${diffHr}h`;
  if (diffMin > 0) return `hace ${diffMin}m`;
  return 'ahora';
}

function fileIcon(item: FileItem): React.ReactNode {
  if (item.isDirectory) return <Folder className="h-5 w-5 text-amber-500 fill-amber-200 dark:fill-amber-900/30" />;
  const ext = item.extension?.replace('.', '') || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <ImageIcon className="h-5 w-5 text-emerald-500" alt="" />;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return <Music className="h-5 w-5 text-violet-500" />;
  if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return <Film className="h-5 w-5 text-rose-500" />;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Archive className="h-5 w-5 text-orange-500" />;
  if (['pdf'].includes(ext)) return <FileType className="h-5 w-5 text-red-500" />;
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return <FileText className="h-5 w-5 text-blue-500" />;
  if (['js', 'ts', 'py', 'html', 'css', 'json', 'xml'].includes(ext)) return <Code className="h-5 w-5 text-cyan-500" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

function printStatusIcon(status: string) {
  switch (status) {
    case 'completed': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'printing': return <PrinterIcon className="h-4 w-4 text-amber-500 animate-pulse" />;
    case 'pending': return <Clock className="h-4 w-4 text-sky-500" />;
    case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'cancelled': return <X className="h-4 w-4 text-muted-foreground" />;
    default: return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

function printStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendiente',
    printing: 'Imprimiendo',
    completed: 'Completado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
  };
  return map[status] || status;
}

function printStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'printing': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'pending': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function bookStatusColor(status: string): string {
  switch (status) {
    case 'Leído': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'Leyendo': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Favorito': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400';
    default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

function bookStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'No leído': 'No leído',
    'Leyendo': 'Leyendo',
    'Leído': 'Leído',
    'Favorito': 'Favorito',
  };
  return map[status] || status;
}

// ─── News Widget ──────────────────────────────────────────────

function NewsWidget() {
  const [news, setNews] = useState<Array<{ title: string; source: string; url: string; snippet: string; time: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/news')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.news) setNews(data.news); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
      </div>
    );
  }

  if (news.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No se pudieron cargar las noticias</p>;
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {news.map((item, i) => (
        <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
          <div className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.source}</Badge>
                {item.time && <span className="text-[10px] text-muted-foreground">{item.time}</span>}
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ─── Folder Picker Hook & Content (inline, no separate dialog) ──

function useFolderPicker(onSelect: (path: string) => void | Promise<void>) {
  const [pickerPath, setPickerPath] = useState('/home/z');
  const [directories, setDirectories] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [pickerHistory, setPickerHistory] = useState<string[]>(['/home/z']);
  const [disks, setDisks] = useState<Array<{ name: string; mountPath: string; mounted: boolean; usagePercent: number; freeSpace: number }>>([]);
  const [disksLoading, setDisksLoading] = useState(false);
  const [view, setView] = useState<'disks' | 'browser'>('disks');
  const [pickerMode, setPickerMode] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const loadDirectories = useCallback(async (targetPath: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/files?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        setDirectories((data.items || []).filter((item: { isDirectory: boolean }) => item.isDirectory).map((item: { name: string; path: string }) => ({ name: item.name, path: item.path })));
      } else { setDirectories([]); }
    } catch { setDirectories([]); }
    finally { setLoading(false); }
  }, []);

  const loadDisks = useCallback(async () => {
    try {
      setDisksLoading(true);
      const res = await fetch('/api/disks/info');
      if (res.ok) { const data = await res.json(); setDisks(data.disks || []); }
    } catch { setDisks([]); }
    finally { setDisksLoading(false); }
  }, []);

  const openPicker = useCallback(() => {
    setPickerMode(true);
    setPickerPath('/home/z');
    setPickerHistory(['/home/z']);
    setView('disks');
    loadDisks();
  }, [loadDisks]);

  const closePicker = useCallback(() => {
    setPickerMode(false);
  }, []);

  const navigateTo = useCallback((path: string) => {
    const newHistory = [...pickerHistory, path];
    setPickerHistory(newHistory);
    setPickerPath(path);
    setView('browser');
    loadDirectories(path);
  }, [pickerHistory, loadDirectories]);

  const goBack = useCallback(() => {
    if (pickerHistory.length > 1) {
      const newHistory = pickerHistory.slice(0, -1);
      const parent = newHistory[newHistory.length - 1];
      setPickerHistory(newHistory);
      setPickerPath(parent);
      loadDirectories(parent);
    }
  }, [pickerHistory, loadDirectories]);

  const goUp = useCallback(() => {
    const parent = pickerPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== pickerPath) {
      setPickerHistory([...pickerHistory, parent]);
      setPickerPath(parent);
      loadDirectories(parent);
    }
  }, [pickerPath, pickerHistory, loadDirectories]);

  const goToDisks = useCallback(() => {
    setView('disks');
    setPickerHistory(['/home/z']);
    setPickerPath('/home/z');
  }, []);

  const handleSelect = useCallback(async () => {
    const pathToSelect = pickerPath;
    await onSelectRef.current(pathToSelect);
    setPickerMode(false);
  }, [pickerPath]);

  return {
    pickerMode, openPicker, closePicker,
    pickerContent: (
      <>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto pb-1 border-b mb-2">
          <Button variant={view === 'disks' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7 flex-shrink-0" onClick={goToDisks} title="Ver discos">
            <HardDrive className="h-4 w-4" />
          </Button>
          {view === 'browser' && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={goBack} disabled={pickerHistory.length <= 1}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={goUp} disabled={pickerPath === '/'}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono text-muted-foreground truncate px-2">{pickerPath}</span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto min-h-[200px] max-h-[400px] -mx-6 px-6">
          {view === 'disks' ? (
            disksLoading ? (
              <div className="space-y-2 py-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : disks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <HardDrive className="h-10 w-10 mb-2" /><p className="text-sm">No se encontraron discos</p>
              </div>
            ) : (
              <div className="space-y-1.5 py-1">
                {disks.map((disk) => (
                  <button key={disk.mountPath} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/80 transition-colors text-left group border border-transparent hover:border-border" onClick={() => disk.mounted ? navigateTo(disk.mountPath) : toast.error(`Disco "${disk.name}" no está montado`)} disabled={!disk.mounted}>
                    <div className={`p-2 rounded-lg flex-shrink-0 ${disk.mounted ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                      <HardDrive className={`h-5 w-5 ${disk.mounted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!disk.mounted ? 'text-muted-foreground' : ''}`}>{disk.name}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{disk.mountPath}</p>
                    </div>
                    {disk.mounted ? (
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{formatBytes(disk.freeSpace)} libre</span>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${disk.usagePercent > 90 ? 'bg-red-500' : disk.usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${disk.usagePercent}%` }} />
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 text-muted-foreground">Desmontado</Badge>
                    )}
                    {disk.mounted && <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )
          ) : (
            loading ? (
              <div className="space-y-2 py-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : directories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FolderOpen className="h-10 w-10 mb-2" /><p className="text-sm">No hay carpetas aquí</p>
              </div>
            ) : (
              <div className="space-y-0.5 py-1">
                {directories.map((dir) => (
                  <button key={dir.path} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/80 transition-colors text-left group" onClick={() => navigateTo(dir.path)}>
                    <Folder className="h-5 w-5 text-amber-500 fill-amber-200 dark:fill-amber-900/30 flex-shrink-0" />
                    <span className="text-sm font-medium truncate flex-1">{dir.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={closePicker}>← Volver</Button>
          {view === 'browser' && (
            <Button onClick={handleSelect}><FolderPlus className="h-4 w-4 mr-1" />Seleccionar esta carpeta</Button>
          )}
        </div>
      </>
    ),
  };
}

// ─── Radio Stations Data ──────────────────────────────────────

const RADIO_STATIONS = [
  { id: '1', name: 'Jazz FM', genre: 'Jazz', url: 'https://jazz-wr04.ice.infomaniak.ch/jazz-wr04-128.mp3', country: '🇨🇭 Suiza' },
  { id: '2', name: 'Groove Salad', genre: 'Ambient', url: 'https://ice4.somafm.com/groovesalad-256-mp3', country: '🇺🇸 USA' },
  { id: '3', name: 'DEF CON Radio', genre: 'Electronic', url: 'https://ice4.somafm.com/defcon-256-mp3', country: '🇺🇸 USA' },
  { id: '4', name: 'FIP Radio', genre: 'Eclectic', url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', country: '🇫🇷 Francia' },
  { id: '5', name: 'KEXP 90.3', genre: 'Indie/Alternative', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', country: '🇺🇸 Seattle' },
  { id: '7', name: 'Radio Paradise', genre: 'Eclectic', url: 'https://stream.radioparadise.com/mp3-192', country: '🇺🇸 USA' },
  { id: '8', name: 'SomaFM Drone Zone', genre: 'Drone/Ambient', url: 'https://ice4.somafm.com/dronezone-256-mp3', country: '🇺🇸 USA' },
  { id: '10', name: 'Lofi Girl', genre: 'Lo-Fi', url: 'https://play.streamafrica.net/lofiradio', country: '🌐 Internet' },
  // ── Vancouver 🇨🇦 ──
  { id: '11', name: 'CBC Radio One Vancouver', genre: 'News/Talk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBH_CBC.mp3', country: '🇨🇦 Vancouver' },
  { id: '12', name: 'CBC Music Vancouver', genre: 'Classical/ECM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBXAM_CBC.mp3', country: '🇨🇦 Vancouver' },
  { id: '20', name: 'The Beat 94.5 FM', genre: 'Hip Hop/R&B', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CFBTFM.mp3', country: '🇨🇦 Vancouver' },
  // ── La Habana 🇨🇺 ──
  { id: '15', name: 'Radio Progreso', genre: 'Informativa', url: 'https://icecast.teveo.cu/XjfW7qWN', country: '🇨🇺 La Habana' },
  { id: '16', name: 'Radio Rebelde', genre: 'Noticias/Música', url: 'https://icecast.teveo.cu/zrXXWK9F', country: '🇨🇺 La Habana' },
  { id: '17', name: 'Radio Reloj', genre: 'Noticias/Hora', url: 'https://icecast.teveo.cu/b3jbfThq', country: '🇨🇺 La Habana' },
  { id: '18', name: 'Radio Enciclopedia', genre: 'Cultural', url: 'https://icecast.teveo.cu/9Rnrbjzq', country: '🇨🇺 La Habana' },
  { id: '19', name: 'Radio Taíno', genre: 'Variada', url: 'https://icecast.teveo.cu/3MCwWg3V', country: '🇨🇺 La Habana' },
  { id: '21', name: 'Radio 26', genre: 'Cultural', url: 'https://www.radio26.cu/wp-content/uploads/2024/03/IDENTIFICACION-RADIO-26.mp3', country: '🇨🇺 La Habana' },
  { id: '22', name: 'Radio Ciudad de La Habana', genre: 'Variada', url: 'https://icecast.teveo.cu/g73XCjCH', country: '🇨🇺 La Habana' },
];

// ─── Sidebar Navigation ──────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'disks', label: 'Discos', icon: <HardDrive className="h-5 w-5" /> },
  { id: 'library', label: 'Biblioteca', icon: <LibraryIcon className="h-5 w-5" /> },
  { id: 'music', label: 'Música', icon: <Music className="h-5 w-5" /> },
  { id: 'radio', label: 'Radio', icon: <Radio className="h-5 w-5" /> },
  { id: 'movies', label: 'Películas', icon: <Film className="h-5 w-5" /> },
  { id: 'tvshows', label: 'TV Shows', icon: <Monitor className="h-5 w-5" /> },
  { id: 'images', label: 'Imágenes', icon: <ImageIcon className="h-5 w-5" /> },
  { id: 'printers', label: 'Impresora', icon: <Printer className="h-5 w-5" /> },
];

function Sidebar() {
  const { currentSection, setCurrentSection, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed, serverStats } = useAppStore();

  return (
    <>
      {/* Mobile overlay - closes sidebar on tap */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col ${
        // Mobile: off-screen unless open
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        // Desktop: always visible, width changes based on collapsed state
      } md:translate-x-0 ${sidebarCollapsed ? 'md:w-[68px]' : 'md:w-64'}`}>
        {/* Header */}
        <div className={`border-b border-border flex items-center justify-between ${sidebarCollapsed ? 'md:p-2 md:justify-center' : 'p-4'} p-4`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center' : 'gap-3'}`}>
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex-shrink-0">
              <ServerIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden md:opacity-0' : ''}`}>
              <h1 className="font-bold text-sm">Mi Servidor</h1>
              <p className="text-xs text-muted-foreground">Panel de Control</p>
            </div>
          </div>
          {/* Close button - mobile only */}
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
          {/* Collapse button - desktop only */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hidden md:flex"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {/* Server Info */}
        {serverStats && (
          <div className={`border-b border-border ${sidebarCollapsed ? 'md:px-2 md:py-3' : 'px-4 py-3'} px-4 py-3`}>
            <div className={`flex items-center gap-2 text-xs text-muted-foreground ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className={`truncate transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>{serverStats.hostname}</span>
            </div>
            <div className={`flex items-center gap-2 text-xs text-muted-foreground mt-1 ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>Arriba {formatUptime(serverStats.uptime)}</span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-2 md:p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const btn = (
              <Button
                key={item.id}
                variant={currentSection === item.id ? 'secondary' : 'ghost'}
                className={`w-full ${
                  sidebarCollapsed ? 'md:justify-center md:px-0 md:h-10' : 'justify-start gap-3 h-10 px-3'
                } ${
                  currentSection === item.id
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setCurrentSection(item.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
              </Button>
            );

            // When collapsed on desktop, wrap in tooltip
            if (sidebarCollapsed) {
              return (
                <div key={item.id} className="hidden md:block">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      {btn}
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                </div>
              );
            }

            return <div key={item.id}>{btn}</div>;
          })}
        </nav>

        {/* Footer */}
        <div className={`border-t border-border ${sidebarCollapsed ? 'md:p-2' : 'p-3'} p-3`}>
          <div className={`flex items-center gap-2 text-xs text-muted-foreground ${sidebarCollapsed ? 'md:justify-center md:px-0' : 'px-3'} px-3 py-2`}>
            <Shield className="h-3.5 w-3.5 flex-shrink-0" />
            <span className={`transition-opacity duration-200 ${sidebarCollapsed ? 'md:hidden' : ''}`}>Red Local</span>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Dashboard Section ──────────────────────────────────────

function DashboardSection() {
  const { serverStats, setServerStats } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<{
    city: string;
    country: string;
    current: { temperature: number; feelsLike: number; humidity: number; windSpeed: number; description: string; icon: string };
    forecast: { day: string; high: number; low: number; icon: string; description: string }[];
  } | null>(null);
  const [mediaStats, setMediaStats] = useState<{
    library: { totalBooks: number; booksRead: number; totalPages: number; uniqueAuthors: number };
    music: { totalFiles: number; totalFolders: number; totalSize: number };
    movies: { totalFiles: number; totalFolders: number; totalSize: number };
    images: { totalFiles: number; totalFolders: number; totalSize: number };
  } | null>(null);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    try {
      const [serverRes, statsRes] = await Promise.all([
        fetch('/api/server-stats').catch(() => null),
        fetch('/api/dashboard/stats').catch(() => null),
      ]);
      if (serverRes?.ok) setServerStats(await serverRes.json());
      if (statsRes?.ok) setMediaStats(await statsRes.json());
    } catch {
      // silent fail for dashboard widgets
    } finally {
      setLoading(false);
    }

    // Load weather in background (Open-Meteo, no API key needed)
    try {
      const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=salt%20spring%20island&count=1&language=es');
      const geoData = await geoRes.json();
      if (geoData.results?.length > 0) {
        const { latitude, longitude, name, country } = geoData.results[0];
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=3`);
        const wData = await wRes.json();
        const codeMap: Record<number, { desc: string; icon: string }> = {
          0: { desc: 'Despejado', icon: '☀️' }, 1: { desc: 'Parcialmente nublado', icon: '⛅' },
          2: { desc: 'Parcialmente nublado', icon: '⛅' }, 3: { desc: 'Nublado', icon: '☁️' },
          45: { desc: 'Niebla', icon: '🌫️' }, 48: { desc: 'Niebla', icon: '🌫️' },
          51: { desc: 'Llovizna', icon: '🌦️' }, 53: { desc: 'Llovizna', icon: '🌦️' }, 55: { desc: 'Llovizna', icon: '🌦️' },
          61: { desc: 'Lluvia', icon: '🌧️' }, 63: { desc: 'Lluvia', icon: '🌧️' }, 65: { desc: 'Lluvia', icon: '🌧️' },
          71: { desc: 'Nieve', icon: '🌨️' }, 73: { desc: 'Nieve', icon: '🌨️' }, 75: { desc: 'Nieve', icon: '🌨️' },
          80: { desc: 'Chubascos', icon: '🌧️' }, 81: { desc: 'Chubascos', icon: '🌧️' }, 82: { desc: 'Chubascos', icon: '🌧️' },
          95: { desc: 'Tormenta', icon: '⛈️' }, 96: { desc: 'Tormenta', icon: '⛈️' }, 99: { desc: 'Tormenta', icon: '⛈️' },
        };
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const cur = codeMap[wData.current.weather_code] || { desc: 'Nublado', icon: '☁️' };
        setWeather({
          city: name,
          country,
          current: { temperature: wData.current.temperature_2m, feelsLike: wData.current.apparent_temperature, humidity: wData.current.relative_humidity_2m, windSpeed: wData.current.wind_speed_10m, description: cur.desc, icon: cur.icon },
          forecast: wData.daily.time.map((d: string, i: number) => {
            const f = codeMap[wData.daily.weather_code[i]] || { desc: 'Nublado', icon: '☁️' };
            return { day: days[new Date(d + 'T00:00:00').getDay()], high: Math.round(wData.daily.temperature_2m_max[i]), low: Math.round(wData.daily.temperature_2m_min[i]), icon: f.icon, description: f.desc };
          }),
        });
      }
    } catch { /* weather fails silently */ }
  }, [setServerStats]);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 300000); // refresh every 5min
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!serverStats) return null;

  return (
    <div className="space-y-6">
      {/* Top Row: Clock + Weather */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date & Time */}
        <Card className="border-border">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-medium text-muted-foreground">{dayNames[now.getDay()]}</p>
            </div>
            <p className="text-4xl font-bold tracking-tight">{now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="text-sm text-muted-foreground mt-2">{now.getDate()} de {monthNames[now.getMonth()]} de {now.getFullYear()}</p>
          </CardContent>
        </Card>

        {/* Weather */}
        <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 md:col-span-2">
          <CardContent className="p-4 md:p-6">
            {weather ? (
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-4xl">{weather.current.icon}</span>
                  <div>
                    <p className="text-3xl font-bold">{Math.round(weather.current.temperature)}°C</p>
                    <p className="text-sm text-muted-foreground">{weather.current.description}</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Sensación</p>
                    <p className="text-sm font-medium">{Math.round(weather.current.feelsLike)}°C</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Humedad</p>
                    <p className="text-sm font-medium">{weather.current.humidity}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Viento</p>
                    <p className="text-sm font-medium">{Math.round(weather.current.windSpeed)} km/h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ciudad</p>
                    <p className="text-sm font-medium">{weather.city}</p>
                  </div>
                </div>
                {/* 3-day forecast */}
                <div className="flex gap-4 justify-center md:justify-end flex-shrink-0">
                  {weather.forecast.map((day, i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs text-muted-foreground">{day.day}</p>
                      <span className="text-xl mx-auto block my-1">{day.icon}</span>
                      <p className="text-xs font-medium">{day.high}°</p>
                      <p className="text-[10px] text-muted-foreground">{day.low}°</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm text-muted-foreground">Cargando clima...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200/50 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">CPU</p>
                <p className="text-xl md:text-2xl font-bold text-emerald-700 dark:text-emerald-400">{serverStats.cpuCores} núcleos</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1 truncate max-w-[120px] md:max-w-[160px]">{serverStats.cpuModel}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Cpu className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-sky-200/50 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">RAM</p>
                <p className="text-xl md:text-2xl font-bold text-sky-700 dark:text-sky-400">{serverStats.memoryUsagePercent}%</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{formatBytes(serverStats.usedMemory)} / {formatBytes(serverStats.totalMemory)}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-sky-100 dark:bg-sky-900/30">
                <MemoryStick className="h-5 w-5 md:h-6 md:w-6 text-sky-600 dark:text-sky-400" />
              </div>
            </div>
            <Progress value={serverStats.memoryUsagePercent} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="border-amber-200/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-amber-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Disco</p>
                <p className="text-xl md:text-2xl font-bold text-amber-700 dark:text-amber-400">{serverStats.diskUsagePercent}%</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{formatBytes(serverStats.usedDiskSpace)} / {formatBytes(serverStats.totalDiskSpace)}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <HardDrive className="h-5 w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <Progress value={serverStats.diskUsagePercent} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card className="border-violet-200/50 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Activo</p>
                <p className="text-xl md:text-2xl font-bold text-violet-700 dark:text-violet-400">{formatUptime(serverStats.uptime)}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground mt-1">{serverStats.platform} / {serverStats.arch}</p>
              </div>
              <div className="p-2 md:p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Media Stats - all 4 sections */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <LibraryIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Biblioteca</p>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{mediaStats?.library.totalBooks ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{mediaStats?.library.booksRead ?? 0} leídos</p>
          </CardContent>
        </Card>
        <Card className="border-violet-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                <Music2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Música</p>
            </div>
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">{mediaStats?.music.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.music.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-rose-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
                <FilmIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Películas</p>
            </div>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">{mediaStats?.movies.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.movies.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <ImageIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Imágenes</p>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{mediaStats?.images.totalFiles ?? '...'}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatBytes(mediaStats?.images.totalSize ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar + News */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar Widget */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-600" />
              {monthNames[now.getMonth()]} {now.getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map((d) => (
                <div key={d} className="font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {(() => {
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                let startDay = firstDay.getDay() - 1;
                if (startDay < 0) startDay = 6;
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const today = now.getDate();
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < startDay; i++) cells.push(<div key={`e${i}`} />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const isToday = d === today;
                  cells.push(
                    <div
                      key={d}
                      className={`py-1.5 rounded-md text-sm cursor-default transition-colors ${
                        isToday
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {d}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </CardContent>
        </Card>

        {/* News Widget */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-emerald-600" />
              Noticias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NewsWidget />
          </CardContent>
        </Card>
      </div>

      {/* Network, System */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-600" />
              Red
            </CardTitle>
          </CardHeader>
          <CardContent>
            {serverStats.networkInterfaces.length > 0 ? (
              <div className="space-y-3">
                {serverStats.networkInterfaces.map((iface) => (
                  <div key={iface.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{iface.name}</p>
                        <p className="text-xs text-muted-foreground">{iface.family}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">{iface.address}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No se encontraron interfaces</p>
            )}
          </CardContent>
        </Card>

        {/* System */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-emerald-600" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Host', value: serverStats.hostname },
                { label: 'Plataforma', value: serverStats.platform },
                { label: 'Arquitectura', value: serverStats.arch },
                { label: 'Node.js', value: serverStats.nodeVersion },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DiskExplorerSection() {
  const { currentPath, setCurrentPath, pathHistory, setPathHistory, selectedFiles, setSelectedFiles, toggleFileSelection, viewMode, setViewMode, diskPaths, setDiskPaths } = useAppStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const loadFiles = useCallback(async () => {
    if (currentPath === '/') {
      setLoading(false);
      setFiles([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/files?path=${encodeURIComponent(currentPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.items || []);
      } else {
        toast.error('Error al cargar directorio');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    loadFiles();
    setSelectedFiles([]);
  }, [currentPath, loadFiles, setSelectedFiles]);

  const navigateTo = (path: string) => {
    setPathHistory([...pathHistory, path]);
    setCurrentPath(path);
  };

  const goBack = () => {
    if (pathHistory.length > 1) {
      const newHistory = [...pathHistory];
      newHistory.pop();
      const parent = pathHistory[pathHistory.length - 2];
      setPathHistory(newHistory);
      setCurrentPath(parent);
    } else {
      setPathHistory(['/']);
      setCurrentPath('/');
    }
  };

  const goUp = () => {
    const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== currentPath) {
      navigateTo(parent);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }
    formData.append('path', currentPath);

    try {
      const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.count} archivo(s) subido(s)`);
        loadFiles();
      } else {
        toast.error('Error al subir');
      }
    } catch {
      toast.error('Error de conexión');
    }
    if (uploadRef.current) uploadRef.current.value = '';
    setShowUpload(false);
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        toast.error('Error al descargar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadFiles();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleMkdir = async () => {
    if (!newDirName.trim()) return;
    try {
      const res = await fetch('/api/files/mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: currentPath, name: newDirName.trim() }),
      });
      if (res.ok) {
        toast.success(`Carpeta "${newDirName}" creada`);
        setNewDirName('');
        setShowMkdir(false);
        loadFiles();
      } else {
        toast.error('Error al crear carpeta');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleBatchDownload = () => {
    selectedFiles.forEach((path) => {
      const name = path.split('/').pop() || path;
      handleDownload(path, name);
    });
    setSelectedFiles([]);
  };

  const handleBatchDelete = async () => {
    if (!confirm(`¿Eliminar ${selectedFiles.length} elemento(s)?`)) return;
    for (const path of selectedFiles) {
      await handleDelete(path, path.split('/').pop() || path);
    }
    setSelectedFiles([]);
  };

  const sorted = sortAsc
    ? [...files].sort((a, b) => a.name.localeCompare(b.name))
    : [...files].sort((a, b) => b.name.localeCompare(a.name));
  const directories = sorted.filter((f) => f.isDirectory);
  const regularFiles = sorted.filter((f) => !f.isDirectory);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={currentPath === '/'}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp} disabled={currentPath === '/'}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          {currentPath !== '/' && (
            <>
              <Button variant="ghost" size="sm" className="h-8 flex-shrink-0" onClick={() => { setPathHistory(['/']); setCurrentPath('/'); }}>
                <HomeIcon className="h-4 w-4 mr-1" />
                Discos
              </Button>
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium truncate">{currentPath.split('/').pop()}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View mode */}
          {currentPath !== '/' && (
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('grid')}>
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          )}

          {/* Actions */}
          {currentPath !== '/' && (
          <>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowMkdir(true)}>
            <FolderPlus className="h-4 w-4 mr-1" />
            Nueva Carpeta
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-1" />
            Subir
          </Button>
          </>
          )}
          {currentPath !== '/' && (
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadFiles}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Upload zone */}
      {currentPath !== '/' && showUpload && (
        <Card className="border-dashed border-2 border-emerald-300 dark:border-emerald-700">
          <CardContent className="p-6 text-center">
            <Upload className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
            <p className="font-medium mb-1">Arrastra archivos aquí</p>
            <p className="text-sm text-muted-foreground mb-3">o selecciona archivos</p>
            <input
              ref={uploadRef}
              type="file"
              multiple
              className="block mx-auto"
              onChange={handleUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* New Folder Dialog */}
      <Dialog open={showMkdir} onOpenChange={setShowMkdir}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Carpeta</DialogTitle>
            <DialogDescription>Crea una nueva carpeta en: {currentPath}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Nombre de la carpeta"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleMkdir()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMkdir(false)}>Cancelar</Button>
            <Button onClick={handleMkdir} disabled={!newDirName.trim()}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch actions */}
      {selectedFiles.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
          <span className="text-sm text-muted-foreground">{selectedFiles.length} seleccionado(s)</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleBatchDownload}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Descargar
          </Button>
          <Button variant="outline" size="sm" className="text-red-500" onClick={handleBatchDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Eliminar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Current path */}
      {currentPath !== '/' && <p className="text-xs text-muted-foreground font-mono">{currentPath}</p>}

      {/* Disk Cards View - shows at root */}
      {!loading && currentPath === '/' && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Discos</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {diskPaths.map((diskPath) => {
              const diskName = diskPath.split('/').pop() || diskPath;
              const isHome = diskPath.startsWith('/home');
              return (
                <Card
                  key={diskPath}
                  className="group cursor-pointer overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-lg hover:-translate-y-1"
                  onClick={() => { setPathHistory(['/', diskPath]); setCurrentPath(diskPath); }}
                >
                  <div className="aspect-square relative bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 flex flex-col items-center justify-center gap-3">
                    <div className="p-4 rounded-2xl bg-emerald-200/50 dark:bg-emerald-800/30">
                      {isHome ? (
                        <ServerIcon className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <HardDrive className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{diskName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{diskPath}</span>
                    <ChevronRight className="h-5 w-5 text-emerald-400 dark:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading */}
      {currentPath !== '/' && loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3' : 'space-y-2'}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className={viewMode === 'grid' ? 'h-24 rounded-lg' : 'h-12 rounded-lg'} />
          ))}
        </div>
      ) : currentPath !== '/' && files.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Directorio vacío</p>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {directories.map((item) => (
            <Card
              key={item.path}
              className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                selectedFiles.includes(item.path) ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
              }`}
              onClick={(e) => {
                if (e.detail === 2) { navigateTo(item.path); return; }
                toggleFileSelection(item.path);
              }}
              onDoubleClick={() => navigateTo(item.path)}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                {fileIcon(item)}
                <p className="text-xs font-medium truncate w-full">{item.name}</p>
              </CardContent>
            </Card>
          ))}
          {regularFiles.map((item) => (
            <Card
              key={item.path}
              className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden ${
                selectedFiles.includes(item.path) ? 'ring-2 ring-emerald-500 border-emerald-300' : ''
              }`}
              onClick={() => toggleFileSelection(item.path)}
            >
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <div className="relative">
                  {fileIcon(item)}
                </div>
                <p className="text-xs font-medium truncate w-full">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {directories.map((item) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedFiles.includes(item.path) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                  }`}
                  onClick={() => toggleFileSelection(item.path)}
                  onDoubleClick={() => navigateTo(item.path)}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(item.path)}
                    onChange={() => toggleFileSelection(item.path)}
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {fileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">{formatTimeAgo(item.modifiedAt)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
              {regularFiles.map((item) => (
                <div
                  key={item.path}
                  className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors ${
                    selectedFiles.includes(item.path) ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''
                  }`}
                  onClick={() => toggleFileSelection(item.path)}
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(item.path)}
                    onChange={() => toggleFileSelection(item.path)}
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {fileIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                  </div>
                  <p className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(item.size)}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">{formatTimeAgo(item.modifiedAt)}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleDownload(item.path, item.name); }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.path, item.name); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Printer Section ────────────────────────────────────────

function PrinterSection() {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [printFile, setPrintFile] = useState<{ path: string; name: string } | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [printCopies, setPrintCopies] = useState('1');

  const loadData = useCallback(async () => {
    try {
      const [printersRes, jobsRes] = await Promise.all([
        fetch('/api/printers'),
        fetch('/api/printers/jobs'),
      ]);
      if (printersRes.ok) setPrinters((await printersRes.json()).printers);
      if (jobsRes.ok) setJobs((await jobsRes.json()).jobs);
    } catch {
      toast.error('Error cargando datos de impresión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handlePrint = async () => {
    if (!printFile) return;
    try {
      const res = await fetch('/api/printers/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: printFile.name,
          filePath: printFile.path,
          printerName: selectedPrinter || undefined,
          copies: parseInt(printCopies) || 1,
        }),
      });
      if (res.ok) {
        toast.success(`"${printFile.name}" enviado a imprimir`);
        setShowPrint(false);
        setPrintFile(null);
        loadData();
      } else {
        toast.error('Error al enviar impresión');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!confirm('¿Cancelar este trabajo de impresión?')) return;
    try {
      const res = await fetchWithTimeout('/api/printers/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        toast.success('Trabajo cancelado');
        loadData();
      } else {
        toast.error('Error al cancelar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('¿Limpiar toda la cola de impresión? Se eliminarán todos los trabajos.')) return;
    try {
      const res = await fetchWithTimeout('/api/printers/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Cola limpiada (${data.deleted} trabajo(s) eliminado(s))`);
        loadData();
      } else {
        toast.error('Error al limpiar la cola');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const defaultPrinter = printers.find((p) => p.isDefault);

  return (
    <div className="space-y-6">
      {/* Printers */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Printer className="h-5 w-5 text-emerald-600" />
              Impresoras
            </CardTitle>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : printers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {printers.map((printer) => (
                <div key={printer.name} className="flex items-center gap-3 p-4 rounded-lg border bg-card">
                  <div className={`p-2 rounded-lg ${
                    printer.status === 'Listo' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <Printer className={`h-5 w-5 ${
                      printer.status === 'Listo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{printer.name}</p>
                      {printer.isDefault && (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200">
                          Predeterminada
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{printer.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPrinter(printer.name);
                        setShowPrint(true);
                      }}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Imprimir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Printer className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No se detectaron impresoras</p>
              <p className="text-sm text-muted-foreground mb-4">Asegúrate de tener CUPS instalado en el servidor</p>
              <Button variant="outline" onClick={() => setShowPrint(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Archivo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Queue */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-amber-600" />
              Cola de Impresión
              {jobs.length > 0 && (
                <Badge variant="secondary" className="text-xs">{jobs.length}</Badge>
              )}
            </CardTitle>
            {jobs.length > 0 && (
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleClearQueue}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpiar cola
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {printStatusIcon(job.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{job.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.printerName && `${job.printerName} · `}{job.copies} copia(s) · {formatTimeAgo(job.createdAt)}
                    </p>
                  </div>
                  <Badge className={`text-xs ${printStatusColor(job.status)}`}>
                    {printStatusLabel(job.status)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Cancelar trabajo"
                    onClick={() => handleDeleteJob(job.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No hay trabajos en la cola</p>
          )}
        </CardContent>
      </Card>

      {/* Print Dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Imprimir Archivo</DialogTitle>
            <DialogDescription>Selecciona un archivo del servidor para imprimir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!printFile ? (
              <div className="space-y-3">
                <Label>Ruta del archivo</Label>
                <Input
                  placeholder="/home/z/documento.pdf"
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setPrintFile({ path: val, name: val.split('/').pop() || val });
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">Escribe la ruta completa del archivo que deseas imprimir</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">{printFile.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{printFile.path}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto" onClick={() => setPrintFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div>
                  <Label>Impresora</Label>
                  <Select value={selectedPrinter} onValueChange={setSelectedPrinter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={defaultPrinter ? `Usar: ${defaultPrinter.name}` : 'Seleccionar impresora'} />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Copias</Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    value={printCopies}
                    onChange={(e) => setPrintCopies(e.target.value)}
                    className="mt-1 w-24"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPrint(false); setPrintFile(null); }}>Cancelar</Button>
            <Button onClick={handlePrint} disabled={!printFile}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── File Actions Menu (3 dots dropdown) ──────────────────

function FileActionsMenu({ 
  item, 
  onRename, 
  onDelete, 
  children,
  extraItems,
  onEdit,
}: { 
  item: { path: string; name: string }; 
  onRename: (item: { path: string; name: string }) => void;
  onDelete: (item: { path: string; name: string }) => void;
  children?: React.ReactNode;
  extraItems?: React.ReactNode;
  onEdit?: (item: { path: string; name: string }) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children || (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        {!onEdit && (
          <DropdownMenuItem onClick={() => onRename(item)}>
            <Edit className="h-4 w-4 mr-2" />
            Renombrar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(item)} className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30">
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
        {extraItems}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Library Section ────────────────────────────────────────

function bookFileIcon(ext: string): React.ReactNode {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return <BookOpen className="h-6 w-6 text-red-500" />;
  if (['epub', 'mobi', 'azw3'].includes(lower)) return <BookMarked className="h-6 w-6 text-amber-600 dark:text-amber-400" />;
  if (['cbz', 'cbr'].includes(lower)) return <ImageIcon className="h-6 w-6 text-violet-500" />;
  if (['djvu', 'fb2'].includes(lower)) return <FileText className="h-6 w-6 text-sky-500" />;
  if (['doc', 'docx'].includes(lower)) return <FileText className="h-6 w-6 text-blue-600" />;
  if (['rtf'].includes(lower)) return <FileText className="h-6 w-6 text-orange-500" />;
  return <File className="h-6 w-6 text-muted-foreground" />;
}

function bookFileIconSmall(ext: string): React.ReactNode {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return <BookOpen className="h-4 w-4 text-red-500" />;
  if (['epub', 'mobi', 'azw3'].includes(lower)) return <BookMarked className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
  if (['cbz', 'cbr'].includes(lower)) return <ImageIcon className="h-4 w-4 text-violet-500" />;
  if (['djvu', 'fb2'].includes(lower)) return <FileText className="h-4 w-4 text-sky-500" />;
  if (['doc', 'docx'].includes(lower)) return <FileText className="h-4 w-4 text-blue-600" />;
  if (['rtf'].includes(lower)) return <FileText className="h-4 w-4 text-orange-500" />;
  if (['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(lower)) return <Headphones className="h-4 w-4 text-violet-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function bookExtColor(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === 'pdf') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (['epub', 'mobi', 'azw3'].includes(lower)) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  if (['cbz', 'cbr'].includes(lower)) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  if (['djvu', 'fb2'].includes(lower)) return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
  if (['doc', 'docx'].includes(lower)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  if (['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(lower)) return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
  return 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400';
}

function LibrarySection() {
  const {
    libraryCurrentPath, setLibraryCurrentPath,
    libraryPathHistory, setLibraryPathHistory,
    libraryLibraryPaths, setLibraryLibraryPaths,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number; subFolderCount: number }>>([]);
  const [books, setBooks] = useState<Array<{ name: string; path: string; size: number; modifiedAt: string; extension: string; isAudiobook?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().libraryLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setLibraryLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'libraryLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [playingAudiobook, setPlayingAudiobook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [bookmarks, setBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [bookStatusFilter, setBookStatusFilter] = useState('all');
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [editingBookBm, setEditingBookBm] = useState<Record<string, unknown> | null>(null);
  const [bookForm, setBookForm] = useState({ title: '', author: '', externalUrl: '', isbn: '', format: 'Físico', status: 'No leído', notes: '' });

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/books/scan?path=${encodeURIComponent(libraryCurrentPath)}`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setBooks(data.files || []);
        // Check covers for folders
        const coverCheck: Record<string, boolean> = {};
        for (const f of (data.folders || [])) {
          try {
            const coverRes = await fetch(`/api/music/cover?path=${encodeURIComponent(f.path)}`);
            coverCheck[f.path] = coverRes.ok && coverRes.headers.get('content-type')?.startsWith('image/');
          } catch { coverCheck[f.path] = false; }
        }
        setCoverPaths(coverCheck);
      }
    } catch {
      toast.error('Error escaneando libros');
    } finally {
      setLoading(false);
    }
  }, [libraryCurrentPath]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Load saved library paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=libraryLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setLibraryLibraryPaths(saved);
              setLibraryCurrentPath(saved[0]);
              setLibraryPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setLibraryLibraryPaths, setLibraryCurrentPath, setLibraryPathHistory]);

  // Save library paths to database
  const saveLibraryPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'libraryLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateLibraryPaths = useCallback((newPaths: string[]) => {
    setLibraryLibraryPaths(newPaths);
    saveLibraryPaths(newPaths);
  }, [setLibraryLibraryPaths, saveLibraryPaths]);

  const navigateTo = (path: string) => {
    setLibraryPathHistory([...libraryPathHistory, path]);
    setLibraryCurrentPath(path);
  };

  const goBack = () => {
    if (libraryPathHistory.length > 1) {
      const h = [...libraryPathHistory]; h.pop();
      setLibraryPathHistory(h);
      setLibraryCurrentPath(libraryPathHistory[libraryPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = libraryCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== libraryCurrentPath) navigateTo(parent);
  };

  const closeReader = () => {
    setReadingBook(null);
    setEpubChapters([]);
    setCurrentEpubChapter(0);
    setEpubTitle('');
    setEpubLoading(false);
    setEpubError(false);
  };
  const [epubChapters, setEpubChapters] = useState<Array<{ id: string; href: string; title: string }>>([]);
  const [currentEpubChapter, setCurrentEpubChapter] = useState(0);
  const [epubTitle, setEpubTitle] = useState('');
  const [epubLoading, setEpubLoading] = useState(false);
  const [epubError, setEpubError] = useState(false);

  const isViewable = (ext: string) => ['pdf', 'txt'].includes(ext.toLowerCase());
  const isEpub = (ext: string) => ['epub'].includes(ext.toLowerCase());
  const isAudiobook = (ext: string) => ['mp3', 'm4a', 'm4b', 'wav', 'ogg', 'flac', 'aac', 'wma', 'opus'].includes(ext.toLowerCase());

  const handleReadOrDownload = async (book: { name: string; path: string; extension: string; size: number }) => {
    if (isAudiobook(book.extension)) {
      setPlayingAudiobook(book);
    } else if (isEpub(book.extension) || isViewable(book.extension)) {
      setReadingBook(book);
    } else {
      await handleDownload(book.path, book.name);
    }
  };

  // Load EPUB chapters list from server-side parser
  useEffect(() => {
    if (!readingBook) return;
    const ext = readingBook.extension.toLowerCase();
    if (ext !== 'epub') return;

    let cancelled = false;

    const loadEpub = async () => {
      try {
        setEpubLoading(true);
        setEpubError(false);

        const res = await fetch(`/api/books/epub?path=${encodeURIComponent(readingBook.path)}`);
        if (!res.ok) {
          setEpubError(true);
          setEpubLoading(false);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        setEpubTitle(data.title || readingBook.name.replace(/\.epub$/i, ''));
        setEpubChapters(data.chapters || []);
        setCurrentEpubChapter(0);
        setEpubLoading(false);
      } catch (err) {
        console.error('Error loading EPUB:', err);
        if (!cancelled) { setEpubError(true); setEpubLoading(false); }
      }
    };

    loadEpub();
  }, [readingBook]);

  // Keyboard navigation for EPUB
  useEffect(() => {
    if (!readingBook || readingBook.extension.toLowerCase() !== 'epub') return;
    if (epubChapters.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentEpubChapter((prev) => Math.max(0, prev - 1));
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentEpubChapter((prev) => Math.min(epubChapters.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingBook, epubChapters.length]);

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      setDownloading(filePath);
      const res = await fetch(`/api/books/scan?path=${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Descargando "${fileName}"`);
      } else {
        toast.error('Error al descargar');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDownloading(null);
    }
  };

  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadBooks();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        loadBooks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

  // ─── Book Bookmarks ──────────────────────────────────
  const loadBookmarks = useCallback(async () => {
    setBookmarksLoading(true);
    try {
      const res = await fetch(`/api/books/bookmarks?status=all`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch { toast.error('Error cargando marcadores de libros'); }
    finally { setBookmarksLoading(false); }
  }, []);

  useEffect(() => {
    loadBookmarks(); // Load bookmarks on mount so search can find them
  }, [loadBookmarks]);

  // Unified search: filter local files AND bookmarks by searchQuery
  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredBooks = searchQuery ? books.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase())) : books;
  const filteredBookmarks = searchQuery
    ? bookmarks.filter((bm) =>
        String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(bm.author || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : (bookStatusFilter === 'all' ? bookmarks : bookmarks.filter((bm) => String(bm.status) === bookStatusFilter));
  const isSearching = searchQuery.trim().length > 0;

  const resetBookForm = () => setBookForm({ title: '', author: '', externalUrl: '', isbn: '', format: 'Físico', status: 'No leído', notes: '' });

  const openAddBookDialog = () => {
    setEditingBookBm(null);
    resetBookForm();
    setShowAddBookDialog(true);
  };

  const openEditBookDialog = (bm: Record<string, unknown>) => {
    setEditingBookBm(bm);
    setBookForm({
      title: String(bm.title || ''),
      author: String(bm.author || ''),
      externalUrl: String(bm.externalUrl || ''),
      isbn: String(bm.isbn || ''),
      format: String(bm.format || 'Físico'),
      status: String(bm.status || 'No leído'),
      notes: String(bm.notes || ''),
    });
    setShowAddBookDialog(true);
  };

  const saveBookBookmark = async () => {
    if (!bookForm.title.trim()) {
      toast.error('El título es obligatorio');
      return;
    }
    const loading = toast.loading('Guardando libro...');
    try {
      const payload = {
        title: bookForm.title.trim(),
        author: bookForm.author.trim() || null,
        externalUrl: bookForm.externalUrl.trim() || null,
        isbn: bookForm.isbn.trim() || null,
        format: bookForm.format,
        status: bookForm.status,
        notes: bookForm.notes.trim() || null,
      };
      if (editingBookBm) {
        const res = await fetchWithTimeout(`/api/books/bookmarks/${editingBookBm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Libro actualizado', { id: loading });
          setShowAddBookDialog(false);
          loadBookmarks();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al actualizar', { id: loading });
        }
      } else {
        const res = await fetchWithTimeout('/api/books/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success('Libro agregado', { id: loading });
          setShowAddBookDialog(false);
          loadBookmarks();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al agregar el libro', { id: loading });
        }
      }
    } catch (err) {
      console.error('Book bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteBookBookmark = async (id: unknown) => {
    if (!confirm('¿Eliminar este libro?')) return;
    try {
      const res = await fetch(`/api/books/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Libro eliminado');
        loadBookmarks();
      } else { toast.error('Error al eliminar'); }
    } catch { toast.error('Error de conexión'); }
  };

  // (filteredBookmarks is defined above with unified search logic)

  const bookFormatColor = (format: string) => {
    switch (format) {
      case 'Digital': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'Audiolibro': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedBooks = sortAsc
    ? [...filteredBooks].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredBooks].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = books.reduce((s, b) => s + b.size, 0);
  const totalBookCount = folders.reduce((s, f) => s + f.itemCount, 0) + books.length;
  const bookTitle = readingBook?.name.replace(/\.[^.]+$/, '') || '';
  const audiobookTitle = playingAudiobook?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Book Reader Overlay */}
      {readingBook && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <h3 className="text-sm font-medium truncate">{bookTitle}</h3>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">{readingBook.extension.toUpperCase()}</Badge>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {readingBook.extension.toLowerCase() === 'epub' && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentEpubChapter(Math.max(0, currentEpubChapter - 1))} disabled={currentEpubChapter === 0} title="Capítulo anterior">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
                    {currentEpubChapter + 1} / {epubChapters.length}
                  </span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentEpubChapter(Math.min(epubChapters.length - 1, currentEpubChapter + 1))} disabled={currentEpubChapter >= epubChapters.length - 1} title="Capítulo siguiente">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                <Download className="h-3.5 w-3.5" />Descargar
              </Button>
              <FileActionsMenu
                item={readingBook}
                onRename={(item) => handleRename(item)}
                onDelete={(item) => handleDelete(item.path, item.name)}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </FileActionsMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeReader}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 relative">
            {readingBook.extension.toLowerCase() === 'epub' ? (
              <div className="w-full h-full flex">
                {/* Chapter sidebar */}
                {epubChapters.length > 0 && (
                  <div className="w-56 flex-shrink-0 border-r border-border bg-card overflow-y-auto hidden md:block">
                    <div className="p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">ÍNDICE</p>
                      <p className="text-sm font-medium truncate mb-3">{epubTitle || bookTitle}</p>
                      <div className="space-y-0.5">
                        {epubChapters.map((ch, i) => (
                          <button
                            key={ch.id}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${
                              i === currentEpubChapter
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                            onClick={() => setCurrentEpubChapter(i)}
                          >
                            {ch.title || `Cap. ${i + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {/* Chapter content */}
                <div className="flex-1 relative">
                  {epubLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                      <div className="text-center space-y-3">
                        <RefreshCw className="h-8 w-8 mx-auto text-amber-500 animate-spin" />
                        <p className="text-sm text-muted-foreground">Cargando EPUB...</p>
                      </div>
                    </div>
                  )}
                  {epubError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
                      <div className="text-center space-y-3">
                        <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                        <p className="text-sm font-medium">Error al cargar el EPUB</p>
                        <Button variant="outline" size="sm" onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                          <Download className="h-3.5 w-3.5 mr-1" />Descargar archivo
                        </Button>
                      </div>
                    </div>
                  )}
                  {!epubLoading && !epubError && epubChapters.length > 0 && (
                    <iframe
                      key={currentEpubChapter}
                      src={`/api/books/epub?path=${encodeURIComponent(readingBook.path)}&chapter=${currentEpubChapter}`}
                      className="w-full h-full border-0"
                      title={epubChapters[currentEpubChapter]?.title || `Capítulo ${currentEpubChapter + 1}`}
                    />
                  )}
                </div>
              </div>
            ) : (readingBook.extension.toLowerCase() === 'pdf' || readingBook.extension.toLowerCase() === 'txt') ? (
              <iframe
                src={`/api/books/scan?path=${encodeURIComponent(readingBook.path)}&inline=true`}
                className="w-full h-full border-0"
                title={readingBook.name}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-4 max-w-md p-8">
                  <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mx-auto w-fit">
                    <BookOpen className="h-12 w-12 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">Vista previa no disponible</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Los archivos {readingBook.extension.toUpperCase()} no se pueden previsualizar en el navegador.
                      Descarga el archivo para abrirlo con tu lector de libros.
                    </p>
                  </div>
                  <Button onClick={() => handleDownload(readingBook.path, readingBook.name)}>
                    <Download className="h-4 w-4 mr-2" />Descargar {readingBook.name}
                  </Button>
                  <Button variant="ghost" onClick={closeReader}>Cerrar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audiobook Player Overlay */}
      {playingAudiobook && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Headphones className="h-4 w-4 text-violet-600 flex-shrink-0" />
              <h3 className="text-sm font-medium truncate">{audiobookTitle}</h3>
              <Badge variant="outline" className="text-[10px] flex-shrink-0">Audiolibro</Badge>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleDownload(playingAudiobook.path, playingAudiobook.name)}>
                <Download className="h-3.5 w-3.5" />Descargar
              </Button>
              <FileActionsMenu
                item={playingAudiobook}
                onRename={(item) => handleRename(item)}
                onDelete={(item) => handleDelete(item.path, item.name)}
              >
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </FileActionsMenu>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPlayingAudiobook(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Player */}
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
            <div className="text-center space-y-6 max-w-lg w-full px-6">
              <div className="p-6 rounded-3xl bg-violet-100 dark:bg-violet-900/30 mx-auto w-fit">
                <Headphones className="h-20 w-20 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold truncate">{audiobookTitle}</h2>
                <p className="text-sm text-muted-foreground mt-1">{playingAudiobook.extension.toUpperCase()} · Audiobook</p>
              </div>
              <div className="w-full">
                <audio
                  controls
                  autoPlay
                  className="w-full h-14 rounded-lg"
                  src={`/api/books/scan?path=${encodeURIComponent(playingAudiobook.path)}`}
                >
                  Tu navegador no soporta el elemento de audio.
                </audio>
              </div>
              <Button variant="ghost" onClick={() => setPlayingAudiobook(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />Volver a la biblioteca
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={libraryPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {libraryLibraryPaths.map((p) => (
            <Button key={p} variant={libraryCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setLibraryPathHistory([p]); setLibraryCurrentPath(p); }}>
              <HardDrive className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          {!libraryLibraryPaths.includes(libraryCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{libraryCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}><MoreVertical className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadBooks}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <HardDrive className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis Libros
        </Button>
      </div>

      {isSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredBooks.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Folder className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredBooks.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/30"><Folder className="h-6 w-6 text-amber-600 dark:text-amber-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-amber-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredBooks.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBooks.sort((a, b) => a.name.localeCompare(b.name)).map((book) => {
                      const ext = book.extension.replace('.', '').toUpperCase();
                      return (
                        <Card key={book.path} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer" onClick={() => openBook(book)}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2.5 rounded-xl flex-shrink-0 ${book.isAudiobook ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                                {book.isAudiobook ? <Headphones className="h-5 w-5 text-violet-600 dark:text-violet-400" /> : <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-medium truncate">{book.name.replace(/\.[^.]+$/, '')}</h4>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Badge variant="outline" className="text-[10px]">{ext}</Badge>
                                  <span>{formatBytes(book.size)}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredBookmarks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <BookMarked className="h-4 w-4" />Mis Libros
                <Badge variant="secondary" className="text-xs">{filteredBookmarks.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBookmarks.map((bm: Record<string, unknown>) => (
                  <Card key={String(bm.id)} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5"><BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold line-clamp-2 leading-tight">{String(bm.title)}</h4>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              {bm.externalUrl && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(String(bm.externalUrl), '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBookDialog(bm)}><Edit className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteBookBookmark(String(bm.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </div>
                          {bm.author && <p className="text-xs text-muted-foreground mt-0.5">{String(bm.author)}</p>}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {bm.format && <Badge variant="outline" className="text-[10px]">{String(bm.format)}</Badge>}
                            {bm.status && <Badge className={`text-[10px] ${bookStatusColor(String(bm.status))}`}>{String(bm.status)}</Badge>}
                          </div>
                          {bm.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{String(bm.notes)}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredBooks.length === 0 && filteredBookmarks.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Libros</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
      {/* Quick stats */}
      {!loading && (totalBookCount > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-amber-600 dark:text-amber-400">{totalBookCount} libros</span>
          <span>{folders.length} carpetas</span>
          {books.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{libraryCurrentPath}</span>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Biblioteca</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscar libros'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {libraryLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <HardDrive className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLibraryPaths(libraryLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisLibros" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (libraryLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...libraryLibraryPaths, p]; setLibraryLibraryPaths(np); await saveLibraryPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos y se mantienen al reiniciar.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent zIndex="z-[100]">
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : folders.length === 0 && books.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay libros aquí</p>
            <p className="text-sm text-muted-foreground mb-4">Navega a una carpeta con archivos de libros (PDF, EPUB, MOBI...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Folder Grid */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Carpetas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFolders.map((folder) => {
                  const hasCover = coverPaths[folder.path];
                  return (
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                      <div className="aspect-square relative bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <FolderOpen className="h-12 w-12 text-amber-300 dark:text-amber-700" />
                            <BookOpen className="h-6 w-6 text-amber-400 dark:text-amber-600" />
                          </div>
                        )}
                        {/* Badge */}
                        <div className="absolute top-2 right-2">
                          {folder.itemCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><BookOpen className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                          ) : folder.subFolderCount ? (
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{folder.subFolderCount}</Badge>
                          ) : null}
                        </div>
                        {/* Actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionsMenu item={folder} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)} />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} libro${folder.itemCount !== 1 ? 's' : ''}` : folder.subFolderCount ? `${folder.subFolderCount} subcarpeta${folder.subFolderCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Book Files Grid */}
          {filteredBooks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Libros ({sortedBooks.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedBooks.map((book) => {
                  const bTitle = book.name.replace(/\.[^.]+$/, '');
                  const parentDir = book.path.substring(0, book.path.lastIndexOf('/'));
                  const canView = isViewable(book.extension) || isEpub(book.extension);
                  const isAudio = isAudiobook(book.extension);
                  return (
                    <Card key={book.path} className="group cursor-pointer overflow-hidden hover:border-amber-300 dark:hover:border-amber-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => handleReadOrDownload(book)}>
                      <div className={`aspect-[3/4] relative flex items-center justify-center p-4 ${isAudio ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30' : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'}`}>
                        {!isAudio && (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(parentDir)}`}
                            alt={bTitle}
                            className="w-full h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        {isAudio && (
                          <Headphones className="h-16 w-16 text-violet-300 dark:text-violet-700" />
                        )}
                        {/* Extension badge */}
                        <Badge className={`absolute top-2 right-2 text-[10px] ${bookExtColor(book.extension)}`}>
                          {book.extension.toUpperCase()}
                        </Badge>
                        {/* Action overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center gap-2">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button
                              size="icon"
                              className={`h-10 w-10 rounded-full ${isAudio ? 'bg-violet-500 hover:bg-violet-600' : canView ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'} text-white shadow-lg`}
                              onClick={(e) => { e.stopPropagation(); handleReadOrDownload(book); }}
                              title={isAudio ? 'Escuchar' : canView ? 'Leer' : 'Descargar'}
                            >
                              {isAudio ? <Play className="h-5 w-5" /> : canView ? <Eye className="h-5 w-5" /> : (
                                downloading === book.path ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {/* Actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionsMenu item={book} onRename={handleRename} onDelete={(b) => handleDelete(b.path, b.name)} />
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">{bookFileIconSmall(book.extension)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium line-clamp-2 leading-tight">{bTitle}</p>
                            <p className="text-xs text-muted-foreground">{formatBytes(book.size)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}

      {activeTab === 'bookmarks' && (
      <div className="space-y-4">
        {/* Actions bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" className="h-8" onClick={openAddBookDialog}>
            <Plus className="h-3.5 w-3.5 mr-1" />Agregar Libro
          </Button>
          <div className="flex gap-1 ml-auto flex-wrap">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'No leído', label: 'No leído' },
              { key: 'Leyendo', label: 'Leyendo' },
              { key: 'Leído', label: 'Leído' },
              { key: 'Favorito', label: 'Favorito' },
            ].map((f) => (
              <Button
                key={f.key}
                variant={bookStatusFilter === f.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setBookStatusFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadBookmarks} disabled={bookmarksLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${bookmarksLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Bookmarks List */}
        {bookmarksLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : filteredBookmarks.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookMarked className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No hay libros guardados</p>
              <p className="text-sm text-muted-foreground mb-4">Agrega libros a tu colección con el botón "Agregar Libro"</p>
              <Button variant="outline" size="sm" onClick={openAddBookDialog}>
                <Plus className="h-4 w-4 mr-1" />Agregar Libro
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBookmarks.map((bm: Record<string, unknown>) => (
              <Card key={String(bm.id)} className="group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex-shrink-0 mt-0.5">
                      <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold line-clamp-2 leading-tight">{String(bm.title)}</h4>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          {bm.externalUrl && (
                            <a href={String(bm.externalUrl)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBookDialog(bm)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteBookBookmark(bm.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {bm.author && (
                        <p className="text-xs text-muted-foreground mt-0.5">{String(bm.author)}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {bm.format && (
                          <Badge variant="outline" className={`text-[10px] border ${bookFormatColor(String(bm.format))}`}>
                            {String(bm.format)}
                          </Badge>
                        )}
                        {bm.status && (
                          <Badge variant="outline" className={`text-[10px] border ${bookStatusColor(String(bm.status))}`}>
                            {bookStatusLabel(String(bm.status))}
                          </Badge>
                        )}
                        {bm.rating != null && Number(bm.rating) > 0 && (
                          <span className="text-xs text-amber-500 flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            {Number(bm.rating).toFixed(1)}
                          </span>
                        )}
                      </div>
                      {bm.isbn && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">ISBN: {String(bm.isbn)}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
      </>)}

      {/* Add/Edit Book Dialog */}
      <Dialog open={showAddBookDialog} onOpenChange={setShowAddBookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBookBm ? 'Editar Libro' : 'Agregar Libro'}</DialogTitle>
            <DialogDescription>{editingBookBm ? 'Modifica los datos del libro' : 'Agrega un nuevo libro a tu colección'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                placeholder="Título del libro"
                value={bookForm.title}
                onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Autor</Label>
              <Input
                placeholder="Nombre del autor"
                value={bookForm.author}
                onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Enlace externo (URL)</Label>
              <Input
                placeholder="https://..."
                value={bookForm.externalUrl}
                onChange={(e) => setBookForm({ ...bookForm, externalUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ISBN</Label>
                <Input
                  placeholder="978-..."
                  value={bookForm.isbn}
                  onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Formato</Label>
                <Select value={bookForm.format} onValueChange={(v) => setBookForm({ ...bookForm, format: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Físico">Físico</SelectItem>
                    <SelectItem value="Digital">Digital</SelectItem>
                    <SelectItem value="Audiolibro">Audiolibro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={bookForm.status} onValueChange={(v) => setBookForm({ ...bookForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="No leído">No leído</SelectItem>
                  <SelectItem value="Leyendo">Leyendo</SelectItem>
                  <SelectItem value="Leído">Leído</SelectItem>
                  <SelectItem value="Favorito">Favorito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas personales..."
                value={bookForm.notes}
                onChange={(e) => setBookForm({ ...bookForm, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBookDialog(false)}>Cancelar</Button>
            <Button onClick={saveBookBookmark} disabled={!bookForm.title.trim()}>{editingBookBm ? 'Guardar' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Music Section ──────────────────────────────────────────

function MusicSection() {
  const {
    musicCurrentPath, setMusicCurrentPath,
    musicPathHistory, setMusicPathHistory,
    musicLibraryPaths, setMusicLibraryPaths,
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying,
    musicQueue, setMusicQueue, shuffleMode, setShuffleMode,
    repeatMode, setRepeatMode,
    sidebarCollapsed,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [tracks, setTracks] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().musicLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setMusicLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'musicLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [coverFolder, setCoverFolder] = useState('');
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [musicTab, setMusicTab] = useState<'local' | 'bookmarks'>('local');
  const [musicBookmarks, setMusicBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmArtist, setBmArtist] = useState('');
  const [bmAlbum, setBmAlbum] = useState('');
  const [bmExternalUrl, setBmExternalUrl] = useState('');
  const [bmCoverUrl, setBmCoverUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [bmFavorite, setBmFavorite] = useState(false);
  const [editingMusicBm, setEditingMusicBm] = useState<Record<string, unknown> | null>(null);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(musicCurrentPath)}&type=audio`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setTracks((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'audio' as const })));
        // Check covers for folders
        const coverCheck: Record<string, boolean> = {};
        for (const f of (data.folders || [])) {
          try {
            const coverRes = await fetch(`/api/music/cover?path=${encodeURIComponent(f.path)}`);
            coverCheck[f.path] = coverRes.ok && coverRes.headers.get('content-type')?.startsWith('image/');
          } catch { coverCheck[f.path] = false; }
        }
        setCoverPaths(coverCheck);
      }
    } catch {
      toast.error('Error cargando música');
    } finally {
      setLoading(false);
    }
  }, [musicCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved music paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=musicLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setMusicLibraryPaths(saved);
              setMusicCurrentPath(saved[0]);
              setMusicPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setMusicLibraryPaths, setMusicCurrentPath, setMusicPathHistory]);

  // Save music paths to database whenever they change
  const saveMusicPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'musicLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateMusicPaths = useCallback((newPaths: string[]) => {
    setMusicLibraryPaths(newPaths);
    saveMusicPaths(newPaths);
  }, [setMusicLibraryPaths, saveMusicPaths]);

  const navigateTo = (path: string) => {
    setMusicPathHistory([...musicPathHistory, path]);
    setMusicCurrentPath(path);
  };

  const goBack = () => {
    if (musicPathHistory.length > 1) {
      const h = [...musicPathHistory]; h.pop();
      setMusicPathHistory(h);
      setMusicCurrentPath(musicPathHistory[musicPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = musicCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== musicCurrentPath) navigateTo(parent);
  };

  const playTrack = (track: MediaItem, trackList?: MediaItem[]) => {
    const queue = trackList || tracks;
    setMusicQueue(queue);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playAll = () => {
    if (tracks.length > 0) {
      setMusicQueue(tracks);
      setCurrentTrack(tracks[0]);
      setIsPlaying(true);
    }
  };

  const playFolder = async (folderPath: string) => {
    try {
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(folderPath)}&type=audio`);
      if (res.ok) {
        const data = await res.json();
        const folderTracks = (data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'audio' as const }));
        if (folderTracks.length > 0) {
          setMusicQueue(folderTracks);
          setCurrentTrack(folderTracks[0]);
          setIsPlaying(true);
          toast.success(`Reproduciendo ${folderTracks.length} canciones`);
        } else {
          toast.error('No hay canciones en esta carpeta');
        }
      }
    } catch { toast.error('Error al reproducir carpeta'); }
  };

  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.src = `/api/media/stream?path=${encodeURIComponent(currentTrack.path)}`;
    audioRef.current.volume = volume;
    if (isPlaying) audioRef.current.play().catch(() => {});
  }, [currentTrack]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.play().catch(() => {});
    else audioRef.current.pause();
  }, [isPlaying]);

  const nextTrack = useCallback(() => {
    if (musicQueue.length === 0) return;
    const currentIndex = musicQueue.findIndex((t) => t.path === currentTrack?.path);
    let nextIndex: number;
    if (shuffleMode) nextIndex = Math.floor(Math.random() * musicQueue.length);
    else nextIndex = currentIndex + 1;
    if (nextIndex >= musicQueue.length) {
      if (repeatMode === 'all') nextIndex = 0;
      else { setIsPlaying(false); return; }
    }
    setCurrentTrack(musicQueue[nextIndex]);
  }, [musicQueue, currentTrack, shuffleMode, repeatMode, setIsPlaying, setCurrentTrack]);

  const prevTrack = useCallback(() => {
    if (musicQueue.length === 0) return;
    const currentIndex = musicQueue.findIndex((t) => t.path === currentTrack?.path);
    const prevIndex = currentIndex <= 0 ? musicQueue.length - 1 : currentIndex - 1;
    setCurrentTrack(musicQueue[prevIndex]);
  }, [musicQueue, currentTrack, setCurrentTrack]);

  const handleTimeUpdate = () => { if (audioRef.current) setCurrentTime(audioRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (audioRef.current) setDuration(audioRef.current.duration); };
  const handleEnded = () => {
    if (repeatMode === 'one') { if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } }
    else nextTrack();
  };
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const formatTrackTime = (s: number) => {
    if (isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !coverFolder) return;
    const formData = new FormData();
    formData.append('path', coverFolder);
    formData.append('cover', file);
    try {
      const res = await fetch('/api/music/cover', { method: 'POST', body: formData });
      if (res.ok) { toast.success('Carátula actualizada'); loadMedia(); }
      else toast.error('Error al subir carátula');
    } catch { toast.error('Error de conexión'); }
    setShowCoverUpload(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const filteredTracks = searchQuery ? tracks.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase())) : tracks;
  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredMusicBms = searchQuery
    ? musicBookmarks.filter((bm) =>
        String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(bm.artist || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : musicBookmarks;
  const musicIsSearching = searchQuery.trim().length > 0;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedTracks = sortAsc
    ? [...filteredTracks].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredTracks].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = tracks.reduce((s, t) => s + t.size, 0);
  const totalSongs = folders.reduce((s, f) => s + f.itemCount, 0) + tracks.length;

  // ── Music Bookmarks ──
  const loadMusicBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/music/bookmarks');
      if (res.ok) { const data = await res.json(); setMusicBookmarks(data.bookmarks || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMusicBookmarks(); }, [loadMusicBookmarks]);

  const createMusicBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loading = toast.loading('Guardando canción...');
    try {
      const res = await fetchWithTimeout('/api/music/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, artist: bmArtist || null, album: bmAlbum || null, externalUrl: bmExternalUrl || null, coverUrl: bmCoverUrl || null, notes: bmNotes || null, isFavorite: bmFavorite }),
      });
      if (res.ok) {
        toast.success('Canción guardada', { id: loading });
        setShowAddBookmark(false);
        setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false);
        loadMusicBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar la canción', { id: loading });
      }
    } catch (err) {
      console.error('Music bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteMusicBookmark = async (id: string) => {
    if (!confirm('¿Eliminar este bookmark?')) return;
    try {
      const res = await fetchWithTimeout(`/api/music/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminado'); loadMusicBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const openEditMusicDialog = (bm: Record<string, unknown>) => {
    setEditingMusicBm(bm);
    setBmTitle(String(bm.title));
    setBmArtist(String(bm.artist || ''));
    setBmAlbum(String(bm.album || ''));
    setBmExternalUrl(String(bm.externalUrl || ''));
    setBmCoverUrl(String(bm.coverUrl || ''));
    setBmNotes(String(bm.notes || ''));
    setBmFavorite(!!bm.isFavorite);
    setShowAddBookmark(true);
  };

  const updateMusicBookmark = async () => {
    if (!editingMusicBm || !bmTitle.trim()) return;
    const loading = toast.loading('Actualizando canción...');
    try {
      const res = await fetchWithTimeout(`/api/music/bookmarks/${editingMusicBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, artist: bmArtist || null, album: bmAlbum || null, externalUrl: bmExternalUrl || null, coverUrl: bmCoverUrl || null, notes: bmNotes || null, isFavorite: bmFavorite }),
      });
      if (res.ok) {
        toast.success('Canción actualizada', { id: loading });
        setShowAddBookmark(false); setEditingMusicBm(null);
        setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false);
        loadMusicBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loading });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadMedia();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        loadMedia();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

  return (
    <div className="space-y-4">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleEnded} preload="metadata" />

      {/* Player Bar */}
      {currentTrack && (
        <div className={`fixed bottom-0 right-0 z-40 bg-card/95 backdrop-blur border-t border-border shadow-lg ${sidebarCollapsed ? 'md:left-[68px]' : 'md:left-64'} left-0`}>
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 min-w-0 w-48 sm:w-64">
                <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <Music className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{currentTrack.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{currentTrack.extension.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevTrack}><SkipBack className="h-4 w-4" /></Button>
                  <Button variant="default" size="icon" className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700" onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextTrack}><SkipForward className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShuffleMode(!shuffleMode)}>
                    <Shuffle className={`h-4 w-4 ${shuffleMode ? 'text-violet-500' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}>
                    <Repeat className={`h-4 w-4 ${repeatMode !== 'none' ? 'text-violet-500' : ''}`} />
                    {repeatMode === 'one' && <span className="absolute text-[8px] font-bold">1</span>}
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-md">
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{formatTrackTime(currentTime)}</span>
                  <div ref={progressRef} className="flex-1 h-1.5 bg-muted rounded-full cursor-pointer group" onClick={handleProgressClick}>
                    <div className="h-full bg-violet-500 rounded-full transition-all relative" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-violet-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10">{formatTrackTime(duration)}</span>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-32">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVolume(volume === 0 ? 0.8 : 0)}>
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-20 accent-violet-500" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={musicPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {musicLibraryPaths.map((p) => (
            <Button key={p} variant={musicCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setMusicPathHistory([p]); setMusicCurrentPath(p); }}>
              <Disc3 className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {musicCurrentPath !== '/' && musicCurrentPath !== '/home/z' && !musicLibraryPaths.includes(musicCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{musicCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}><MoreVertical className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadMedia}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={musicTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setMusicTab('local')}>
          <Music className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={musicTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setMusicTab('bookmarks')}>
          <Heart className="h-3.5 w-3.5 mr-1" />Mis Favoritos
        </Button>
      </div>

      {musicIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredTracks.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Music className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredTracks.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/30"><Folder className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-violet-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} canción{folder.itemCount !== 1 ? 'es' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredTracks.length > 0 && (
                  <div className="space-y-1">
                    {filteredTracks.sort((a, b) => a.name.localeCompare(b.name)).map((track) => (
                      <div key={track.path} className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${currentTrack?.path === track.path ? 'bg-violet-50 dark:bg-violet-950/20' : ''}`} onClick={() => { setCurrentTrack({ ...track, type: 'audio' }); setIsPlaying(true); }}>
                        <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-muted">{currentTrack?.path === track.path && isPlaying ? <div className="flex items-end gap-[2px] h-2.5"><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '60%' }} /><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} /><div className="w-[2px] bg-violet-500 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} /></div> : <Music className="h-3.5 w-3.5 text-muted-foreground" />}</div>
                        <div className="flex-1 min-w-0"><p className="text-sm truncate">{track.name.replace(/\.[^.]+$/, '')}</p><p className="text-[10px] text-muted-foreground">{formatBytes(track.size)}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredMusicBms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4" />Mis Favoritos
                <Badge variant="secondary" className="text-xs">{filteredMusicBms.length}</Badge>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMusicBms.map((bm) => (
                  <Card key={String(bm.id)} className="hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {bm.coverUrl ? <img src={String(bm.coverUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <Music className="h-5 w-5 text-violet-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{String(bm.title)}</p>
                          {bm.artist && <p className="text-sm text-muted-foreground truncate">{String(bm.artist)}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {bm.isFavorite && <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />}
                          {bm.externalUrl && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(String(bm.externalUrl), '_blank')}><ExternalLink className="h-3.5 w-3.5" /></Button>}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMusicDialog(bm)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteMusicBookmark(String(bm.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredTracks.length === 0 && filteredMusicBms.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Favoritos</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {musicTab === 'local' && (<>
      {/* Quick stats */}
      {!loading && (totalSongs > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-violet-600 dark:text-violet-400">{totalSongs} canciones</span>
          <span>{folders.length} álbumes</span>
          {tracks.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{musicCurrentPath}</span>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Música</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas música'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {musicLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Disc3 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMusicPaths(musicLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MiMusica" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (musicLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...musicLibraryPaths, p]; setMusicLibraryPaths(np); await saveMusicPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se usan como acceso rápido en la barra de navegación arriba.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Upload Dialog */}
      <Dialog open={showCoverUpload} onOpenChange={setShowCoverUpload}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Subir Carátula</DialogTitle>
            <DialogDescription>{coverFolder.split('/').pop()}</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">Elegir archivo</span>
            <span className="text-xs text-muted-foreground">Se guardará como cover.jpg</span>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverUpload} />
          </label>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent zIndex="z-[100]">
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      ) : folders.length === 0 && tracks.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Music className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay música aquí</p>
            <p className="text-sm text-muted-foreground mb-4">Navega a una carpeta con archivos de audio (MP3, FLAC, WAV, OGG...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Album Grid */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Álbumes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFolders.map((folder) => {
                  const hasCover = coverPaths[folder.path];
                  return (
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-violet-300 dark:hover:border-violet-700 transition-all hover:shadow-lg hover:-translate-y-1" onDoubleClick={() => navigateTo(folder.path)}>
                      {/* Cover */}
                      <div className="aspect-square relative bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Disc3 className="h-12 w-12 text-violet-300 dark:text-violet-700" />
                            <Music className="h-6 w-6 text-violet-400 dark:text-violet-600" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button size="icon" className="h-10 w-10 rounded-full bg-violet-500 hover:bg-violet-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); playFolder(folder.path); }}>
                              <Play className="h-5 w-5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Badge */}
                        <div className="absolute top-2 right-2">
                          {folder.itemCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-violet-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                        ) : (folder as unknown as { subFolderCount?: number }).subFolderCount ? (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{(folder as unknown as { subFolderCount: number }).subFolderCount}</Badge>
                        ) : null}
                        </div>
                        {/* Edit cover + actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <FileActionsMenu 
                            item={folder} 
                            onRename={handleRename} 
                            onDelete={(f) => handleDelete(f.path, f.name)}
                            extraItems={
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setCoverFolder(folder.path); setShowCoverUpload(true); }}>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Cambiar carátula
                                </DropdownMenuItem>
                              </>
                            }
                          />
                        </div>
                      </div>
                      {/* Album name */}
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} canción${folder.itemCount !== 1 ? 'es' : ''}` : (folder as unknown as { subFolderCount?: number }).subFolderCount ? `${(folder as unknown as { subFolderCount: number }).subFolderCount} subcarpeta${(folder as unknown as { subFolderCount: number }).subFolderCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Track list */}
          {filteredTracks.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Canciones</CardTitle>
                  <Button variant="ghost" size="sm" onClick={playAll}><Play className="h-3.5 w-3.5 mr-1 text-violet-500" />Reproducir Todo</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-96 overflow-y-auto">
                  {sortedTracks.map((track, idx) => {
                    const isActive = currentTrack?.path === track.path;
                    return (
                      <div key={track.path} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isActive ? 'bg-violet-50 dark:bg-violet-950/20' : 'hover:bg-muted/50'}`} onClick={() => playTrack(track)}>
                        <span className="text-xs text-muted-foreground w-6 text-right flex-shrink-0">{isActive && isPlaying ? '' : idx + 1}</span>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-violet-500 text-white' : 'bg-muted'}`}>
                          {isActive && isPlaying ? <div className="flex items-end gap-[2px] h-3">
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                            <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                          </div> : <Music className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-700 dark:text-violet-400' : ''}`}>{track.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(track.size)} · {track.extension.toUpperCase()}</p>
                        </div>
                        <FileActionsMenu item={track} onRename={handleRename} onDelete={(t) => handleDelete(t.path, t.name)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); playTrack(track); }}>
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {currentTrack && <div className="h-24" />}
      </>)}

      {musicTab === 'bookmarks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{musicBookmarks.length} canción{musicBookmarks.length !== 1 ? 'es' : ''} guardada{musicBookmarks.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowAddBookmark(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Agregar
            </Button>
          </div>
          {musicBookmarks.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Heart className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin favoritos aún</p>
                <p className="text-sm text-muted-foreground">Guarda canciones con links a Spotify, YouTube y más</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {musicBookmarks.map((bm) => (
                <Card key={String(bm.id)} className="hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {bm.coverUrl ? (
                          <img src={String(bm.coverUrl)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Music className="h-5 w-5 text-violet-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{String(bm.title)}</p>
                        {bm.artist && <p className="text-sm text-muted-foreground truncate">{String(bm.artist)}</p>}
                        {bm.album && <p className="text-xs text-muted-foreground truncate">{String(bm.album)}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {bm.isFavorite && <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />}
                        {bm.externalUrl && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(String(bm.externalUrl), '_blank')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMusicDialog(bm)} title="Editar">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteMusicBookmark(String(bm.id))} title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddBookmark} onOpenChange={(open) => { setShowAddBookmark(open); if (!open) { setEditingMusicBm(null); setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMusicBm ? 'Editar Canción' : 'Agregar Canción'}</DialogTitle>
            <DialogDescription>{editingMusicBm ? 'Modifica los detalles de la canción' : 'Guarda un enlace a tu canción favorita'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la canción" />
            </div>
            <div>
              <Label>Artista</Label>
              <Input value={bmArtist} onChange={(e) => setBmArtist(e.target.value)} placeholder="Nombre del artista" />
            </div>
            <div>
              <Label>Álbum</Label>
              <Input value={bmAlbum} onChange={(e) => setBmAlbum(e.target.value)} placeholder="Nombre del álbum" />
            </div>
            <div>
              <Label>URL (Spotify, YouTube...)</Label>
              <Input value={bmExternalUrl} onChange={(e) => setBmExternalUrl(e.target.value)} placeholder="https://open.spotify.com/..." />
            </div>
            <div>
              <Label>URL de Carátula (opcional)</Label>
              <Input value={bmCoverUrl} onChange={(e) => setBmCoverUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={bmFavorite} onCheckedChange={setBmFavorite} />
              <Label>Favorito</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBookmark(false); setEditingMusicBm(null); setBmTitle(''); setBmArtist(''); setBmAlbum(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); setBmFavorite(false); }}>Cancelar</Button>
            {editingMusicBm ? (
              <Button onClick={updateMusicBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createMusicBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Movies Section ──────────────────────────────────────────

function MoviesSection() {
  const {
    movieCurrentPath, setMovieCurrentPath,
    moviePathHistory, setMoviePathHistory,
    movieLibraryPaths, setMovieLibraryPaths,
    currentMovie, setCurrentMovie,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().movieLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setMovieLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'movieLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Edit folder state
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [movieBookmarks, setMovieBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bmTitle, setBmTitle] = useState('');
  const [bmExternalUrl, setBmExternalUrl] = useState('');
  const [bmCoverUrl, setBmCoverUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [editingMovieBm, setEditingMovieBm] = useState<Record<string, unknown> | null>(null);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(movieCurrentPath)}&type=video`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setMovies((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'video' as const })));
        // Check covers for folders
        const coverCheck: Record<string, boolean> = {};
        for (const f of (data.folders || [])) {
          try {
            const coverRes = await fetch(`/api/music/cover?path=${encodeURIComponent(f.path)}`);
            coverCheck[f.path] = coverRes.ok && coverRes.headers.get('content-type')?.startsWith('image/');
          } catch { coverCheck[f.path] = false; }
        }
        setCoverPaths(coverCheck);
      }
    } catch {
      toast.error('Error cargando películas');
    } finally {
      setLoading(false);
    }
  }, [movieCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved movie paths from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=movieLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setMovieLibraryPaths(saved);
              setMovieCurrentPath(saved[0]);
              setMoviePathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setMovieLibraryPaths, setMovieCurrentPath, setMoviePathHistory]);

  // Save movie paths to database
  const saveMoviePaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'movieLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  // Wrapper that updates store AND saves to DB
  const updateMoviePaths = useCallback((newPaths: string[]) => {
    setMovieLibraryPaths(newPaths);
    saveMoviePaths(newPaths);
  }, [setMovieLibraryPaths, saveMoviePaths]);

  const navigateTo = (path: string) => {
    setMoviePathHistory([...moviePathHistory, path]);
    setMovieCurrentPath(path);
  };

  const goBack = () => {
    if (moviePathHistory.length > 1) {
      const h = [...moviePathHistory]; h.pop();
      setMoviePathHistory(h);
      setMovieCurrentPath(moviePathHistory[moviePathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = movieCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== movieCurrentPath) navigateTo(parent);
  };

  const playMovie = (movie: MediaItem) => {
    setCurrentMovie(movie);
  };

  const closeMovie = () => {
    if (videoRef.current) videoRef.current.pause();
    setCurrentMovie(null);
    setIsFullscreen(false);
    setVideoError(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getDirectUrl = (movie: MediaItem) => {
    return `${window.location.origin}/api/media/stream?path=${encodeURIComponent(movie.path)}`;
  };

  const getStreamUrl = (movie: MediaItem) => {
    const ext = (movie.extension || '').toLowerCase();
    if (['mp4', 'webm', 'ogv', 'm4v'].includes(ext)) {
      return `/api/media/stream?path=${encodeURIComponent(movie.path)}`;
    }
    return `/api/media/transcode?path=${encodeURIComponent(movie.path)}`;
  };

  const openInNewTab = (movie: MediaItem) => {
    window.open(getDirectUrl(movie), '_blank');
  };

  const copyDirectLink = (movie: MediaItem) => {
    navigator.clipboard.writeText(getDirectUrl(movie));
    toast.success('Enlace copiado al portapapeles');
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const filteredMovies = searchQuery
    ? movies.filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : movies;
  const filteredFolders = searchQuery
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;
  const filteredMovieBms = searchQuery
    ? movieBookmarks.filter((bm) => String(bm.title).toLowerCase().includes(searchQuery.toLowerCase()))
    : movieBookmarks;
  const movieIsSearching = searchQuery.trim().length > 0;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedMovies = sortAsc
    ? [...filteredMovies].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredMovies].sort((a, b) => b.name.localeCompare(a.name));

  const totalSize = movies.reduce((s, m) => s + m.size, 0);

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadMedia();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        loadMedia();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

  // ── Edit Folder (rename + cover) ──
  const handleEditFolder = async (item: { path: string; name: string }) => {
    setEditFolder(item);
    setEditFolderName(item.name);
    setEditCoverFile(null);
    // Load current cover preview
    try {
      const res = await fetch(`/api/music/cover?path=${encodeURIComponent(item.path)}`);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        const blob = await res.blob();
        setEditCoverPreview(URL.createObjectURL(blob));
      } else {
        setEditCoverPreview(null);
      }
    } catch {
      setEditCoverPreview(null);
    }
  };

  const saveEditFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    setSavingEdit(true);
    try {
      // Rename if changed
      if (editFolderName.trim() !== editFolder.name) {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: editFolder.path, newName: editFolderName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al renombrar');
          setSavingEdit(false);
          return;
        }
      }
      // Upload cover if selected
      if (editCoverFile) {
        const formData = new FormData();
        // Use updated path if renamed
        const folderPath = editFolderName.trim() !== editFolder.name
          ? editFolder.path.replace(/[^/]+$/, editFolderName.trim())
          : editFolder.path;
        formData.append('path', folderPath);
        formData.append('cover', editCoverFile);
        const coverRes = await fetch('/api/music/cover', { method: 'POST', body: formData });
        if (!coverRes.ok) {
          const data = await coverRes.json().catch(() => ({}));
          toast.error(data.error || 'Error al subir carátula');
          setSavingEdit(false);
          return;
        }
      }
      toast.success('Carpeta actualizada');
      setEditFolder(null);
      setEditCoverFile(null);
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      setEditCoverPreview(null);
      loadMedia();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Movie Bookmarks ──
  const loadMovieBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/movies/bookmarks');
      if (res.ok) { const data = await res.json(); setMovieBookmarks(data.bookmarks || []); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadMovieBookmarks(); }, [loadMovieBookmarks]);

  const createMovieBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loading = toast.loading('Guardando película...');
    try {
      const res = await fetchWithTimeout('/api/movies/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, streamingUrl: bmExternalUrl || null, posterPath: bmCoverUrl || null, notes: bmNotes || null }),
      });
      if (res.ok) {
        toast.success('Película guardada', { id: loading });
        setShowAddBookmark(false);
        setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes('');
        loadMovieBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar la película', { id: loading });
      }
    } catch (err) {
      console.error('Movie bookmark error:', err);
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  const deleteMovieBookmark = async (id: string) => {
    if (!confirm('¿Eliminar esta película?')) return;
    try {
      const res = await fetchWithTimeout(`/api/movies/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadMovieBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const openEditMovieDialog = (bm: Record<string, unknown>) => {
    setEditingMovieBm(bm);
    setBmTitle(String(bm.title));
    setBmExternalUrl(String(bm.streamingUrl || ''));
    setBmCoverUrl(String(bm.posterPath || ''));
    setBmNotes(String(bm.notes || ''));
    setShowAddBookmark(true);
  };

  const updateMovieBookmark = async () => {
    if (!editingMovieBm || !bmTitle.trim()) return;
    const loading = toast.loading('Actualizando película...');
    try {
      const res = await fetchWithTimeout(`/api/movies/bookmarks/${editingMovieBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bmTitle, streamingUrl: bmExternalUrl || null, posterPath: bmCoverUrl || null, notes: bmNotes || null }),
      });
      if (res.ok) {
        toast.success('Película actualizada', { id: loading });
        setShowAddBookmark(false); setEditingMovieBm(null);
        setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes('');
        loadMovieBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loading });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo de espera agotado' : 'Error de conexión', { id: loading });
    }
  };

  // Movie name without extension for display
  const movieDisplayName = currentMovie?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Video Player Overlay */}
      {currentMovie && (
        <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Close + title bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white absolute top-0 left-0 right-0 z-10">
            <h3 className="text-sm font-medium truncate">{movieDisplayName}</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Copiar enlace" onClick={() => copyDirectLink(currentMovie)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Abrir en nueva pestaña" onClick={() => openInNewTab(currentMovie)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <div className="relative">
                <FileActionsMenu
                  item={currentMovie}
                  onRename={(item) => handleRename(item)}
                  onDelete={(item) => handleDelete(item.path, item.name)}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Más opciones">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </FileActionsMenu>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={closeMovie}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {videoError ? (
            /* Error / Unsupported format fallback */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-4 rounded-2xl bg-white/10">
                <AlertTriangle className="h-12 w-12 text-amber-400" />
              </div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-white mb-2">Formato no soportado en el navegador</h3>
                <p className="text-sm text-white/60 mb-1">{currentMovie.name}</p>
                <p className="text-xs text-white/40 mb-6">
                  Los archivos {currentMovie.extension.toUpperCase()} con códec HEVC (H.265) no son compatibles con Chrome/Firefox/Edge.
                  Puedes abrir el enlace directamente con VLC u otro reproductor externo.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => openInNewTab(currentMovie)}>
                    <ExternalLink className="h-4 w-4 mr-2" />Abrir enlace directo
                  </Button>
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => copyDirectLink(currentMovie)}>
                    <Copy className="h-4 w-4 mr-2" />Copiar enlace
                  </Button>
                  <Button variant="ghost" className="text-white/60 hover:text-white" onClick={closeMovie}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              autoPlay
              controls
              playsInline
              onError={() => setVideoError(true)}
              src={getStreamUrl(currentMovie)}
            />
          )}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Películas</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas películas'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {movieLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Film className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMoviePaths(movieLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisPeliculas" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (movieLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...movieLibraryPaths, p]; setMovieLibraryPaths(np); await saveMoviePaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos y se mantienen al reiniciar.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog (rename + cover) */}
      <Dialog open={!!editFolder} onOpenChange={(open) => { if (!open) { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Carpeta</DialogTitle>
            <DialogDescription>Cambia el nombre o agrega una carátula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cover preview + upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                {(editCoverPreview || editCoverFile) ? (
                  <img
                    src={editCoverFile ? URL.createObjectURL(editCoverFile) : editCoverPreview!}
                    alt="Carátula"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Sin carátula</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Label htmlFor="cover-upload-movie" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-movie"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditCoverFile(file);
                    e.target.value = '';
                  }}
                />
                {editCoverFile && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditCoverFile(null)}>
                    <X className="h-3 w-3 mr-1" />Quitar
                  </Button>
                )}
              </div>
            </div>
            {/* Folder name */}
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name-movie" className="text-sm">Nombre de la carpeta</Label>
              <Input
                id="edit-folder-name-movie"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditFolder(); if (e.key === 'Escape') { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); }}>Cancelar</Button>
            <Button onClick={saveEditFolder} disabled={savingEdit || !editFolderName.trim() || (editFolderName.trim() === editFolder?.name && !editCoverFile)}>
              {savingEdit ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent zIndex="z-[100]">
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={moviePathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {movieLibraryPaths.map((p) => (
            <Button key={p} variant={movieCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setMoviePathHistory([p]); setMovieCurrentPath(p); }}>
              <Film className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {movieCurrentPath !== '/' && !movieLibraryPaths.includes(movieCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{movieCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}><MoreVertical className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadMedia}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <Film className="h-3.5 w-3.5 mr-1" />Archivos Locales
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis Películas
        </Button>
      </div>

      {movieIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredMovies.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Film className="h-4 w-4" />Archivos Locales
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredMovies.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30"><Folder className="h-6 w-6 text-rose-600 dark:text-rose-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-rose-500/70 text-white h-4 w-4 flex items-center justify-center p-0">{folder.itemCount}</Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} video{folder.itemCount !== 1 ? 's' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredMovies.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredMovies.sort((a, b) => a.name.localeCompare(b.name)).map((movie) => {
                      const ext = movie.extension.toUpperCase();
                      return (
                        <Card key={movie.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playVideo(movie)}>
                          <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100"><Play className="h-7 w-7 text-rose-600 dark:text-rose-400 ml-1" /></div>
                            </div>
                            <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                          </div>
                          <CardContent className="p-3"><h4 className="text-sm font-medium truncate">{movie.name.replace(/\.[^.]+$/, '')}</h4><span className="text-xs text-muted-foreground">{formatBytes(movie.size)}</span></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredMovieBms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4" />Mis Películas
                <Badge variant="secondary" className="text-xs">{filteredMovieBms.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredMovieBms.map((bm) => (
                  <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40">
                      {bm.posterPath ? <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex flex-col items-center justify-center"><Film className="h-12 w-12 text-rose-300 dark:text-rose-700" /></div>}
                      {bm.streamingUrl && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center"><div className="opacity-0 group-hover:opacity-100 transition-all"><Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}><Play className="h-5 w-5 ml-0.5" /></Button></div></div>}
                    </div>
                    <CardContent className="p-3"><p className="text-sm font-medium truncate">{String(bm.title)}</p>{bm.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}</CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredMovies.length === 0 && filteredMovieBms.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{searchQuery}&quot; en archivos ni en Mis Películas</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
      {/* Quick stats */}
      {!loading && (movies.length > 0 || folders.length > 0) && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span className="font-medium text-rose-600 dark:text-rose-400">{movies.length} películas</span>
          <span>{folders.length} carpetas</span>
          {movies.length > 0 && <span>{formatBytes(totalSize)}</span>}
          <span className="font-mono truncate">{movieCurrentPath}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}</div>
      ) : folders.length === 0 && movies.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Film className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="font-medium mb-1">No hay películas aquí</p>
            <p className="text-sm text-muted-foreground">Configura tus carpetas de películas con el botón <MoreVertical className="h-3.5 w-3.5 inline" /> arriba</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Carpetas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {sortedFolders.map((folder) => {
                  const hasCover = coverPaths[folder.path];
                  const subCount = (folder as unknown as { subFolderCount?: number }).subFolderCount || 0;
                  return (
                    <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-rose-300 dark:hover:border-rose-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                      {/* Cover */}
                      <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 overflow-hidden">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <Folder className="h-12 w-12 text-rose-300 dark:text-rose-700" />
                            <Film className="h-6 w-6 text-rose-400 dark:text-rose-600" />
                          </div>
                        )}
                        {/* Play overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                            <Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); navigateTo(folder.path); }}>
                              <Play className="h-5 w-5 ml-0.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Badge */}
                        <div className="absolute top-2 right-2">
                          {folder.itemCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-rose-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                        ) : subCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{subCount}</Badge>
                        ) : null}
                        </div>
                        {/* Actions menu */}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <FileActionsMenu item={folder} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)} onEdit={handleEditFolder} />
                        </div>
                      </div>
                      {/* Folder name */}
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} video${folder.itemCount !== 1 ? 's' : ''}` : subCount > 0 ? `${subCount} subcarpeta${subCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Movie Grid */}
          {filteredMovies.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {sortedMovies.map((movie) => {
                const displayName = movie.name.replace(/\.[^.]+$/, '');
                const ext = movie.extension.toUpperCase();
                return (
                  <Card key={movie.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playMovie(movie)}>
                    <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                          <Play className="h-7 w-7 text-rose-600 dark:text-rose-400 ml-1" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                    </div>
                    <CardContent className="p-3">
                      <h4 className="text-sm font-medium truncate">{displayName}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{formatBytes(movie.size)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatTimeAgo(movie.modifiedAt)}</span>
                      </div>
                    </CardContent>
                    {/* Action buttons on hover */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Button
                        variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow"
                        onClick={(e) => { e.stopPropagation(); copyDirectLink(movie); }}
                        title="Copiar enlace directo"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <FileActionsMenu 
                        item={movie} 
                        onRename={handleRename} 
                        onDelete={(m) => handleDelete(m.path, m.name)}
                      >
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </FileActionsMenu>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
      </>
      )}

      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{movieBookmarks.length} película{movieBookmarks.length !== 1 ? 's' : ''} guardada{movieBookmarks.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowAddBookmark(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Agregar
            </Button>
          </div>
          {movieBookmarks.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bookmark className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin películas guardadas aún</p>
                <p className="text-sm text-muted-foreground">Guarda películas con links para verlas online</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {movieBookmarks.map((bm) => (
                <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  {/* Poster */}
                  <div className="aspect-[2/3] relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40">
                    {bm.posterPath ? (
                      <img
                        src={String(bm.posterPath)}
                        alt={String(bm.title)}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Film className="h-12 w-12 text-rose-300 dark:text-rose-700" />
                      </div>
                    )}
                    {/* Play / Open overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                        {bm.streamingUrl && (
                          <Button size="icon" className="h-10 w-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}>
                            <Play className="h-5 w-5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow bg-black/40 hover:bg-white/90 hover:text-foreground text-white border-none" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditMovieDialog(bm); }}>
                            <Edit className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteMovieBookmark(String(bm.id)); }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {/* Movie info */}
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{String(bm.title)}</p>
                    {bm.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddBookmark} onOpenChange={(open) => { setShowAddBookmark(open); if (!open) { setEditingMovieBm(null); setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMovieBm ? 'Editar Película' : 'Agregar Película'}</DialogTitle>
            <DialogDescription>{editingMovieBm ? 'Modifica los detalles de la película' : 'Guarda un enlace a tu película favorita'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la película" />
            </div>
            <div>
              <Label>URL para ver (Netflix, Prime, YouTube...)</Label>
              <Input value={bmExternalUrl} onChange={(e) => setBmExternalUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>URL del Poster (opcional)</Label>
              <Input value={bmCoverUrl} onChange={(e) => setBmCoverUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddBookmark(false); setEditingMovieBm(null); setBmTitle(''); setBmExternalUrl(''); setBmCoverUrl(''); setBmNotes(''); }}>Cancelar</Button>
            {editingMovieBm ? (
              <Button onClick={updateMovieBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createMovieBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── TV Shows Section ─────────────────────────────────────────

const tvShowStatuses = [
  { key: 'all', label: 'Todas' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'viendo', label: 'Viendo' },
  { key: 'completada', label: 'Completada' },
  { key: 'abandonada', label: 'Abandonada' },
  { key: 'favorita', label: 'Favorita' },
];

function tvShowStatusLabel(status: string): string {
  const map: Record<string, string> = { pendiente: 'Pendiente', viendo: 'Viendo', completada: 'Completada', abandonada: 'Abandonada', favorita: 'Favorita' };
  return map[status] || status;
}

function tvShowStatusColor(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    viendo: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    completada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    abandonada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    favorita: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
}

function TvShowsSection() {
  const {
    tvshowCurrentPath, setTvshowCurrentPath,
    tvshowPathHistory, setTvshowPathHistory,
    tvshowLibraryPaths, setTvshowLibraryPaths,
  } = useAppStore();

  // ── Local files state ──
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [tvFiles, setTvFiles] = useState<MediaItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [tvSearchQuery, setTvSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().tvshowLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setTvshowLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'tvshowLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [coverPaths, setCoverPaths] = useState<Record<string, boolean>>({});
  const [sortAsc, setSortAsc] = useState(true);
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Edit folder state
  const [editFolder, setEditFolder] = useState<{ path: string; name: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // ── Video player state (local) ──
  const [currentTvVideo, setCurrentTvVideo] = useState<MediaItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  // ── Bookmarks state ──
  const [activeTab, setActiveTab] = useState<'local' | 'bookmarks'>('local');
  const [bookmarks, setBookmarks] = useState<Array<Record<string, unknown>>>([]);
  const [loadingBm, setLoadingBm] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBm, setEditingBm] = useState<Record<string, unknown> | null>(null);
  const [bmTitle, setBmTitle] = useState('');
  const [bmPosterUrl, setBmPosterUrl] = useState('');
  const [bmStreamingUrl, setBmStreamingUrl] = useState('');
  const [bmNotes, setBmNotes] = useState('');
  const [bmStatus, setBmStatus] = useState('pendiente');
  const [bmRating, setBmRating] = useState('');
  const [bmSeasons, setBmSeasons] = useState('');
  const [bmCurrentSeason, setBmCurrentSeason] = useState('');
  const [bmCurrentEpisode, setBmCurrentEpisode] = useState('');
  const [bmNetwork, setBmNetwork] = useState('');
  const [bmGenre, setBmGenre] = useState('');

  // ── File browser ──
  const loadMedia = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(tvshowCurrentPath)}&type=video`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setTvFiles((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'video' as const })));
        // Check covers for folders
        const coverCheck: Record<string, boolean> = {};
        for (const f of (data.folders || [])) {
          try {
            const coverRes = await fetch(`/api/music/cover?path=${encodeURIComponent(f.path)}`);
            coverCheck[f.path] = coverRes.ok && coverRes.headers.get('content-type')?.startsWith('image/');
          } catch { coverCheck[f.path] = false; }
        }
        setCoverPaths(coverCheck);
      }
    } catch {
      toast.error('Error cargando TV Shows');
    } finally {
      setLoadingFiles(false);
    }
  }, [tvshowCurrentPath]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  // Load saved paths from DB on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=tvshowLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setTvshowLibraryPaths(saved);
              setTvshowCurrentPath(saved[0]);
              setTvshowPathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setTvshowLibraryPaths, setTvshowCurrentPath, setTvshowPathHistory]);

  const saveTvShowPaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'tvshowLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  const updateTvShowPaths = useCallback((newPaths: string[]) => {
    setTvshowLibraryPaths(newPaths);
    saveTvShowPaths(newPaths);
  }, [setTvshowLibraryPaths, saveTvShowPaths]);

  const navigateTo = (path: string) => {
    setTvshowPathHistory([...tvshowPathHistory, path]);
    setTvshowCurrentPath(path);
  };

  const goBack = () => {
    if (tvshowPathHistory.length > 1) {
      const h = [...tvshowPathHistory]; h.pop();
      setTvshowPathHistory(h);
      setTvshowCurrentPath(tvshowPathHistory[tvshowPathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = tvshowCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== tvshowCurrentPath) navigateTo(parent);
  };

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadMedia();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        loadMedia();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

  // ── Edit Folder (rename + cover) ──
  const handleEditFolder = async (item: { path: string; name: string }) => {
    setEditFolder(item);
    setEditFolderName(item.name);
    setEditCoverFile(null);
    try {
      const res = await fetch(`/api/music/cover?path=${encodeURIComponent(item.path)}`);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        const blob = await res.blob();
        setEditCoverPreview(URL.createObjectURL(blob));
      } else {
        setEditCoverPreview(null);
      }
    } catch {
      setEditCoverPreview(null);
    }
  };

  const saveEditFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    setSavingEdit(true);
    try {
      if (editFolderName.trim() !== editFolder.name) {
        const res = await fetch('/api/files/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: editFolder.path, newName: editFolderName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || 'Error al renombrar');
          setSavingEdit(false);
          return;
        }
      }
      if (editCoverFile) {
        const formData = new FormData();
        const folderPath = editFolderName.trim() !== editFolder.name
          ? editFolder.path.replace(/[^/]+$/, editFolderName.trim())
          : editFolder.path;
        formData.append('path', folderPath);
        formData.append('cover', editCoverFile);
        const coverRes = await fetch('/api/music/cover', { method: 'POST', body: formData });
        if (!coverRes.ok) {
          const data = await coverRes.json().catch(() => ({}));
          toast.error(data.error || 'Error al subir carátula');
          setSavingEdit(false);
          return;
        }
      }
      toast.success('Carpeta actualizada');
      setEditFolder(null);
      setEditCoverFile(null);
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      setEditCoverPreview(null);
      loadMedia();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Video player ──
  const playTvVideo = (item: MediaItem) => { setCurrentTvVideo(item); };

  const closeTvVideo = () => {
    if (videoRef.current) videoRef.current.pause();
    setCurrentTvVideo(null);
    setIsFullscreen(false);
    setVideoError(false);
  };

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const getDirectUrl = (item: MediaItem) => `${window.location.origin}/api/media/stream?path=${encodeURIComponent(item.path)}`;

  const getStreamUrl = (item: MediaItem) => {
    const ext = (item.extension || '').toLowerCase();
    if (['mp4', 'webm', 'ogv', 'm4v'].includes(ext)) {
      return `/api/media/stream?path=${encodeURIComponent(item.path)}`;
    }
    return `/api/media/transcode?path=${encodeURIComponent(item.path)}`;
  };

  const openInNewTab = (item: MediaItem) => window.open(getDirectUrl(item), '_blank');

  const copyDirectLink = (item: MediaItem) => {
    navigator.clipboard.writeText(getDirectUrl(item));
    toast.success('Enlace copiado al portapapeles');
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // ── File filters ──
  const filteredTvFiles = tvSearchQuery ? tvFiles.filter((m) => m.name.toLowerCase().includes(tvSearchQuery.toLowerCase())) : tvFiles;
  const filteredFolders = tvSearchQuery ? folders.filter((f) => f.name.toLowerCase().includes(tvSearchQuery.toLowerCase())) : folders;
  // Unified search flag
  const tvIsSearching = tvSearchQuery.trim().length > 0;
  const sortedFolders = sortAsc ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name)) : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedFiles = sortAsc ? [...filteredTvFiles].sort((a, b) => a.name.localeCompare(b.name)) : [...filteredTvFiles].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = tvFiles.reduce((s, m) => s + m.size, 0);

  // ── Bookmarks ──
  const loadBookmarks = useCallback(async () => {
    try {
      setLoadingBm(true);
      const res = await fetch('/api/tvshows/bookmarks');
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks || []);
      }
    } catch {
      toast.error('Error cargando series');
    } finally {
      setLoadingBm(false);
    }
  }, []);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  const filteredBookmarks = bookmarks
    .filter((bm) => statusFilter === 'all' || String(bm.status) === statusFilter)
    .filter((bm) => !tvSearchQuery || String(bm.title).toLowerCase().includes(tvSearchQuery.toLowerCase()) || String(bm.genre || '').toLowerCase().includes(tvSearchQuery.toLowerCase()) || String(bm.network || '').toLowerCase().includes(tvSearchQuery.toLowerCase()));

  const openAddDialog = () => {
    setEditingBm(null);
    setBmTitle(''); setBmPosterUrl(''); setBmStreamingUrl(''); setBmNotes('');
    setBmStatus('pendiente'); setBmRating(''); setBmSeasons(''); setBmCurrentSeason(''); setBmCurrentEpisode('');
    setBmNetwork(''); setBmGenre('');
    setShowAddDialog(true);
  };

  const openEditDialog = (bm: Record<string, unknown>) => {
    setEditingBm(bm);
    setBmTitle(String(bm.title));
    setBmPosterUrl(String(bm.posterPath || ''));
    setBmStreamingUrl(String(bm.streamingUrl || ''));
    setBmNotes(String(bm.notes || ''));
    setBmStatus(String(bm.status || 'pendiente'));
    setBmRating(bm.rating != null ? String(bm.rating) : '');
    setBmSeasons(bm.seasons != null ? String(bm.seasons) : '');
    setBmCurrentSeason(bm.currentSeason != null ? String(bm.currentSeason) : '');
    setBmCurrentEpisode(bm.currentEpisode != null ? String(bm.currentEpisode) : '');
    setBmNetwork(String(bm.network || ''));
    setBmGenre(String(bm.genre || ''));
    setShowAddDialog(true);
  };

  const createBookmark = async () => {
    if (!bmTitle.trim()) return;
    const loadingToast = toast.loading('Guardando serie...');
    try {
      const res = await fetchWithTimeout('/api/tvshows/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bmTitle, posterPath: bmPosterUrl || null, streamingUrl: bmStreamingUrl || null,
          notes: bmNotes || null, status: bmStatus, rating: bmRating ? parseInt(bmRating) : null,
          seasons: bmSeasons ? parseInt(bmSeasons) : null, currentSeason: bmCurrentSeason ? parseInt(bmCurrentSeason) : null,
          currentEpisode: bmCurrentEpisode ? parseInt(bmCurrentEpisode) : null, network: bmNetwork || null, genre: bmGenre || null,
        }),
      });
      if (res.ok) {
        toast.success('Serie guardada', { id: loadingToast });
        setShowAddDialog(false);
        loadBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al guardar', { id: loadingToast });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo agotado' : 'Error de conexión', { id: loadingToast });
    }
  };

  const updateBookmark = async () => {
    if (!editingBm || !bmTitle.trim()) return;
    const loadingToast = toast.loading('Actualizando serie...');
    try {
      const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${editingBm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bmTitle, posterPath: bmPosterUrl || null, streamingUrl: bmStreamingUrl || null,
          notes: bmNotes || null, status: bmStatus, rating: bmRating ? parseInt(bmRating) : null,
          seasons: bmSeasons ? parseInt(bmSeasons) : null, currentSeason: bmCurrentSeason ? parseInt(bmCurrentSeason) : null,
          currentEpisode: bmCurrentEpisode ? parseInt(bmCurrentEpisode) : null, network: bmNetwork || null, genre: bmGenre || null,
        }),
      });
      if (res.ok) {
        toast.success('Serie actualizada', { id: loadingToast });
        setShowAddDialog(false); setEditingBm(null);
        loadBookmarks();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar', { id: loadingToast });
      }
    } catch (err) {
      toast.error(err instanceof DOMException && err.name === 'AbortError' ? 'Tiempo agotado' : 'Error de conexión', { id: loadingToast });
    }
  };

  const deleteBookmark = async (id: string) => {
    if (!confirm('¿Eliminar esta serie?')) return;
    try {
      const res = await fetchWithTimeout(`/api/tvshows/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadBookmarks(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const closeDialog = () => {
    setShowAddDialog(false); setEditingBm(null);
    setBmTitle(''); setBmPosterUrl(''); setBmStreamingUrl(''); setBmNotes('');
    setBmStatus('pendiente'); setBmRating(''); setBmSeasons(''); setBmCurrentSeason(''); setBmCurrentEpisode('');
    setBmNetwork(''); setBmGenre('');
  };

  const tvDisplayName = currentTvVideo?.name.replace(/\.[^.]+$/, '') || '';

  return (
    <div className="space-y-4">
      {/* Video Player Overlay */}
      {currentTvVideo && (
        <div ref={playerContainerRef} className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 text-white absolute top-0 left-0 right-0 z-10">
            <h3 className="text-sm font-medium truncate">{tvDisplayName}</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Copiar enlace" onClick={() => copyDirectLink(currentTvVideo)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" title="Abrir en nueva pestaña" onClick={() => openInNewTab(currentTvVideo)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:text-white/80" onClick={closeTvVideo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {videoError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-4 rounded-2xl bg-white/10"><AlertTriangle className="h-12 w-12 text-amber-400" /></div>
              <div className="text-center max-w-md">
                <h3 className="text-lg font-semibold text-white mb-2">Formato no soportado en el navegador</h3>
                <p className="text-sm text-white/60 mb-1">{currentTvVideo.name}</p>
                <p className="text-xs text-white/40 mb-6">Puedes abrir el enlace directamente con VLC u otro reproductor externo.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => openInNewTab(currentTvVideo)}><ExternalLink className="h-4 w-4 mr-2" />Abrir enlace directo</Button>
                  <Button variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => copyDirectLink(currentTvVideo)}><Copy className="h-4 w-4 mr-2" />Copiar enlace</Button>
                  <Button variant="ghost" className="text-white/60 hover:text-white" onClick={closeTvVideo}>Cerrar</Button>
                </div>
              </div>
            </div>
          ) : (
            <video ref={videoRef} className="w-full h-full object-contain" autoPlay controls playsInline onError={() => setVideoError(true)} src={getStreamUrl(currentTvVideo)} />
          )}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de TV Shows</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas series'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {tvshowLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2 min-w-0">
                  <Monitor className="h-4 w-4 text-sky-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateTvShowPaths(tvshowLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisSeries" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (tvshowLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...tvshowLibraryPaths, p]; setTvshowLibraryPaths(np); await saveTvShowPaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos.</p>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Folder Dialog (rename + cover) */}
      <Dialog open={!!editFolder} onOpenChange={(open) => { if (!open) { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Carpeta</DialogTitle>
            <DialogDescription>Cambia el nombre o agrega una carátula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cover preview + upload */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/50">
                {(editCoverPreview || editCoverFile) ? (
                  <img
                    src={editCoverFile ? URL.createObjectURL(editCoverFile) : editCoverPreview!}
                    alt="Carátula"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-xs">Sin carátula</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Label htmlFor="cover-upload-tv" className="cursor-pointer">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    Subir carátula
                  </div>
                </Label>
                <input
                  id="cover-upload-tv"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setEditCoverFile(file);
                    e.target.value = '';
                  }}
                />
                {editCoverFile && (
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditCoverFile(null)}>
                    <X className="h-3 w-3 mr-1" />Quitar
                  </Button>
                )}
              </div>
            </div>
            {/* Folder name */}
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name-tv" className="text-sm">Nombre de la carpeta</Label>
              <Input
                id="edit-folder-name-tv"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEditFolder(); if (e.key === 'Escape') { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); } }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditFolder(null); setEditCoverFile(null); if (editCoverPreview) URL.revokeObjectURL(editCoverPreview); setEditCoverPreview(null); }}>Cancelar</Button>
            <Button onClick={saveEditFolder} disabled={savingEdit || !editFolderName.trim() || (editFolderName.trim() === editFolder?.name && !editCoverFile)}>
              {savingEdit ? <><RefreshCw className="h-4 w-4 mr-1 animate-spin" />Guardando...</> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={tvshowPathHistory.length <= 1}><ArrowLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}><ChevronUp className="h-4 w-4" /></Button>
          {tvshowLibraryPaths.map((p) => (
            <Button key={p} variant={tvshowCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs max-w-[140px]" onClick={() => { setTvshowPathHistory([p]); setTvshowCurrentPath(p); }}>
              <Monitor className="h-3.5 w-3.5 mr-1 shrink-0" /><span className="truncate">{p.split('/').pop()}</span>
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigateTo('/')}><HomeIcon className="h-4 w-4" /></Button>
          {tvshowCurrentPath !== '/' && !tvshowLibraryPaths.includes(tvshowCurrentPath) && (
            <><ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span className="text-sm font-medium truncate">{tvshowCurrentPath.split('/').pop()}</span></>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar en todo..." value={tvSearchQuery} onChange={(e) => setTvSearchQuery(e.target.value)} className="pl-9 h-8 w-48" />
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}><MoreVertical className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadMedia}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={activeTab === 'local' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('local')}>
          <Monitor className="h-3.5 w-3.5 mr-1" />TV Shows de Archivo
        </Button>
        <Button variant={activeTab === 'bookmarks' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setActiveTab('bookmarks')}>
          <Bookmark className="h-3.5 w-3.5 mr-1" />Mis TV Shows
        </Button>
      </div>

      {tvIsSearching ? (
        /* ── Unified Search Results ── */
        <div className="space-y-6">
          {(filteredFolders.length > 0 || filteredTvFiles.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Monitor className="h-4 w-4" />TV Shows de Archivo
                <Badge variant="secondary" className="text-xs">{filteredFolders.length + filteredTvFiles.length}</Badge>
              </h3>
              <div className="space-y-4">
                {filteredFolders.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {filteredFolders.sort((a, b) => a.name.localeCompare(b.name)).map((folder) => (
                      <Card key={folder.path} className="group cursor-pointer hover:border-sky-300 dark:hover:border-sky-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                        <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                          <div className="relative">
                            <div className="p-3 rounded-xl bg-sky-100 dark:bg-sky-900/30"><Folder className="h-6 w-6 text-sky-600 dark:text-sky-400" /></div>
                            {folder.itemCount > 0 ? <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-sky-500/70 text-white h-4 w-4 flex items-center justify-center p-0"><Play className="h-2 w-2" /></Badge> : null}
                          </div>
                          <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                          <p className="text-[10px] text-muted-foreground">{folder.itemCount} video{folder.itemCount !== 1 ? 's' : ''}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {filteredTvFiles.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredTvFiles.sort((a, b) => a.name.localeCompare(b.name)).map((file) => {
                      const displayName = file.name.replace(/\.[^.]+$/, '');
                      const ext = file.extension.toUpperCase();
                      return (
                        <Card key={file.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playTvVideo(file)}>
                          <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                            <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100"><Play className="h-7 w-7 text-sky-600 dark:text-sky-400 ml-1" /></div>
                            </div>
                            <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                          </div>
                          <CardContent className="p-3"><h4 className="text-sm font-medium truncate">{displayName}</h4><span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span></CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          {filteredBookmarks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Bookmark className="h-4 w-4" />Mis TV Shows
                <Badge variant="secondary" className="text-xs">{filteredBookmarks.length}</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filteredBookmarks.map((bm) => (
                  <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                    <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40">
                      {bm.posterPath ? <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex flex-col items-center justify-center"><Monitor className="h-12 w-12 text-sky-300 dark:text-sky-700" /></div>}
                      <div className="absolute top-2 left-2"><Badge className={`text-[10px] ${tvShowStatusColor(String(bm.status))}`}>{tvShowStatusLabel(String(bm.status))}</Badge></div>
                      {bm.streamingUrl && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center"><div className="opacity-0 group-hover:opacity-100 transition-all"><Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}><Play className="h-5 w-5 ml-0.5" /></Button></div></div>}
                      {bm.rating != null && Number(bm.rating) > 0 && <div className="absolute bottom-2 left-2"><Badge variant="secondary" className="text-[10px] bg-black/50 text-amber-400 border-none backdrop-blur-sm flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{Number(bm.rating).toFixed(1)}</Badge></div>}
                    </div>
                    <CardContent className="p-3"><p className="text-sm font-medium truncate">{String(bm.title)}</p><div className="flex items-center gap-1.5 mt-1 flex-wrap">{bm.genre && <span className="text-[10px] text-muted-foreground">{String(bm.genre)}</span>}{bm.seasons && <span className="text-[10px] text-muted-foreground">· {bm.seasons} temp.</span>}</div></CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {filteredFolders.length === 0 && filteredTvFiles.length === 0 && filteredBookmarks.length === 0 && (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin resultados</p>
                <p className="text-sm text-muted-foreground">No se encontró &quot;{tvSearchQuery}&quot; en archivos ni en Mis TV Shows</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (<>
      {activeTab === 'local' && (
      <>
        {/* Quick stats */}
        {!loadingFiles && (tvFiles.length > 0 || folders.length > 0) && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
            <span className="font-medium text-sky-600 dark:text-sky-400">{tvFiles.length} videos</span>
            <span>{folders.length} carpetas</span>
            {tvFiles.length > 0 && <span>{formatBytes(totalSize)}</span>}
            <span className="font-mono truncate">{tvshowCurrentPath}</span>
          </div>
        )}

        {/* Loading */}
        {loadingFiles ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-lg" />)}</div>
        ) : folders.length === 0 && tvFiles.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Monitor className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="font-medium mb-1">No hay videos aquí</p>
              <p className="text-sm text-muted-foreground">Configura tus carpetas de TV Shows con el botón <MoreVertical className="h-3.5 w-3.5 inline" /> arriba</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Folders */}
            {filteredFolders.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Carpetas</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {sortedFolders.map((folder) => {
                    const hasCover = coverPaths[folder.path];
                    const subCount = (folder as unknown as { subFolderCount?: number }).subFolderCount || 0;
                    return (
                      <Card key={folder.path} className="group cursor-pointer overflow-hidden hover:border-sky-300 dark:hover:border-sky-700 transition-all hover:shadow-lg hover:-translate-y-1" onClick={() => navigateTo(folder.path)}>
                        {/* Cover */}
                        <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40 overflow-hidden">
                          {hasCover ? (
                            <img
                              src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                              alt={folder.name}
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                              <Folder className="h-12 w-12 text-sky-300 dark:text-sky-700" />
                              <Monitor className="h-6 w-6 text-sky-400 dark:text-sky-600" />
                            </div>
                          )}
                          {/* Play overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                              <Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); navigateTo(folder.path); }}>
                                <Play className="h-5 w-5 ml-0.5" />
                              </Button>
                            </div>
                          </div>
                          {/* Badge */}
                          <div className="absolute top-2 right-2">
                            {folder.itemCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-sky-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Play className="h-2.5 w-2.5" />{folder.itemCount}</Badge>
                          ) : subCount > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/70 text-white backdrop-blur-sm flex items-center gap-1"><Folder className="h-2.5 w-2.5" />{subCount}</Badge>
                          ) : null}
                          </div>
                          {/* Actions menu */}
                          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <FileActionsMenu item={folder} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)} onEdit={handleEditFolder} />
                          </div>
                        </div>
                        {/* Folder name */}
                        <CardContent className="p-3">
                          <p className="text-sm font-medium truncate">{folder.name}</p>
                          <p className="text-xs text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} video${folder.itemCount !== 1 ? 's' : ''}` : subCount > 0 ? `${subCount} subcarpeta${subCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Video Grid */}
            {filteredTvFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {sortedFiles.map((file) => {
                  const displayName = file.name.replace(/\.[^.]+$/, '');
                  const ext = file.extension.toUpperCase();
                  return (
                    <Card key={file.path} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative" onClick={() => playTvVideo(file)}>
                      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <Film className="h-12 w-12 text-white/20 group-hover:text-white/40 transition-colors" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
                            <Play className="h-7 w-7 text-sky-600 dark:text-sky-400 ml-1" />
                          </div>
                        </div>
                        <Badge className="absolute top-2 right-2 text-[10px] bg-black/60 text-white border-none">{ext}</Badge>
                      </div>
                      <CardContent className="p-3">
                        <h4 className="text-sm font-medium truncate">{displayName}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(file.modifiedAt)}</span>
                        </div>
                      </CardContent>
                      {/* Action buttons on hover */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow" onClick={(e) => { e.stopPropagation(); copyDirectLink(file); }} title="Copiar enlace directo">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <FileActionsMenu item={file} onRename={handleRename} onDelete={(f) => handleDelete(f.path, f.name)}>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </FileActionsMenu>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </>
      )}

      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {tvShowStatuses.map((f) => (
              <Button key={f.key} variant={statusFilter === f.key ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setStatusFilter(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>

          {/* Stats */}
          {!loadingBm && bookmarks.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{filteredBookmarks.length} serie{filteredBookmarks.length !== 1 ? 's' : ''} {statusFilter !== 'all' ? tvShowStatusLabel(statusFilter).toLowerCase() + '(s)' : ''}</p>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-3.5 w-3.5 mr-1" />Agregar
              </Button>
            </div>
          )}

          {/* Loading */}
          {loadingBm ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-lg" />)}
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">{bookmarks.length === 0 ? 'Sin series guardadas aún' : 'No hay resultados'}</p>
                <p className="text-sm text-muted-foreground mb-4">Guarda tus series favoritas con poster y detalles</p>
                {bookmarks.length === 0 && (
                  <Button variant="outline" size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 mr-1" />Agregar Serie
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredBookmarks.map((bm) => (
                <Card key={String(bm.id)} className="group cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  {/* Poster */}
                  <div className="aspect-[2/3] relative bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-950/40 dark:to-blue-950/40">
                    {bm.posterPath ? (
                      <img src={String(bm.posterPath)} alt={String(bm.title)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Monitor className="h-12 w-12 text-sky-300 dark:text-sky-700" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-2 left-2">
                      <Badge className={`text-[10px] ${tvShowStatusColor(String(bm.status))}`}>
                        {tvShowStatusLabel(String(bm.status))}
                      </Badge>
                    </div>
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                        {bm.streamingUrl && (
                          <Button size="icon" className="h-10 w-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg" onClick={(e) => { e.stopPropagation(); window.open(String(bm.streamingUrl), '_blank'); }}>
                            <Play className="h-5 w-5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full shadow bg-black/40 hover:bg-white/90 hover:text-foreground text-white border-none" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(bm); }}>
                            <Edit className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); deleteBookmark(String(bm.id)); }} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {/* Rating */}
                    {bm.rating != null && Number(bm.rating) > 0 && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="secondary" className="text-[10px] bg-black/50 text-amber-400 border-none backdrop-blur-sm flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />{Number(bm.rating).toFixed(1)}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{String(bm.title)}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {bm.genre && <span className="text-[10px] text-muted-foreground">{String(bm.genre)}</span>}
                      {bm.seasons && <span className="text-[10px] text-muted-foreground">· {bm.seasons} temp.</span>}
                    </div>
                    {bm.currentSeason && bm.currentEpisode && (
                      <p className="text-[10px] text-sky-600 dark:text-sky-400 mt-0.5">S{String(bm.currentSeason)}E{String(bm.currentEpisode)}</p>
                    )}
                    {bm.notes && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{String(bm.notes)}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Add/Edit Bookmark Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeDialog(); else setShowAddDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBm ? 'Editar Serie' : 'Agregar Serie'}</DialogTitle>
            <DialogDescription>{editingBm ? 'Modifica los detalles de la serie' : 'Guarda una serie a tu colección'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>Título *</Label>
              <Input value={bmTitle} onChange={(e) => setBmTitle(e.target.value)} placeholder="Nombre de la serie" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temporadas</Label>
                <Input type="number" min="0" value={bmSeasons} onChange={(e) => setBmSeasons(e.target.value)} placeholder="8" />
              </div>
              <div>
                <Label>Género</Label>
                <Input value={bmGenre} onChange={(e) => setBmGenre(e.target.value)} placeholder="Drama, Comedia..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temporada actual</Label>
                <Input type="number" min="0" value={bmCurrentSeason} onChange={(e) => setBmCurrentSeason(e.target.value)} placeholder="3" />
              </div>
              <div>
                <Label>Episodio actual</Label>
                <Input type="number" min="0" value={bmCurrentEpisode} onChange={(e) => setBmCurrentEpisode(e.target.value)} placeholder="5" />
              </div>
            </div>
            <div>
              <Label>Red</Label>
              <Input value={bmNetwork} onChange={(e) => setBmNetwork(e.target.value)} placeholder="Netflix, HBO, AMC..." />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={bmStatus} onValueChange={setBmStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tvShowStatuses.filter((f) => f.key !== 'all').map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Calificación (1-10)</Label>
              <Input type="number" min="0" max="10" step="0.1" value={bmRating} onChange={(e) => setBmRating(e.target.value)} placeholder="8.5" className="w-24" />
            </div>
            <div>
              <Label>URL para ver</Label>
              <Input value={bmStreamingUrl} onChange={(e) => setBmStreamingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>URL del Poster</Label>
              <Input value={bmPosterUrl} onChange={(e) => setBmPosterUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={bmNotes} onChange={(e) => setBmNotes(e.target.value)} placeholder="Notas..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {editingBm ? (
              <Button onClick={updateBookmark} disabled={!bmTitle.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createBookmark} disabled={!bmTitle.trim()}>Guardar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Images Section ─────────────────────────────────────────

function ImagesSection() {
  const {
    imageCurrentPath, setImageCurrentPath,
    imagePathHistory, setImagePathHistory,
    imageLibraryPaths, setImageLibraryPaths,
    currentImage, setCurrentImage,
  } = useAppStore();
  const [folders, setFolders] = useState<Array<{ name: string; path: string; itemCount: number }>>([]);
  const [images, setImages] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [newPath, setNewPath] = useState('');
  const folderPicker = useFolderPicker(async (path) => {
    try {
      const current = useAppStore.getState().imageLibraryPaths;
      if (current.includes(path)) { toast.info('Esta carpeta ya está en la lista'); return; }
      const newPaths = [...current, path];
      useAppStore.getState().setImageLibraryPaths(newPaths);
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'imageLibraryPaths', value: JSON.stringify(newPaths) }) });
      if (!res.ok) throw new Error('Error al guardar');
      toast.success('Carpeta agregada');
    } catch (e) { toast.error('No se pudo guardar la carpeta'); console.error(e); }
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'masonry'>('grid');
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(imageCurrentPath)}&type=image`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setImages((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'image' as const })));
      }
    } catch {
      toast.error('Error cargando imágenes');
    } finally {
      setLoading(false);
    }
  }, [imageCurrentPath]);

  useEffect(() => { loadImages(); }, [loadImages]);

  // Load saved paths from DB
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings?key=imageLibraryPaths');
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const saved = JSON.parse(data.value) as string[];
            if (saved.length > 0) {
              setImageLibraryPaths(saved);
              setImageCurrentPath(saved[0]);
              setImagePathHistory([saved[0]]);
            }
          }
        }
      } catch { /* use defaults */ }
    };
    loadSettings();
  }, [setImageLibraryPaths, setImageCurrentPath, setImagePathHistory]);

  const savePaths = useCallback(async (paths: string[]) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'imageLibraryPaths', value: JSON.stringify(paths) }),
      });
    } catch { /* ignore */ }
  }, []);

  const updatePaths = useCallback((newPaths: string[]) => {
    setImageLibraryPaths(newPaths);
    savePaths(newPaths);
  }, [setImageLibraryPaths, savePaths]);

  const navigateTo = (p: string) => {
    setImagePathHistory([...imagePathHistory, p]);
    setImageCurrentPath(p);
  };

  const goBack = () => {
    if (imagePathHistory.length > 1) {
      const h = [...imagePathHistory]; h.pop();
      setImagePathHistory(h);
      setImageCurrentPath(imagePathHistory[imagePathHistory.length - 2]);
    }
  };

  const goUp = () => {
    const parent = imageCurrentPath.split('/').slice(0, -1).join('/') || '/';
    if (parent !== imageCurrentPath) navigateTo(parent);
  };

  const openImage = (img: MediaItem) => setCurrentImage(img);

  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredImages = searchQuery ? images.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())) : images;
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedImages = sortAsc
    ? [...filteredImages].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredImages].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = images.reduce((s, i) => s + i.size, 0);

  const handleDelete = async (filePath: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminado`);
        loadImages();
      } else {
        toast.error('Error al eliminar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  };

  const handleRename = (item: { path: string; name: string }) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };

  const confirmRename = async () => {
    if (!renameItem || !renameValue.trim() || renameValue.trim() === renameItem.name) {
      setRenameItem(null);
      return;
    }
    try {
      const res = await fetch('/api/files/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: renameItem.path, newName: renameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({ newName: renameValue.trim() }));
        toast.success(`Renombrado a "${data.newName || renameValue.trim()}"`);
        loadImages();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al renombrar');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setRenameItem(null);
  };

  const currentImageIndex = currentImage ? images.findIndex((i) => i.path === currentImage.path) : -1;
  const hasPrevImage = currentImageIndex > 0;
  const hasNextImage = currentImageIndex < images.length - 1;

  const navigatePrevImage = () => {
    if (hasPrevImage) setCurrentImage(images[currentImageIndex - 1]);
  };
  const navigateNextImage = () => {
    if (hasNextImage) setCurrentImage(images[currentImageIndex + 1]);
  };

  // Keyboard nav for image viewer
  useEffect(() => {
    if (!currentImage) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') navigatePrevImage();
      if (e.key === 'ArrowRight') navigateNextImage();
      if (e.key === 'Escape') setCurrentImage(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // ─── Image Viewer Overlay ──────────────────────────────
  if (currentImage) {
    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-black/50">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ImageIcon className="h-4 w-4 text-white/70 flex-shrink-0" />
              <h3 className="text-sm font-medium text-white truncate">{currentImage.name}</h3>
              <span className="text-xs text-white/50 flex-shrink-0">{formatBytes(currentImage.size)}</span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={navigatePrevImage} disabled={!hasPrevImage}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-white/70 min-w-[60px] text-center">{currentImageIndex + 1} / {images.length}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={navigateNextImage} disabled={!hasNextImage}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <a href={`/api/media/stream?path=${encodeURIComponent(currentImage.path)}`} download={currentImage.name} className="ml-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
              <div className="ml-1">
                <FileActionsMenu
                  item={currentImage}
                  onRename={(item) => handleRename(item)}
                  onDelete={(item) => handleDelete(item.path, item.name)}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </FileActionsMenu>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => setCurrentImage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={`/api/media/stream?path=${encodeURIComponent(currentImage.path)}`}
              alt={currentImage.name}
              className="max-w-full max-h-full object-contain rounded shadow-2xl"
            />
          </div>
        </div>

        {/* Rename Dialog - rendered on top of the image viewer */}
        <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
          <DialogContent zIndex="z-[100]">
            <DialogHeader>
              <DialogTitle>Renombrar</DialogTitle>
              <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
            </DialogHeader>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
              <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Path bar + search + actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goBack} disabled={imagePathHistory.length <= 1}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={goUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 flex-shrink-0" onClick={() => { setImagePathHistory([imageLibraryPaths[0] || '/mnt/Canal']); setImageCurrentPath(imageLibraryPaths[0] || '/mnt/Canal'); }}>
            <HomeIcon className="h-4 w-4 mr-1" />Imágenes
          </Button>
          {imagePathHistory.length > 1 && imagePathHistory.slice(1).map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <Button variant="ghost" size="sm" className="h-8 max-w-[140px]" onClick={() => {
                setImagePathHistory(imagePathHistory.slice(0, i + 2));
                setImageCurrentPath(p);
              }}>
                <span className="truncate">{p.split('/').pop()}</span>
              </Button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-40 pl-9 text-sm" />
          </div>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('grid')}><Grid3X3 className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'masonry' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('masonry')}><LayoutDashboard className="h-4 w-4" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode('list')}><List className="h-4 w-4" /></Button>
          </div>
          <Button variant={sortAsc ? 'secondary' : 'outline'} size="icon" className="h-8 w-8" onClick={() => setSortAsc(!sortAsc)} title={sortAsc ? 'A → Z' : 'Z → A'}>
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowSettings(true)}>
            <MoreVertical className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={loadImages}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Imágenes</DialogTitle>
            <DialogDescription>{folderPicker.pickerMode ? 'Navega y selecciona una carpeta' : 'Configura las carpetas donde buscas imágenes'}</DialogDescription>
          </DialogHeader>
          {folderPicker.pickerMode ? (
            folderPicker.pickerContent
          ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              {imageLibraryPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono truncate min-w-0" title={p}>{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updatePaths(imageLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input placeholder="/mnt/MisFotos" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1 min-w-[120px]" />
              <Button variant="outline" onClick={folderPicker.openPicker} title="Explorar carpetas">
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button onClick={async () => { if (newPath.trim()) { const p = newPath.trim(); if (imageLibraryPaths.includes(p)) { toast.info('Ya existe'); return; } try { const np = [...imageLibraryPaths, p]; setImageLibraryPaths(np); await savePaths(np); toast.success('Carpeta agregada'); setNewPath(''); } catch { toast.error('Error al guardar'); } } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
          </div>
          )}
          <DialogFooter>{!folderPicker.pickerMode && <Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameItem} onOpenChange={(open) => { if (!open) setRenameItem(null); }}>
        <DialogContent zIndex="z-[100]">
          <DialogHeader>
            <DialogTitle>Renombrar</DialogTitle>
            <DialogDescription>Cambia el nombre de "{renameItem?.name}"</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenameItem(null); }} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameItem(null)}>Cancelar</Button>
            <Button onClick={confirmRename} disabled={!renameValue.trim() || renameValue.trim() === renameItem?.name}>Renombrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-mono text-xs">{imageCurrentPath}</span>
        <span className="flex-1" />
        <span>{folders.length} carpetas</span>
        <span>{images.length} imágenes</span>
        <span>{formatBytes(totalSize)}</span>
      </div>

      {/* Loading */}
      {loading ? (
        <div className={viewMode === 'list' ? 'space-y-2' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'}>
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className={viewMode === 'list' ? 'h-12 rounded-lg' : 'aspect-[2/3] rounded-lg'} />)}
        </div>
      ) : filteredFolders.length === 0 && filteredImages.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No se encontraron imágenes</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Navega a una carpeta con archivos de imagen (JPG, PNG, GIF, WebP...)</p>
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
              <FolderPlus className="h-4 w-4 mr-1" />Configurar carpetas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div ref={containerRef}>
          {/* Folders */}
          {filteredFolders.length > 0 && viewMode !== 'list' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-4">
              {sortedFolders.map((f) => (
                <Card key={f.path} className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden" onClick={() => navigateTo(f.path)}>
                  <div className="aspect-video relative bg-gradient-to-br from-rose-100 to-pink-100 dark:from-rose-950/40 dark:to-pink-950/40 flex flex-col items-center justify-center gap-2 p-3">
                    <Folder className="h-10 w-10 text-rose-500/70" />
                    <div className="text-center">
                      <p className="text-xs font-medium truncate w-full">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.itemCount} imágenes</p>
                    </div>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <FileActionsMenu item={f} onRename={handleRename} onDelete={(fi) => handleDelete(fi.path, fi.name)} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          {filteredFolders.length > 0 && viewMode === 'list' && (
            <div className="space-y-1 mb-4">
              {sortedFolders.map((f) => (
                <div key={f.path} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => navigateTo(f.path)}>
                  <Folder className="h-4 w-4 text-rose-500" />
                  <span className="text-sm flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.itemCount} imágenes</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}

          {/* Images grid */}
          {viewMode === 'grid' && filteredImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedImages.map((img) => (
                <Card key={img.path} className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden" onClick={() => openImage(img)}>
                  <div className="aspect-[2/3] relative bg-muted">
                    <img
                      src={`/api/media/stream?path=${encodeURIComponent(img.path)}`}
                      alt={img.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{img.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(img.size)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Masonry view */}
          {viewMode === 'masonry' && filteredImages.length > 0 && (
            <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 space-y-3">
              {sortedImages.map((img) => (
                <div key={img.path} className="break-inside-avoid group cursor-pointer" onClick={() => openImage(img)}>
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <img
                      src={`/api/media/stream?path=${encodeURIComponent(img.path)}`}
                      alt={img.name}
                      className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Actions menu */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                    </div>
                  </div>
                  <p className="text-xs font-medium truncate mt-1.5 px-1">{img.name}</p>
                </div>
              ))}
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && filteredImages.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {sortedImages.map((img) => (
                    <div key={img.path} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => openImage(img)}>
                      <div className="w-10 h-10 rounded bg-muted overflow-hidden flex-shrink-0">
                        <img src={`/api/media/stream?path=${encodeURIComponent(img.path)}`} alt={img.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{img.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(img.size)}</p>
                      <p className="text-xs text-muted-foreground flex-shrink-0 w-20 text-right">{formatTimeAgo(img.modifiedAt)}</p>
                      <FileActionsMenu item={img} onRename={handleRename} onDelete={(i) => handleDelete(i.path, i.name)} />
                      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => { e.stopPropagation(); openImage(img); }}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Radio Section ──────────────────────────────────────────

// ─── Sortable Preset Station Card (Grid) ──────────────────

function SortablePresetCard({ station, isActive, radioPlaying, isFavorite, onPlay, onToggleFavorite, onHide }: {
  station: typeof RADIO_STATIONS[number];
  isActive: boolean;
  radioPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onHide: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: station.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'z-50 scale-105 shadow-xl' : ''}`}>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 relative ${
          isActive
            ? 'border-2 border-violet-400 bg-violet-50/50 dark:bg-violet-950/10'
            : 'hover:border-violet-200 dark:hover:border-violet-800'
        }`}
        onClick={onPlay}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Icon */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive && radioPlaying ? 'bg-violet-500 text-white' : 'bg-muted'
            }`}>
              {isActive && radioPlaying ? (
                <div className="flex items-end gap-[2px] h-2.5">
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                </div>
              ) : (
                <Headphones className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{station.name}</p>
                {isFavorite && <Heart className="h-3 w-3 text-rose-500 fill-rose-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{station.genre} · {station.country}</p>
            </div>

            {/* Play + 3-dot menu */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onToggleFavorite}>
                    <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
                    {isFavorite ? 'Quitar de Mis Emisoras' : 'Agregar a Mis Emisoras'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onHide} className="text-red-600 focus:text-red-600">
                    <Eye className="h-4 w-4 mr-2" />
                    Ocultar de la lista
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={isActive && radioPlaying ? 'default' : 'outline'}
                size="icon"
                className={`h-7 w-7 flex-shrink-0 ${isActive && radioPlaying ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                onClick={onPlay}
              >
                {isActive && radioPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sortable Custom Station Card (Grid) ──────────────────

function SortableStationCard({ station, isActive, radioPlaying, onPlay, onToggleFavorite, onEdit, onDelete }: {
  station: Record<string, unknown>;
  isActive: boolean;
  radioPlaying: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(station.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? 'z-50 scale-105 shadow-xl' : ''}`}>
      <Card
        className={`group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 relative ${
          isActive
            ? 'border-2 border-violet-400 bg-violet-50/50 dark:bg-violet-950/10'
            : 'hover:border-violet-200 dark:hover:border-violet-800'
        }`}
        onClick={onPlay}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground mt-0.5 flex-shrink-0 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Icon */}
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isActive && radioPlaying ? 'bg-violet-500 text-white' : 'bg-muted'
            }`}>
              {isActive && radioPlaying ? (
                <div className="flex items-end gap-[2px] h-2.5">
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                  <div className="w-[2px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                </div>
              ) : (
                <Radio className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{String(station.name)}</p>
                {station.isFavorite && <Heart className="h-3 w-3 text-rose-500 fill-rose-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {station.genre ? `${String(station.genre)} · ` : ''}{station.country || ''}
              </p>
            </div>

            {/* Play + 3-dot menu */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={onToggleFavorite}>
                    <Heart className={`h-4 w-4 mr-2 ${station.isFavorite ? 'text-rose-500 fill-rose-500' : ''}`} />
                    {station.isFavorite ? 'Quitar de favoritas' : 'Marcar favorita'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant={isActive && radioPlaying ? 'default' : 'outline'}
                size="icon"
                className={`h-7 w-7 flex-shrink-0 ${isActive && radioPlaying ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                onClick={onPlay}
              >
                {isActive && radioPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Radio Section ─────────────────────────────────────────

// localStorage helpers for preset stations (order + hidden only; favorites use DB)
function getPresetOrder(): string[] | null {
  try { const o = JSON.parse(localStorage.getItem('radioPresetOrder') || ''); return Array.isArray(o) ? o : null; } catch { return null; }
}
function setPresetOrder(order: string[]) {
  localStorage.setItem('radioPresetOrder', JSON.stringify(order));
}
function getPresetHidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('radioPresetHidden') || '[]')); } catch { return new Set(); }
}
function setPresetHidden(hidden: Set<string>) {
  localStorage.setItem('radioPresetHidden', JSON.stringify([...hidden]));
}

function RadioSection() {
  const radioAudioRef = useRef<HTMLAudioElement>(null);
  const [radioFilter, setRadioFilter] = useState('all');
  const { radioStation, setRadioStation, radioPlaying, setRadioPlaying, radioVolume, setRadioVolume } = useAppStore();
  const [customStations, setCustomStations] = useState<Array<Record<string, unknown>>>([]);
  const [showAddStation, setShowAddStation] = useState(false);
  const [stName, setStName] = useState('');
  const [stUrl, setStUrl] = useState('');
  const [stGenre, setStGenre] = useState('');
  const [stCountry, setStCountry] = useState('');
  const [stDescription, setStDescription] = useState('');
  const [radioTab, setRadioTab] = useState<'preset' | 'custom'>('preset');
  const [editingStation, setEditingStation] = useState<Record<string, unknown> | null>(null);

  // Preset station preferences
  const [presetHidden, setPresetHidden] = useState<Set<string>>(getPresetHidden);
  const [presetStations, setPresetStations] = useState<typeof RADIO_STATIONS>(() => {
    const order = getPresetOrder();
    if (order) {
      const ordered: typeof RADIO_STATIONS = [];
      const remaining = [...RADIO_STATIONS];
      for (const id of order) {
        const s = remaining.find(st => st.id === id);
        if (s) { ordered.push(s); remaining.splice(remaining.indexOf(s), 1); }
      }
      return [...ordered, ...remaining];
    }
    return [...RADIO_STATIONS];
  });

  // Sync preset hidden to localStorage
  useEffect(() => { setPresetHidden(presetHidden); }, [presetHidden]);

  // Radio audio control
  useEffect(() => {
    const audio = radioAudioRef.current;
    if (!audio || !radioStation) return;
    audio.src = radioStation.url;
    audio.volume = radioVolume;
    if (radioPlaying) audio.play().catch(() => { setRadioPlaying(false); toast.error('Error al conectar con la estación'); });
    else audio.pause();
  }, [radioStation, radioPlaying, radioVolume, setRadioPlaying]);

  useEffect(() => {
    if (!radioAudioRef.current) return;
    radioAudioRef.current.volume = radioVolume;
  }, [radioVolume]);

  // ── Custom Stations (loaded always so preset favorites can be derived) ──
  const loadCustomStations = useCallback(async () => {
    try {
      const res = await fetch('/api/radio/stations');
      if (res.ok) { const data = await res.json(); setCustomStations(data.stations || []); }
    } catch { /* ignore */ }
  }, []);

  // Load custom stations on mount and when switching to custom tab
  useEffect(() => { loadCustomStations(); }, [loadCustomStations]);

  const createStation = async () => {
    if (!stName.trim() || !stUrl.trim()) return;
    try {
      const res = await fetch('/api/radio/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stName, url: stUrl, genre: stGenre || null, country: stCountry || null, description: stDescription || null }),
      });
      if (res.ok) { toast.success('Emisora agregada'); setShowAddStation(false); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); loadCustomStations(); }
    } catch { toast.error('Error al guardar'); }
  };

  const deleteStation = async (id: string) => {
    if (!confirm('¿Eliminar esta emisora?')) return;
    try {
      const res = await fetch(`/api/radio/stations/${id}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Eliminada'); loadCustomStations(); }
    } catch { toast.error('Error al eliminar'); }
  };

  const openEditStationDialog = (station: Record<string, unknown>) => {
    setEditingStation(station);
    setStName(String(station.name));
    setStUrl(String(station.url));
    setStGenre(String(station.genre || ''));
    setStCountry(String(station.country || ''));
    setStDescription(String(station.description || ''));
    setShowAddStation(true);
  };

  const updateStation = async () => {
    if (!editingStation || !stName.trim() || !stUrl.trim()) return;
    try {
      const res = await fetch(`/api/radio/stations/${editingStation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stName, url: stUrl, genre: stGenre || null, country: stCountry || null, description: stDescription || null }),
      });
      if (res.ok) {
        toast.success('Emisora actualizada');
        setShowAddStation(false); setEditingStation(null);
        setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription('');
        loadCustomStations();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Error al actualizar');
      }
    } catch { toast.error('Error de conexión'); }
  };

  const toggleFavorite = async (station: Record<string, unknown>) => {
    const newFav = !station.isFavorite;
    try {
      const res = await fetch(`/api/radio/stations/${station.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: newFav }),
      });
      if (res.ok) {
        setCustomStations((prev) => prev.map((s) => s.id === station.id ? { ...s, isFavorite: newFav } : s));
        toast.success(newFav ? 'Marcada como favorita' : 'Quitada de favoritas');
      }
    } catch { toast.error('Error al actualizar'); }
  };

  const reorderStation = async (id: string, newOrder: number) => {
    try {
      const res = await fetch(`/api/radio/stations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });
      if (!res.ok) toast.error('Error al reordenar');
    } catch { /* ignore */ }
  };

  // ── Preset Station Actions ──
  // Derive which presets are favorited (exist in Mis Emisoras) by matching URL
  const customStationUrls = new Set(customStations.map((s) => String(s.url)));
  const isPresetFavorited = (station: typeof RADIO_STATIONS[number]) => customStationUrls.has(station.url);

  // Find custom station ID that matches a preset station by URL
  const findCustomMatch = (station: typeof RADIO_STATIONS[number]) =>
    customStations.find((s) => String(s.url) === station.url);

  const togglePresetFavorite = async (station: typeof RADIO_STATIONS[number]) => {
 const existing = findCustomMatch(station);
    if (existing) {
      // Already in Mis Emisoras → remove it
      try {
        const res = await fetch(`/api/radio/stations/${existing.id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success(`"${station.name}" quitada de Mis Emisoras`);
          loadCustomStations();
        }
      } catch { toast.error('Error al eliminar'); }
    } else {
      // Not in Mis Emisoras → add it as favorite
      try {
        const res = await fetch('/api/radio/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: station.name, url: station.url, genre: station.genre || null, country: station.country || null, isFavorite: true }),
        });
        if (res.ok) {
          toast.success(`"${station.name}" agregada a Mis Emisoras`);
          loadCustomStations();
        }
      } catch { toast.error('Error al agregar'); }
    }
  };

  const hidePresetStation = (stationId: string) => {
    setPresetHidden((prev) => {
      const next = new Set(prev);
      next.add(stationId);
      return next;
    });
    toast.success('Emisora oculta de la lista');
  };

  // ── DnD Sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handlePresetDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPresetStations((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      setPresetOrder(moved.map((s) => s.id));
      return moved;
    });
  };

  const handleCustomDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setCustomStations((prev) => {
      const oldIndex = prev.findIndex((s) => String(s.id) === active.id);
      const newIndex = prev.findIndex((s) => String(s.id) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(prev, oldIndex, newIndex);
      moved.forEach((s, i) => { reorderStation(String(s.id), i); });
      return moved;
    });
  };

  const toggleRadioStation = (station: { id: string; name: string; genre: string; url: string; country: string }) => {
    if (radioStation?.id === station.id) {
      setRadioPlaying(!radioPlaying);
    } else {
      setRadioStation(station);
      setRadioPlaying(true);
    }
  };

  const radioGenres = ['all', ...Array.from(new Set(RADIO_STATIONS.map(s => s.genre)))];
  const visiblePresetStations = presetStations.filter((s) => !presetHidden.has(s.id));
  const filteredStations = radioFilter === 'all' ? visiblePresetStations : visiblePresetStations.filter(s => s.genre === radioFilter);

  return (
    <div className="space-y-4">
      <audio ref={radioAudioRef} preload="none" />

      {/* Tab Switcher */}
      <div className="flex gap-2">
        <Button variant={radioTab === 'preset' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setRadioTab('preset')}>
          <Radio className="h-3.5 w-3.5 mr-1" />Emisoras Predefinidas
        </Button>
        <Button variant={radioTab === 'custom' ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => setRadioTab('custom')}>
          <Plus className="h-3.5 w-3.5 mr-1" />Mis Emisoras
        </Button>
      </div>

      {/* Now Playing Bar */}
      {radioStation && (
        <Card className={`border-2 transition-all ${radioPlaying ? 'border-violet-400 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20' : 'border-border'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${radioPlaying ? 'bg-violet-500 text-white animate-pulse' : 'bg-muted'}`}>
                <Radio className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{radioStation.name}</p>
                <p className="text-sm text-muted-foreground">{radioStation.genre} · {radioStation.country}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRadioVolume(radioVolume === 0 ? 0.8 : 0)}>
                  {radioVolume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
                <input type="range" min="0" max="1" step="0.05" value={radioVolume} onChange={(e) => setRadioVolume(parseFloat(e.target.value))} className="w-16 accent-violet-500 sm:w-20" />
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => setRadioPlaying(!radioPlaying)}
                >
                  {radioPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {radioTab === 'preset' && (<>
      {/* Genre Filter */}
      <div className="flex flex-wrap gap-2">
        {radioGenres.map((genre) => (
          <Button
            key={genre}
            variant={radioFilter === genre ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setRadioFilter(genre)}
          >
            {genre === 'all' ? 'Todos' : genre}
          </Button>
        ))}
        {presetHidden.size > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setPresetHidden(new Set()); toast.success('Emisoras ocultas restauradas'); }}
          >
            <Eye className="h-3 w-3 mr-1" />Mostrar ocultas ({presetHidden.size})
          </Button>
        )}
      </div>

      {/* Preset Station Grid with DnD */}
      {filteredStations.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="font-medium mb-1">No hay emisoras</p>
            <p className="text-sm text-muted-foreground">
              {radioFilter !== 'all' ? `No hay emisoras del género "${radioFilter}"` : 'Todas las emisoras están ocultas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePresetDragEnd}>
          <SortableContext items={filteredStations.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStations.map((station) => {
                const isActive = radioStation?.id === station.id;
                return (
                  <SortablePresetCard
                    key={station.id}
                    station={station}
                    isActive={isActive}
                    radioPlaying={radioPlaying}
                    isFavorite={isPresetFavorited(station)}
                    onPlay={() => toggleRadioStation(station)}
                    onToggleFavorite={() => togglePresetFavorite(station)}
                    onHide={() => hidePresetStation(station.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </>)}

      {radioTab === 'custom' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{customStations.length} emisora{customStations.length !== 1 ? 's' : ''} personalizada{customStations.length !== 1 ? 's' : ''}</p>
            <Button size="sm" onClick={() => setShowAddStation(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />Agregar Emisora
            </Button>
          </div>
          {customStations.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Radio className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="font-medium mb-1">Sin emisoras personalizadas</p>
                <p className="text-sm text-muted-foreground">Agrega tus emisoras de radio favoritas con su URL de streaming</p>
              </CardContent>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCustomDragEnd}>
              <SortableContext items={customStations.map((s) => String(s.id))} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customStations.map((station) => {
                    const isActive = radioStation?.id === station.id;
                    const stationData = { id: String(station.id), name: String(station.name), genre: String(station.genre || ''), url: String(station.url), country: String(station.country || '') };
                    return (
                      <SortableStationCard
                        key={String(station.id)}
                        station={station}
                        isActive={isActive}
                        radioPlaying={radioPlaying}
                        onPlay={() => {
                          if (isActive) setRadioPlaying(!radioPlaying);
                          else { setRadioStation(stationData); setRadioPlaying(true); }
                        }}
                        onToggleFavorite={() => toggleFavorite(station)}
                        onEdit={() => openEditStationDialog(station)}
                        onDelete={() => deleteStation(String(station.id))}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {/* Add/Edit Station Dialog */}
      <Dialog open={showAddStation} onOpenChange={(open) => { setShowAddStation(open); if (!open) { setEditingStation(null); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStation ? 'Editar Emisora' : 'Agregar Emisora'}</DialogTitle>
            <DialogDescription>{editingStation ? 'Modifica los detalles de la emisora' : 'Agrega una emisora de radio con su URL de streaming'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre *</Label>
              <Input value={stName} onChange={(e) => setStName(e.target.value)} placeholder="Nombre de la emisora" />
            </div>
            <div>
              <Label>URL de Streaming *</Label>
              <Input value={stUrl} onChange={(e) => setStUrl(e.target.value)} placeholder="https://stream.example.com/radio.mp3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Género</Label>
                <Input value={stGenre} onChange={(e) => setStGenre(e.target.value)} placeholder="Jazz, Rock..." />
              </div>
              <div>
                <Label>País</Label>
                <Input value={stCountry} onChange={(e) => setStCountry(e.target.value)} placeholder="Cuba, USA..." />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={stDescription} onChange={(e) => setStDescription(e.target.value)} placeholder="Descripción opcional..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddStation(false); setEditingStation(null); setStName(''); setStUrl(''); setStGenre(''); setStCountry(''); setStDescription(''); }}>Cancelar</Button>
            {editingStation ? (
              <Button onClick={updateStation} disabled={!stName.trim() || !stUrl.trim()}>Actualizar</Button>
            ) : (
              <Button onClick={createStation} disabled={!stName.trim() || !stUrl.trim()}>Agregar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sleep Timer ─────────────────────────────────────────────

const SLEEP_PRESETS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hora', minutes: 60 },
  { label: '1.5 horas', minutes: 90 },
  { label: '2 horas', minutes: 120 },
];

function SleepTimer() {
  const { stopAllMedia, isPlaying, radioPlaying, currentMovie } = useAppStore();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAnyMediaActive = isPlaying || radioPlaying || !!currentMovie;

  // Countdown logic
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          // Timer finished — stop everything
          stopAllMedia();
          toast.success('Temporizador de sueño: se detuvo la reproducción');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [secondsLeft, stopAllMedia]);

  const setTimer = (minutes: number) => {
    setSecondsLeft(minutes * 60);
    setOpen(false);
    setCustomMinutes('');
    toast.info(`Temporizador: ${minutes} min`);
  };

  const setCustomTimer = () => {
    const mins = parseInt(customMinutes);
    if (mins > 0 && mins <= 480) {
      setTimer(mins);
    }
  };

  const cancelTimer = () => {
    setSecondsLeft(null);
    if (intervalRef.current) clearInterval(intervalRef.current);
    toast.info('Temporizador cancelado');
  };

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPercent = secondsLeft !== null
    ? (() => {
        // We don't track the original total, so just use a pulsing effect
        const cycle = 60;
        return ((secondsLeft % cycle) / cycle) * 100;
      })()
    : 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={secondsLeft !== null ? 'default' : 'ghost'}
          size="sm"
          className={`h-8 gap-1.5 ${secondsLeft !== null ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {secondsLeft !== null ? (
            <>
              <Timer className="h-3.5 w-3.5" />
              <span className="text-xs font-mono">{formatCountdown(secondsLeft)}</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Dormir</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Temporizador de sueño</p>
          </div>

          {secondsLeft !== null ? (
            /* Active timer display */
            <div className="space-y-3">
              <div className="text-center py-2">
                <p className="text-3xl font-mono font-bold text-amber-600 dark:text-amber-400">
                  {formatCountdown(secondsLeft)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">restante</p>
              </div>
              {!isAnyMediaActive && (
                <p className="text-xs text-center text-muted-foreground">
                  No hay reproducción activa. Se detendrá cuando empiece algo.
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full gap-2 text-red-500 hover:text-red-600" onClick={cancelTimer}>
                <TimerOff className="h-3.5 w-3.5" />
                Cancelar temporizador
              </Button>
            </div>
          ) : (
            /* Preset selection */
            <div className="space-y-2">
              {!isAnyMediaActive && (
                <p className="text-xs text-muted-foreground">
                  Inicia la reproducción primero. El temporizador la detendrá automáticamente.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {SLEEP_PRESETS.map((preset) => (
                  <Button
                    key={preset.minutes}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setTimer(preset.minutes)}
                    disabled={!isAnyMediaActive}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="480"
                  placeholder="Minutos"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setCustomTimer()}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={setCustomTimer}
                  disabled={!isAnyMediaActive || !customMinutes || parseInt(customMinutes) <= 0}
                >
                  OK
                </Button>
              </div>
              {customMinutes && parseInt(customMinutes) > 480 && (
                <p className="text-xs text-amber-500">Máximo 480 minutos (8 horas)</p>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main App ────────────────────────────────────────────────

function AppContent() {
  const { currentSection, sidebarOpen, setSidebarOpen, sidebarCollapsed } = useAppStore();

  const sectionTitles: Record<Section, string> = {
    dashboard: 'Dashboard',
    disks: 'Discos',
    music: 'Música',
    radio: 'Radio',
    movies: 'Películas',
    tvshows: 'TV Shows',
    printers: 'Impresora',
    library: 'Biblioteca',
    images: 'Imágenes',
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Sidebar />

      {/* Main content - no margin on mobile, sidebar offset on md+ */}
      <div className={`flex-1 ml-0 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[68px]' : 'md:ml-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-3 py-2.5 md:px-4 md:py-3">
          <div className="flex items-center gap-3">
            {/* Hamburger menu - mobile only */}
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h2 className="text-base font-semibold md:text-lg flex-1">{sectionTitles[currentSection]}</h2>
            <SleepTimer />
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 md:p-6 max-w-7xl mx-auto w-full">
          {currentSection === 'dashboard' && <DashboardSection />}
          {currentSection === 'disks' && <DiskExplorerSection />}
          {currentSection === 'library' && <LibrarySection />}
          {currentSection === 'music' && <MusicSection />}
          {currentSection === 'radio' && <RadioSection />}
          {currentSection === 'movies' && <MoviesSection />}
          {currentSection === 'tvshows' && <TvShowsSection />}
          {currentSection === 'images' && <ImagesSection />}
          {currentSection === 'printers' && <PrinterSection />}
        </main>
      </div>
    </div>
  );
}

export default function HomePage() {
  return <AppContent />;
}