import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3Icon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  EyeIcon,
  FlameIcon,
  GlobeIcon,
  HeadphonesIcon,
  LaptopIcon,
  Loader2Icon,
  MusicIcon,
  RefreshCwIcon,
  SearchIcon,
  SmartphoneIcon,
  TabletIcon,
  TrendingUpIcon,
  UsersIcon
} from "lucide-react";
import { toast } from "sonner";
import { AnalyticsData, RecentDownloadEntry, TopTrackByPlay } from "../../types/store";
import { api, errorMessage } from "../../utils/api";

export function AnalyticsManager() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadSearch, setDownloadSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "downloads" | "plays">("overview");

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getAnalytics();
      setData(res);
      if (isManual) {
        toast.success("Đã cập nhật số liệu thống kê mới nhất!");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Không thể tải dữ liệu thống kê."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lọc danh sách tải nhạc free theo từ khoá tìm kiếm
  const filteredDownloads = useMemo(() => {
    if (!data?.recentDownloads) return [];
    const q = downloadSearch.toLowerCase().trim();
    if (!q) return data.recentDownloads;
    return data.recentDownloads.filter(
      (d) =>
        d.trackTitle.toLowerCase().includes(q) ||
        d.ip.toLowerCase().includes(q) ||
        d.browser.toLowerCase().includes(q) ||
        d.device.toLowerCase().includes(q)
    );
  }, [data?.recentDownloads, downloadSearch]);

  const maxDailyViews = useMemo(() => {
    if (!data?.dailyTrend || data.dailyTrend.length === 0) return 10;
    return Math.max(10, ...data.dailyTrend.map((d) => Math.max(d.views, d.plays, d.downloads)));
  }, [data?.dailyTrend]);

  const deviceTotal = useMemo(() => {
    if (!data?.devices) return 1;
    const { mobile = 0, desktop = 0, tablet = 0 } = data.devices;
    return Math.max(1, mobile + desktop + tablet);
  }, [data?.devices]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-white/60">
        <Loader2Icon className="h-8 w-8 animate-spin text-ember" />
        <span className="mt-3 text-sm">Đang tải số liệu thống kê truy cập & nghe nhạc…</span>
      </div>
    );
  }

  const {
    totalViews = 0,
    todayViews = 0,
    totalUniqueVisitors = 0,
    todayUniqueVisitors = 0,
    totalPlays = 0,
    todayPlays = 0,
    totalDownloads = 0,
    todayDownloads = 0,
    topTracksByPlay = [],
    topTracksByDownload = [],
    recentDownloads = [],
    recentPlays = [],
    dailyTrend = [],
    devices = { mobile: 0, desktop: 0, tablet: 0 }
  } = data || {};

  return (
    <div className="space-y-8">
      {/* Header controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Thống kê truy cập & Nghe nhạc
            </h2>
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              ● Trực tiếp
            </span>
          </div>
          <p className="mt-1 text-sm text-white/60">
            Theo dõi lượng người truy cập, người nghe nhạc và khách tải nhạc miễn phí theo thời gian thực.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 disabled:opacity-50">
            <RefreshCwIcon className={`h-4 w-4 ${refreshing ? "animate-spin text-ember" : ""}`} />
            <span>{refreshing ? "Đang đồng bộ…" : "Làm mới"}</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ chỉ số tổng quan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Lượt xem trang */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Lượt xem trang</span>
            <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 ring-1 ring-cyan-500/20">
              <EyeIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
              {totalViews.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-white/40">lượt</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-cyan-400">
            <TrendingUpIcon className="mr-1 h-3.5 w-3.5" />
            <span className="font-semibold">+{todayViews.toLocaleString("vi-VN")}</span>
            <span className="ml-1 text-white/40">hôm nay</span>
          </div>
        </div>

        {/* Khách truy cập độc lập */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Khách truy cập</span>
            <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 ring-1 ring-indigo-500/20">
              <UsersIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
              {totalUniqueVisitors.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-white/40">khách</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-indigo-400">
            <TrendingUpIcon className="mr-1 h-3.5 w-3.5" />
            <span className="font-semibold">+{todayUniqueVisitors.toLocaleString("vi-VN")}</span>
            <span className="ml-1 text-white/40">hôm nay</span>
          </div>
        </div>

        {/* Lượt nghe nhạc */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Lượt nghe nhạc</span>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 ring-1 ring-amber-500/20">
              <HeadphonesIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
              {totalPlays.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-white/40">lượt nghe</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-amber-400">
            <FlameIcon className="mr-1 h-3.5 w-3.5" />
            <span className="font-semibold">+{todayPlays.toLocaleString("vi-VN")}</span>
            <span className="ml-1 text-white/40">hôm nay</span>
          </div>
        </div>

        {/* Lượt tải nhạc Free */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Tải nhạc Free</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400 ring-1 ring-emerald-500/20">
              <DownloadIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-white tabular-nums">
              {totalDownloads.toLocaleString("vi-VN")}
            </span>
            <span className="text-xs text-white/40">lượt tải</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-400">
            <CheckCircle2Icon className="mr-1 h-3.5 w-3.5" />
            <span className="font-semibold">+{todayDownloads.toLocaleString("vi-VN")}</span>
            <span className="ml-1 text-white/40">hôm nay</span>
          </div>
        </div>
      </div>

      {/* Biểu đồ xu hướng 14 ngày & Thiết bị */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cột 1 & 2: Biểu đồ hoạt động theo ngày */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                <BarChart3Icon className="h-4 w-4 text-cyan-400" />
                Hoạt động 14 ngày gần nhất
              </h3>
              <p className="mt-0.5 text-xs text-white/50">So sánh lượt xem trang, lượt nghe nhạc và tải free</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                <span className="text-white/70">Xem trang</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="text-white/70">Nghe nhạc</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="text-white/70">Tải Free</span>
              </div>
            </div>
          </div>

          {/* Chart Bars */}
          <div className="mt-6 flex h-48 items-end gap-2 border-b border-white/10 pb-2 pt-4">
            {dailyTrend.map((day, idx) => {
              const viewsHeight = Math.max(4, Math.round((day.views / maxDailyViews) * 160));
              const playsHeight = Math.max(4, Math.round((day.plays / maxDailyViews) * 160));
              const dlsHeight = Math.max(4, Math.round((day.downloads / maxDailyViews) * 160));
              const dateLabel = day.date.slice(5).replace("-", "/");

              return (
                <div
                  key={day.date || idx}
                  className="group relative flex flex-1 flex-col items-center justify-end h-full">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-16 z-20 hidden -translate-x-1/2 flex-col items-center rounded-lg bg-[#18181b] p-2 text-[11px] text-white shadow-xl ring-1 ring-white/20 group-hover:flex">
                    <span className="font-semibold text-white/70">{day.date}</span>
                    <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
                      <span className="text-cyan-400">Xem: {day.views}</span>
                      <span className="text-amber-400">Nghe: {day.plays}</span>
                      <span className="text-emerald-400">Tải: {day.downloads}</span>
                    </div>
                  </div>

                  {/* 3 bars side by side */}
                  <div className="flex w-full items-end justify-center gap-0.5">
                    <div
                      style={{ height: `${viewsHeight}px` }}
                      className="w-1.5 rounded-t-sm bg-cyan-400/80 transition-all group-hover:bg-cyan-300"
                    />
                    <div
                      style={{ height: `${playsHeight}px` }}
                      className="w-1.5 rounded-t-sm bg-amber-400/80 transition-all group-hover:bg-amber-300"
                    />
                    <div
                      style={{ height: `${dlsHeight}px` }}
                      className="w-1.5 rounded-t-sm bg-emerald-400/80 transition-all group-hover:bg-emerald-300"
                    />
                  </div>
                  <span className="mt-2 text-[10px] text-white/40 tabular-nums">{dateLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cột 3: Tỷ lệ thiết bị truy cập */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <GlobeIcon className="h-4 w-4 text-indigo-400" />
              Thiết bị truy cập
            </h3>
            <p className="mt-0.5 text-xs text-white/50">Phân bổ nguồn thiết bị của người dùng</p>

            <div className="mt-6 space-y-4">
              {/* Mobile */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <SmartphoneIcon className="h-3.5 w-3.5 text-emerald-400" />
                    Điện thoại (Mobile)
                  </span>
                  <span className="font-semibold text-white tabular-nums">
                    {Math.round(((devices.mobile || 0) / deviceTotal) * 100)}% ({devices.mobile || 0})
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    style={{ width: `${Math.round(((devices.mobile || 0) / deviceTotal) * 100)}%` }}
                    className="h-full rounded-full bg-emerald-400"
                  />
                </div>
              </div>

              {/* Desktop */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <LaptopIcon className="h-3.5 w-3.5 text-cyan-400" />
                    Máy tính (Desktop)
                  </span>
                  <span className="font-semibold text-white tabular-nums">
                    {Math.round(((devices.desktop || 0) / deviceTotal) * 100)}% ({devices.desktop || 0})
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    style={{ width: `${Math.round(((devices.desktop || 0) / deviceTotal) * 100)}%` }}
                    className="h-full rounded-full bg-cyan-400"
                  />
                </div>
              </div>

              {/* Tablet */}
              <div>
                <div className="flex justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-white/70">
                    <TabletIcon className="h-3.5 w-3.5 text-indigo-400" />
                    Máy tính bảng (Tablet)
                  </span>
                  <span className="font-semibold text-white tabular-nums">
                    {Math.round(((devices.tablet || 0) / deviceTotal) * 100)}% ({devices.tablet || 0})
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    style={{ width: `${Math.round(((devices.tablet || 0) / deviceTotal) * 100)}%` }}
                    className="h-full rounded-full bg-indigo-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-white/50">
            💡 Tối ưu hoá giao diện trên điện thoại di động giúp tăng tới 65% tỷ lệ nghe thử và thanh toán mua nhạc.
          </div>
        </div>
      </div>

      {/* Tabs chuyển đổi các bảng chi tiết */}
      <div className="border-b border-white/10">
        <nav className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-amber-400 text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}>
            🔥 Bài hát nghe nhiều nhất ({topTracksByPlay.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("downloads")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "downloads"
                ? "border-emerald-400 text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}>
            📥 Người tải nhạc Free ({recentDownloads.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("plays")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === "plays"
                ? "border-cyan-400 text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}>
            🎵 Lượt nghe gần đây ({recentPlays.length})
          </button>
        </nav>
      </div>

      {/* TAB 1: BẢNG XẾP HẠNG BÀI HÁT NGHE NHIỀU NHẤT */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="text-base font-semibold text-white">
                Bảng xếp hạng lượt nghe bài hát (Top Tracks)
              </h3>
              <p className="mt-0.5 text-xs text-white/50">
                Xếp hạng các bài hát được người dùng bấm nghe thử nhiều nhất trên website
              </p>
            </div>

            {topTracksByPlay.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/40">
                Chưa có dữ liệu lượt nghe. Khi khách truy cập và nghe bài hát, thống kê sẽ hiển thị ngay tại đây.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {topTracksByPlay.map((t, idx) => {
                  const rankBadge =
                    idx === 0
                      ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 font-bold"
                      : idx === 1
                        ? "bg-slate-300/20 text-slate-200 ring-1 ring-slate-300/40 font-bold"
                        : idx === 2
                          ? "bg-amber-600/20 text-amber-400 ring-1 ring-amber-600/40 font-bold"
                          : "bg-white/5 text-white/60";

                  return (
                    <div
                      key={t.id || idx}
                      className="flex flex-col gap-3 p-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="flex items-center gap-4">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs tabular-nums ${rankBadge}`}>
                          #{idx + 1}
                        </span>

                        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {t.cover ? (
                            <img src={t.cover} alt={t.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-white/40">
                              <MusicIcon className="h-5 w-5" />
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white">{t.title}</h4>
                          <p className="text-xs text-white/50">{t.artist || "Nghao Producer"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 sm:w-64 sm:justify-end">
                        <div className="flex-1 text-right">
                          <span className="text-base font-bold text-white tabular-nums">
                            {t.playCount.toLocaleString("vi-VN")}
                          </span>
                          <span className="ml-1 text-xs text-white/40">lượt nghe</span>

                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              style={{ width: `${Math.max(5, t.percentage)}%` }}
                              className="h-full rounded-full bg-amber-400"
                            />
                          </div>
                        </div>

                        <span className="w-12 text-right text-xs font-semibold text-amber-400 tabular-nums">
                          {t.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top bài tải free */}
          {topTracksByDownload.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="text-base font-semibold text-white">Top bài hát tải miễn phí nhiều nhất</h3>
                <p className="mt-0.5 text-xs text-white/50">Các bài nhạc free thu hút lượt tải cao nhất</p>
              </div>
              <div className="divide-y divide-white/5">
                {topTracksByDownload.map((t, idx) => (
                  <div key={t.id || idx} className="flex items-center justify-between p-4 px-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-white/40 tabular-nums">#{idx + 1}</span>
                      <span className="text-sm font-medium text-white">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <DownloadIcon className="h-3.5 w-3.5" />
                      <span className="font-bold tabular-nums">{t.downloadCount.toLocaleString("vi-VN")}</span>
                      <span className="text-white/40">lượt</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DANH SÁCH CHI TIẾT NGƯỜI TẢI NHẠC FREE */}
      {activeTab === "downloads" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-md">
              <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={downloadSearch}
                onChange={(e) => setDownloadSearch(e.target.value)}
                placeholder="Tìm theo tên bài hát, thiết bị, IP..."
                className="w-full rounded-full border border-white/10 bg-white/[0.05] py-2 pl-10 pr-4 text-xs text-white placeholder-white/40 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30"
              />
            </div>
            <span className="text-xs text-white/50 tabular-nums">
              Hiển thị {filteredDownloads.length} lượt tải gần nhất
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-white/50 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 font-medium">Bài hát</th>
                  <th className="px-6 py-3 font-medium">Thời gian</th>
                  <th className="px-6 py-3 font-medium">Thiết bị</th>
                  <th className="px-6 py-3 font-medium">Trình duyệt</th>
                  <th className="px-6 py-3 font-medium">IP khách (ẩn danh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {filteredDownloads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/40">
                      {downloadSearch ? "Không tìm thấy lượt tải phù hợp." : "Chưa có lượt tải nhạc miễn phí nào."}
                    </td>
                  </tr>
                ) : (
                  filteredDownloads.map((dl) => {
                    const formattedDate = new Date(dl.downloadedAt).toLocaleString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    });

                    return (
                      <tr key={dl.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-6 py-3.5 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-emerald-500/10 p-1 text-emerald-400">
                              <DownloadIcon className="h-3 w-3" />
                            </span>
                            <span>{dl.trackTitle}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3.5 text-white/60 tabular-nums">
                          <span className="flex items-center gap-1.5">
                            <ClockIcon className="h-3.5 w-3.5 text-white/40" />
                            {formattedDate}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-white/80">
                            {dl.device === "Mobile" ? (
                              <SmartphoneIcon className="h-3 w-3 text-emerald-400" />
                            ) : dl.device === "Tablet" ? (
                              <TabletIcon className="h-3 w-3 text-indigo-400" />
                            ) : (
                              <LaptopIcon className="h-3 w-3 text-cyan-400" />
                            )}
                            {dl.device}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-white/70">{dl.browser}</td>
                        <td className="px-6 py-3.5 font-mono text-white/50">{dl.ip}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LƯỢT NGHE GẦN ĐÂY */}
      {activeTab === "plays" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4">
              <h3 className="text-base font-semibold text-white">Lịch sử lượt nghe gần đây (Live Stream Feed)</h3>
              <p className="mt-0.5 text-xs text-white/50">
                Nhật ký thời gian thực khi khách đang nghe bài hát trên cửa hàng
              </p>
            </div>

            {recentPlays.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/40">
                Chưa có dữ liệu lượt nghe nào gần đây.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentPlays.map((pl) => {
                  const formattedTime = new Date(pl.playedAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    day: "2-digit",
                    month: "2-digit"
                  });

                  return (
                    <div
                      key={pl.id}
                      className="flex items-center justify-between p-4 px-6 transition-colors hover:bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                          <HeadphonesIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="text-sm font-medium text-white">{pl.trackTitle}</h4>
                          <span className="flex items-center gap-1 text-[11px] text-white/40">
                            {pl.device === "Mobile" ? "Điện thoại" : "Máy tính"} · {formattedTime}
                          </span>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                        Vừa nghe
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
