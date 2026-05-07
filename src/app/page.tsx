'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Monitor, Server as ServerIcon, Shield, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Shuffle, Maximize, Minimize,
  Disc3, FilmIcon, Music2, Radio, Headphones, Newspaper, Calendar, Globe,
  Moon, Timer, TimerOff,
} from 'lucide-react';

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
      await fetch('/api/printers/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      toast.success('Trabajo cancelado');
      loadData();
    } catch {
      toast.error('Error al cancelar');
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
          <CardTitle className="text-lg flex items-center gap-2">
            <ClockIcon className="h-5 w-5 text-amber-600" />
            Cola de Impresión
          </CardTitle>
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
                  {job.status === 'pending' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => handleDeleteJob(job.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
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
  extraItems 
}: { 
  item: { path: string; name: string }; 
  onRename: (item: { path: string; name: string }) => void;
  onDelete: (item: { path: string; name: string }) => void;
  children?: React.ReactNode;
  extraItems?: React.ReactNode;
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
        <DropdownMenuItem onClick={() => onRename(item)}>
          <Edit className="h-4 w-4 mr-2" />
          Renombrar
        </DropdownMenuItem>
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
  const [downloading, setDownloading] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [playingAudiobook, setPlayingAudiobook] = useState<{ name: string; path: string; extension: string } | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

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

  const filteredFolders = searchQuery ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase())) : folders;
  const filteredBooks = searchQuery ? books.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase())) : books;
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
            <Button key={p} variant={libraryCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs" onClick={() => { setLibraryPathHistory([p]); setLibraryCurrentPath(p); }}>
              <HardDrive className="h-3.5 w-3.5 mr-1" />{p.split('/').pop()}
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
            <DialogDescription>Configura las carpetas donde buscar libros</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {libraryLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono">{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateLibraryPaths(libraryLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="/mnt/MisLibros" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1" />
              <Button onClick={() => { if (newPath.trim()) { updateLibraryPaths([...libraryLibraryPaths, newPath.trim()]); setNewPath(''); } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos y se mantienen al reiniciar.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button></DialogFooter>
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
                      <div className="aspect-square relative bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/40 dark:to-orange-950/40">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="w-full h-full object-cover"
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
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [coverFolder, setCoverFolder] = useState('');
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [sortAsc, setSortAsc] = useState(true);

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
  const sortedFolders = sortAsc
    ? [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name));
  const sortedTracks = sortAsc
    ? [...filteredTracks].sort((a, b) => a.name.localeCompare(b.name))
    : [...filteredTracks].sort((a, b) => b.name.localeCompare(a.name));
  const totalSize = tracks.reduce((s, t) => s + t.size, 0);
  const totalSongs = folders.reduce((s, f) => s + f.itemCount, 0) + tracks.length;

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
            <Button key={p} variant={musicCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs" onClick={() => { setMusicPathHistory([p]); setMusicCurrentPath(p); }}>
              <Disc3 className="h-3.5 w-3.5 mr-1" />{p.split('/').pop()}
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
            <DialogDescription>Configura las carpetas donde buscas música</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {musicLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2">
                  <Disc3 className="h-4 w-4 text-violet-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono">{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMusicPaths(musicLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="/mnt/MiMusica" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1" />
              <Button onClick={() => { if (newPath.trim()) { updateMusicPaths([...musicLibraryPaths, newPath.trim()]); setNewPath(''); } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se usan como acceso rápido en la barra de navegación arriba.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button></DialogFooter>
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
                      <div className="aspect-square relative bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-950/40 dark:to-purple-950/40">
                        {hasCover ? (
                          <img
                            src={`/api/music/cover?path=${encodeURIComponent(folder.path)}`}
                            alt={folder.name}
                            className="w-full h-full object-cover"
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
  const [renameItem, setRenameItem] = useState<{ path: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/media/stream?path=${encodeURIComponent(movieCurrentPath)}&type=video`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
        setMovies((data.files || []).map((f: Record<string, unknown>) => ({ ...f, type: 'video' as const })));
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
              src={`/api/media/stream?path=${encodeURIComponent(currentMovie.path)}`}
            />
          )}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Carpetas de Películas</DialogTitle>
            <DialogDescription>Configura las carpetas donde buscas películas</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {movieLibraryPaths.map((p, i) => (
                <div key={p} className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono">{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateMoviePaths(movieLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="/mnt/MisPeliculas" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1" />
              <Button onClick={() => { if (newPath.trim()) { updateMoviePaths([...movieLibraryPaths, newPath.trim()]); setNewPath(''); } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Las carpetas se guardan en la base de datos y se mantienen al reiniciar.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button></DialogFooter>
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
            <Button key={p} variant={movieCurrentPath === p ? 'secondary' : 'ghost'} size="sm" className="h-8 flex-shrink-0 text-xs" onClick={() => { setMoviePathHistory([p]); setMovieCurrentPath(p); }}>
              <Film className="h-3.5 w-3.5 mr-1" />{p.split('/').pop()}
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
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">Carpetas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {sortedFolders.map((folder) => {
                  const subCount = (folder as unknown as { subFolderCount?: number }).subFolderCount || 0;
                  return (
                  <Card key={folder.path} className="group cursor-pointer hover:border-rose-300 dark:hover:border-rose-700 transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => navigateTo(folder.path)}>
                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                      <div className="relative">
                        <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/30"><Folder className="h-6 w-6 text-rose-600 dark:text-rose-400" /></div>
                        {folder.itemCount > 0 ? (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-rose-500/70 text-white h-4 w-4 flex items-center justify-center p-0"><Play className="h-2 w-2" /></Badge>
                        ) : subCount > 0 ? (
                          <Badge variant="secondary" className="absolute -top-1 -right-1 text-[9px] bg-amber-500/70 text-white h-4 min-w-4 flex items-center justify-center p-0">{subCount}</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs font-medium truncate w-full">{folder.name}</p>
                      <p className="text-[10px] text-muted-foreground">{folder.itemCount > 0 ? `${folder.itemCount} video${folder.itemCount !== 1 ? 's' : ''}` : subCount > 0 ? `${subCount} subcarpeta${subCount !== 1 ? 's' : ''}` : 'Vacío'}</p>
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
              <Button variant="ghost" size="sm" className="h-8" onClick={() => {
                setImagePathHistory(imagePathHistory.slice(0, i + 2));
                setImageCurrentPath(p);
              }}>
                {p.split('/').pop()}
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
            <DialogDescription>Configura las carpetas donde buscas imágenes</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              {imageLibraryPaths.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span className="text-sm flex-1 font-mono">{p}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updatePaths(imageLibraryPaths.filter((_, idx) => idx !== i))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input placeholder="/mnt/MisFotos" value={newPath} onChange={(e) => setNewPath(e.target.value)} className="flex-1" />
              <Button onClick={() => { if (newPath.trim()) { updatePaths([...imageLibraryPaths, newPath.trim()]); setNewPath(''); } }} disabled={!newPath.trim()}>
                <Plus className="h-4 w-4 mr-1" />Agregar
              </Button>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowSettings(false)}>Cerrar</Button></DialogFooter>
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
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className={viewMode === 'list' ? 'h-12 rounded-lg' : 'aspect-square rounded-lg'} />)}
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
                  <div className="aspect-square relative bg-muted">
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

function RadioSection() {
  const radioAudioRef = useRef<HTMLAudioElement>(null);
  const [radioFilter, setRadioFilter] = useState('all');
  const { radioStation, setRadioStation, radioPlaying, setRadioPlaying, radioVolume, setRadioVolume } = useAppStore();

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

  const toggleRadioStation = (station: typeof RADIO_STATIONS[0]) => {
    if (radioStation?.id === station.id) {
      setRadioPlaying(!radioPlaying);
    } else {
      setRadioStation(station);
      setRadioPlaying(true);
    }
  };

  const radioGenres = ['all', ...Array.from(new Set(RADIO_STATIONS.map(s => s.genre)))];
  const filteredStations = radioFilter === 'all' ? RADIO_STATIONS : RADIO_STATIONS.filter(s => s.genre === radioFilter);

  return (
    <div className="space-y-4">
      <audio ref={radioAudioRef} preload="none" />

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
      </div>

      {/* Station Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredStations.map((station) => {
          const isActive = radioStation?.id === station.id;
          return (
            <Card
              key={station.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                isActive ? 'border-2 border-violet-400 bg-violet-50/50 dark:bg-violet-950/10' : 'hover:border-violet-200 dark:hover:border-violet-800'
              }`}
              onClick={() => toggleRadioStation(station)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive && radioPlaying
                      ? 'bg-violet-500 text-white'
                      : 'bg-muted'
                  }`}>
                    {isActive && radioPlaying ? (
                      <div className="flex items-end gap-[2px] h-3">
                        <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '60%' }} />
                        <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '100%', animationDelay: '0.15s' }} />
                        <div className="w-[3px] bg-white rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0.3s' }} />
                      </div>
                    ) : (
                      <Headphones className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{station.name}</p>
                    <p className="text-xs text-muted-foreground">{station.genre} · {station.country}</p>
                  </div>
                  <Button
                    variant={isActive && radioPlaying ? 'default' : 'outline'}
                    size="icon"
                    className={`h-8 w-8 flex-shrink-0 ${isActive && radioPlaying ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
                  >
                    {isActive && radioPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
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