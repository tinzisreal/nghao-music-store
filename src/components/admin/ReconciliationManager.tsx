import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
  CheckIcon,
  ExternalLinkIcon,
  InfoIcon,
  Loader2Icon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
  Undo2Icon
} from "lucide-react";
import { toast } from "sonner";
import { Order, ReconciliationData } from "../../types/store";
import { api, errorMessage } from "../../utils/api";
import { formatPrice } from "../../utils/format";

type FilterStatus = "has_payment" | "exact" | "paid" | "underpaid" | "overpaid" | "pending_verification";

export function ReconciliationManager() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("has_payment");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [testingNotification, setTestingNotification] = useState(false);

  const handleTestNotifications = async () => {
    setTestingNotification(true);
    try {
      const res = await api.testNotifications();
      if (res.ntfy?.sent) {
        toast.success(`📲 Đã bắn chuông tới app ntfy điện thoại (kênh: ${res.ntfy.topic || "nghao-orders-2026"})!`);
      } else if (res.ntfy) {
        toast.error(`Ntfy: ${res.ntfy.reason || "Lỗi gửi thông báo"}`);
      }
      if (res.telegram?.sent) {
        toast.success("✅ Đã gửi thông báo thử nghiệm tới Telegram!");
      }
      if (res.gmail?.sent) {
        toast.success("✅ Đã gửi email thử nghiệm tới Gmail!");
      }
    } catch (err) {
      toast.error(errorMessage(err, "Không thể gửi thông báo thử nghiệm."));
    } finally {
      setTestingNotification(false);
    }
  };

  const loadData = useCallback(async (isManualSync = false) => {
    if (isManualSync) setSyncing(true);
    else setLoading(true);

    try {
      const res = isManualSync ? await api.syncReconciliation() : await api.getReconciliation();
      setData(res);
      if (isManualSync) {
        if (res.newlyMatchedCount > 0) {
          toast.success(`Đã đối soát và khớp thành công ${res.newlyMatchedCount} đơn hàng mới từ ApiPay!`);
        } else {
          toast.success("Đã đồng bộ dữ liệu mới nhất từ ApiPay.");
        }
      }
    } catch (err) {
      toast.error(errorMessage(err, "Không thể tải dữ liệu đối soát."));
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      window.setTimeout(() => setCopiedText(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleToggleOrderStatus = async (order: Order) => {
    const nextStatus = order.status === "paid" ? "pending_verification" : "paid";
    setUpdatingOrderId(order.id);
    try {
      await api.updateOrderStatus(
        order.id,
        nextStatus,
        nextStatus === "paid" ? "Admin duyệt đối soát thủ công" : undefined
      );
      toast.success(
        nextStatus === "paid"
          ? `Đã xác nhận thanh toán cho đơn ${order.transferNote}`
          : `Đã chuyển đơn ${order.transferNote} về trạng thái chờ xác nhận`
      );
      await loadData(false);
    } catch (err) {
      toast.error(errorMessage(err, "Cập nhật trạng thái đơn hàng thất bại."));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleOpenManualGmail = async (order: Order) => {
    const targetEmail =
      order.email || window.prompt("Nhập địa chỉ Gmail của khách hàng để soạn thư gửi nhạc:") || "";
    const cleanMail = targetEmail.trim();
    if (!cleanMail) return;

    const subject = `[NGHAO Music Producer] Gửi bản nhạc Full: ${order.trackTitle || "Track"} (${order.transferNote})`;
    const bodyLines = [
      `Chào bạn,`,
      ``,
      `Cảm ơn bạn đã mua bản nhạc "${order.trackTitle || "Track"}" tại NGHAO Music Producer!`,
      `- Mã đơn hàng: ${order.transferNote}`,
      `- Số tiền đã thanh toán: ${formatPrice(order.paidAmount || order.amount)}`,
      ...(order.downloadUrl ? [`- Link tải bản nhạc MP3 Full chất lượng cao: ${order.downloadUrl}`] : []),
      ``,
      `Mình gửi kèm bản nhạc Full trong email này cho bạn nhé.`,
      `Nếu cần hỗ trợ thêm, bạn có thể nhắn qua Zalo 0333 025 864 hoặc Facebook fb.com/nghao205.`,
      ``,
      `Trân trọng,`,
      `NGHAO — Music Producer`
    ];
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
      cleanMail
    )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    window.open(gmailComposeUrl, "_blank", "noopener,noreferrer");

    setUpdatingOrderId(order.id);
    try {
      await api.markOrderEmailSent(order.id, true, cleanMail);
      toast.success(`Đã mở cửa sổ soạn Gmail tới ${cleanMail} và đánh dấu Đã gửi Gmail!`);
      await loadData(false);
    } catch (err) {
      toast.error(errorMessage(err, "Không thể cập nhật trạng thái gửi Gmail."));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrder = async (order: Order) => {
    if (!window.confirm(`Xoá đơn hàng "${order.transferNote}" (${order.trackTitle})?`)) return;
    setUpdatingOrderId(order.id);
    try {
      await api.deleteOrder(order.id);
      toast.success("Đã xoá đơn hàng.");
      await loadData(false);
    } catch (err) {
      toast.error(errorMessage(err, "Không thể xoá đơn hàng."));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const stats = useMemo(() => {
    const orders = data?.orders || [];
    const hasPaymentOrders = orders.filter(
      (o) =>
        o.status === "paid" ||
        o.status === "underpaid" ||
        (o.paidAmount || 0) > 0 ||
        (o.overpaidAmount || 0) > 0 ||
        o.paymentResolution === "overpaid"
    );
    const paidOrders = orders.filter((o) => o.status === "paid");
    const exactOrders = orders.filter(
      (o) => o.status === "paid" && (o.paymentResolution === "exact" || !((o.overpaidAmount || 0) > 0))
    );
    const underpaidOrders = orders.filter((o) => o.status === "underpaid");
    const overpaidOrders = orders.filter(
      (o) => (o.overpaidAmount || 0) > 0 || o.paymentResolution === "overpaid"
    );
    const pendingOrders = orders.filter(
      (o) => (!o.status || o.status === "pending_verification") && !(o.paidAmount > 0)
    );
    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.paidAmount || (o.status === "paid" ? o.amount : 0) || 0),
      0
    );
    return {
      totalOrders: orders.length,
      hasPaymentCount: hasPaymentOrders.length,
      paidCount: paidOrders.length,
      exactCount: exactOrders.length,
      underpaidCount: underpaidOrders.length,
      overpaidCount: overpaidOrders.length,
      pendingCount: pendingOrders.length,
      totalRevenue
    };
  }, [data]);

  const filteredOrders = useMemo(() => {
    const orders = data?.orders || [];
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const currentStatus = o.status || "pending_verification";
      const isOverpaid = (o.overpaidAmount || 0) > 0 || o.paymentResolution === "overpaid";
      const isUnderpaid = currentStatus === "underpaid";
      const isPaid = currentStatus === "paid";
      const hasPayment = isPaid || isUnderpaid || (o.paidAmount || 0) > 0 || isOverpaid;

      if (filterStatus === "has_payment" && !hasPayment) return false;
      if (filterStatus === "exact" && (!isPaid || isOverpaid)) return false;
      if (filterStatus === "paid" && !isPaid) return false;
      if (filterStatus === "underpaid" && !isUnderpaid) return false;
      if (filterStatus === "overpaid" && !isOverpaid) return false;
      if (filterStatus === "pending_verification" && (currentStatus !== "pending_verification" || hasPayment)) return false;

      if (!q) return true;
      return (
        (o.transferNote || "").toLowerCase().includes(q) ||
        (o.id || "").toLowerCase().includes(q) ||
        (o.trackTitle || "").toLowerCase().includes(q) ||
        (o.email || "").toLowerCase().includes(q) ||
        (o.phone || "").toLowerCase().includes(q) ||
        (o.referenceCode || "").toLowerCase().includes(q) ||
        (o.transactionId || "").toLowerCase().includes(q) ||
        (o.apipayPublicId || "").toLowerCase().includes(q)
      );
    });
  }, [data, search, filterStatus]);

  const filteredTransactions = useMemo(() => {
    const list = data?.processedTransactions || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (tx) =>
        (tx.content || "").toLowerCase().includes(q) ||
        (tx.referenceCode || "").toLowerCase().includes(q) ||
        (tx.transactionId || "").toLowerCase().includes(q) ||
        (tx.orderId || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-white/60" role="status">
        <Loader2Icon className="h-6 w-6 animate-spin" aria-hidden />
        <span className="ml-3 text-sm">Đang tải dữ liệu đối soát giao dịch…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Nút Đồng bộ ApiPay */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Đối soát giao dịch & Đơn hàng (ApiPay)</h2>
          <p className="mt-1 text-sm text-white/60">
            Theo dõi biến động số dư MBBank (0392590124 — NGUYEN DUC ANH HAO), tự động khớp theo nội dung chuyển khoản hoặc duyệt thủ công.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={testingNotification}
            onClick={handleTestNotifications}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/10 active:scale-95 disabled:opacity-50"
            title="Gửi thông báo giả lập đơn mới tới Telegram và Gmail để kiểm tra chuông điện thoại">
            <BellIcon className={`h-3.5 w-3.5 text-ember ${testingNotification ? "animate-pulse" : ""}`} />
            <span>{testingNotification ? "Đang phát chuông..." : "Bắn thử chuông ntfy điện thoại"}</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => loadData(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-ember/20 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">
            <RefreshCwIcon className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} aria-hidden />
            <span>{syncing ? "Đang đồng bộ ApiPay..." : "Đồng bộ & Rà soát với ApiPay"}</span>
          </button>
        </div>
      </div>

      {/* 4 Thẻ thống kê tổng quan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Doanh thu đã đối soát</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-ember">{formatPrice(stats.totalRevenue)}</p>
          <p className="mt-1 text-xs text-white/45">
            Từ {stats.paidCount} đơn hoàn tất {stats.underpaidCount > 0 ? `(+${stats.underpaidCount} đơn chuyển thiếu)` : ""}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Tiền vào ApiPay (Tháng này)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-emerald-400">
            {formatPrice(Number(data?.apipayOverview?.totalIn || 0))}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {Number(data?.apipayOverview?.totalTransactions || 0)} giao dịch ngân hàng trên ApiPay
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Đã thanh toán (Đủ / Thiếu / Thừa)</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            <span className="text-emerald-400" title="Đã thanh toán đủ">{stats.exactCount} đủ</span>
            <span className="mx-1 text-white/30">·</span>
            <span className="text-orange-400" title="Chuyển thiếu">{stats.underpaidCount} thiếu</span>
            <span className="mx-1 text-white/30">·</span>
            <span className="text-cyan-400" title="Chuyển thừa">{stats.overpaidCount} thừa</span>
          </p>
          <p className="mt-1 text-xs text-white/45">
            Tổng {stats.hasPaymentCount} đơn có giao dịch ({stats.pendingCount} đơn chờ)
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Biến động Webhook đã lưu</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {data?.processedTransactions?.length || 0}
          </p>
          <p className="mt-1 text-xs text-white/45">Chống trùng lặp bằng transactionId</p>
        </div>
      </div>

      {/* Hộp hướng dẫn nhận thông báo điện thoại tức thì qua app ntfy */}
      <div className="rounded-3xl border border-cyan-500/30 bg-cyan-950/20 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
              <h3 className="font-semibold text-white">Chuông thông báo điện thoại tức thì (App ntfy)</h3>
            </div>
            <p className="text-xs leading-relaxed text-white/70">
              Cả bạn và bạn của bạn cùng tải app <strong>ntfy</strong> (trên App Store hoặc Google Play, miễn phí 100%, không cần tạo tài khoản), đăng ký kênh{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-cyan-300">nghao-orders-2026</code> để cả 2 máy cùng reo chuông ting ting khi khách thanh toán thành công!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy("nghao-orders-2026")}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20">
              {copiedText === "nghao-orders-2026" ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
              <span>{copiedText === "nghao-orders-2026" ? "Đã chép kênh" : "Chép tên kênh: nghao-orders-2026"}</span>
            </button>

            <a
              href="https://ntfy.sh/nghao-orders-2026"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span>Mở web ntfy</span>
            </a>
          </div>
        </div>
      </div>

      {/* Hộp hướng dẫn cấu hình Webhook ApiPay khi đổi Domain */}
      <div className="rounded-3xl border border-amber-500/30 bg-amber-950/20 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              <h3 className="font-semibold text-white">Cấu hình Webhook ApiPay (Cần cập nhật khi đổi Domain)</h3>
            </div>
            <p className="text-xs leading-relaxed text-white/70">
              Để app ntfy tự động reo chuông ngay khi khách quét mã chuyển khoản thành công, bạn cần cài đặt URL Webhook này trong{" "}
              <a href="https://app.apipay.vn" target="_blank" rel="noreferrer" className="text-amber-300 underline font-semibold">Dashboard ApiPay (app.apipay.vn)</a> &gt; Cấu hình Webhook:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-black/50 px-2 py-1 font-mono text-xs text-amber-200">
                https://nghaoproducer.shop/api/apipay/webhook
              </code>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleCopy("https://nghaoproducer.shop/api/apipay/webhook")}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20">
              {copiedText === "https://nghaoproducer.shop/api/apipay/webhook" ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
              <span>{copiedText === "https://nghaoproducer.shop/api/apipay/webhook" ? "Đã chép URL" : "Chép Webhook URL"}</span>
            </button>

            <a
              href="https://app.apipay.vn"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/10">
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span>Vào ApiPay Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      {/* Hộp hướng dẫn cơ chế rà soát Nội dung chuyển khoản */}
      <div className="rounded-3xl border border-ember/30 bg-ember/[0.07] p-5">
        <div className="flex items-start gap-3">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-ember" aria-hidden />
          <div className="space-y-1.5 text-sm">
            <h3 className="font-semibold text-white">Cơ chế rà soát Nội dung chuyển khoản, Chuyển thiếu & Chuyển thừa</h3>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-white/75">
              <li>
                <strong>1. Mã nội dung tự động trên từng đơn:</strong> Khi khách bấm mua nhạc, hệ thống sinh mã ASCII duy nhất dạng{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-ember">NGHAO &lt;MÃ_ĐƠN&gt;</code> (ví dụ:{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-white">NGHAO MV622OOIGJB</code>) và nhúng thẳng vào mã QR của ApiPay.
              </li>
              <li>
                <strong>2. Chuyển đủ hoặc Chuyển thừa (&ge; Giá bài nhạc):</strong> Hệ thống tự động duyệt đơn sang{" "}
                <strong>Đã thanh toán</strong> và mở khóa tải MP3 Full ngay lập tức. Nếu khách chuyển thừa, hệ thống gắn nhãn{" "}
                <span className="font-semibold text-cyan-300">Chuyển thừa (+X ₫)</span> để Admin dễ tra cứu nếu khách liên hệ Zalo hoàn tiền dư.
              </li>
              <li>
                <strong>3. Chuyển thiếu (&lt; Giá bài nhạc) & Cộng dồn tự động:</strong> Đơn hàng chuyển sang trạng thái{" "}
                <span className="font-semibold text-orange-300">Chuyển thiếu</span> (chưa mở khóa tải file) và báo ngay trên màn hình khách số tiền đã nhận + số tiền còn thiếu. Nếu khách chuyển khoản thêm phần còn thiếu với cùng mã{" "}
                <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-ember">NGHAO ...</code>, hệ thống tự động cộng dồn các lần chuyển và mở khóa tải nhạc ngay khi tổng tiền &ge; giá bài hát (hoặc Admin bấm{" "}
                <strong>"Duyệt đã thu"</strong> để mở khóa thủ công).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bộ lọc & Thanh tìm kiếm */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung CK (VD: NGHAO ...), mã đơn, tên bài nhạc, email, mã tham chiếu..."
            className="w-full rounded-2xl bg-white/[0.04] py-2.5 pl-11 pr-4 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10">
          {(
            [
              { id: "has_payment", label: `Đã thanh toán (Đủ / Thiếu / Thừa) (${stats.hasPaymentCount})` },
              { id: "exact", label: `Đủ tiền (${stats.exactCount})` },
              { id: "underpaid", label: `Chuyển thiếu (${stats.underpaidCount})` },
              { id: "overpaid", label: `Chuyển thừa (${stats.overpaidCount})` },
              { id: "pending_verification", label: `Đơn chưa CK (${stats.pendingCount})` }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilterStatus(item.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                filterStatus === item.id
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/65 hover:text-white hover:bg-white/[0.04]"
              }`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bảng 1: Danh sách Đơn hàng & Đối soát */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-base font-semibold">1. Danh sách Đơn hàng & Trạng thái Đối soát ({filteredOrders.length})</h3>
          <span className="text-xs text-white/50">
            {filterStatus === "has_payment" && "Toàn bộ đơn đã có giao dịch tiền (Đủ / Thiếu / Thừa)"}
            {filterStatus === "exact" && "Chỉ hiển thị đơn chuyển đủ tiền"}
            {filterStatus === "underpaid" && "Chỉ hiển thị đơn chuyển thiếu cần bù"}
            {filterStatus === "overpaid" && "Chỉ hiển thị đơn chuyển thừa"}
            {filterStatus === "pending_verification" && "Danh sách đơn khách tạo nhưng chưa chuyển khoản"}
          </span>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-white/50">
            Không có đơn hàng nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3.5">Thời gian</th>
                  <th className="px-4 py-3.5">Nội dung CK rà soát</th>
                  <th className="px-4 py-3.5">Bài hát</th>
                  <th className="px-4 py-3.5">Giá / Đã nhận</th>
                  <th className="px-4 py-3.5">Khách hàng</th>
                  <th className="px-4 py-3.5">Trạng thái & Đối soát</th>
                  <th className="px-4 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredOrders.map((order) => {
                  const isPaid = order.status === "paid";
                  const isUnderpaid = order.status === "underpaid";
                  const isOverpaid = (order.overpaidAmount || 0) > 0 || order.paymentResolution === "overpaid";
                  const isUpdating = updatingOrderId === order.id;
                  return (
                    <tr key={order.id} className="hover:bg-white/[0.02]">
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-white/65">
                        <div>
                          {order.createdAt ? new Date(order.createdAt).toLocaleString("vi-VN") : "—"}
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-white/40">{order.id}</div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="inline-flex items-center gap-1.5 rounded-lg bg-ember/15 px-2.5 py-1 font-mono text-xs font-semibold text-ember ring-1 ring-ember/30">
                          <span>{order.transferNote}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(order.transferNote)}
                            title="Sao chép nội dung chuyển khoản"
                            className="text-white/70 hover:text-white">
                            {copiedText === order.transferNote ? (
                              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <CopyIcon className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {order.apipayPublicId && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-white/45">
                            <span>ApiPay: {order.apipayPublicId}</span>
                            {order.payUrl && (
                              <a
                                href={order.payUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-ember hover:underline"
                                title="Mở trang thanh toán ApiPay">
                                <ExternalLinkIcon className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                        {order.paymentMethod === "paypal_card" && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <span>💳 Thẻ Visa/Mastercard (PayPal {order.amountUsd ? `$${order.amountUsd}` : ""})</span>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-white">{order.trackTitle || order.trackId}</div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 tabular-nums">
                        <div className="font-semibold text-ember">{formatPrice(order.amount)}</div>
                        {order.amountUsd && (
                          <div className="text-[11px] text-emerald-400 font-medium">${order.amountUsd} USD</div>
                        )}
                        {(order.paidAmount || 0) > 0 && (
                          <div className="mt-0.5 text-xs text-white/70">
                            Đã nhận: <strong className="text-emerald-300">{formatPrice(order.paidAmount || 0)}</strong>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-white/70">
                        <div className="space-y-1.5">
                          {order.email ? (
                            <div className="flex items-center gap-1.5 font-medium text-white">
                              <MailIcon className="h-3 w-3 shrink-0 text-white/45" />
                              <span className="truncate max-w-[160px]" title={order.email}>{order.email}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(order.email!)}
                                title="Sao chép Gmail khách hàng"
                                className="text-white/50 hover:text-white">
                                {copiedText === order.email ? (
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <CopyIcon className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/35">Chưa nhập Gmail</span>
                          )}

                          {order.phone && (
                            <div className="flex items-center gap-1.5 font-medium text-ember">
                              <PhoneIcon className="h-3 w-3 shrink-0 text-ember/70" />
                              <a
                                href={`tel:${order.phone}`}
                                title="Bấm để gọi"
                                className="hover:underline">
                                {order.phone}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopy(order.phone!)}
                                title="Sao chép SĐT khách hàng"
                                className="text-white/50 hover:text-white">
                                {copiedText === order.phone ? (
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <CopyIcon className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          <div>
                            {order.emailSentAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                                ✓ Đã gửi Gmail
                              </span>
                            ) : isPaid ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                Chờ gửi file
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {isPaid ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30">
                                <CheckCircle2Icon className="h-3.5 w-3.5" />
                                Đã thanh toán
                              </span>
                              {isOverpaid && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                                  Chuyển thừa (+{formatPrice(order.overpaidAmount || 0)})
                                </span>
                              )}
                            </div>
                            {order.referenceCode && (
                              <div className="font-mono text-[11px] text-white/55">
                                Mã tham chiếu: {order.referenceCode}
                              </div>
                            )}
                            {order.reconciledVia === "manual_admin" && (
                              <div className="text-[11px] text-amber-300/80">Duyệt thủ công bởi Admin</div>
                            )}
                          </div>
                        ) : isUnderpaid ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2.5 py-1 text-xs font-semibold text-orange-300 ring-1 ring-orange-500/40">
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              Chuyển thiếu (-{formatPrice(order.shortfallAmount || 0)})
                            </span>
                            <div className="text-[11px] text-white/65">
                              Đã nhận {formatPrice(order.paidAmount || 0)} / Cần {formatPrice(order.amount)}
                            </div>
                            {order.referenceCode && (
                              <div className="font-mono text-[11px] text-white/55">
                                Mã tham chiếu: {order.referenceCode}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/30">
                            <ClockIcon className="h-3.5 w-3.5" />
                            Chờ thanh toán
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOpenManualGmail(order)}
                            title="Mở Gmail soạn thư gửi file nhạc cho khách"
                            className="inline-flex items-center gap-1 rounded-full bg-ember/20 px-3 py-1.5 text-xs font-semibold text-ember transition-colors hover:bg-ember hover:text-white disabled:opacity-50">
                            <MailIcon className="h-3.5 w-3.5" />
                            <span>{order.emailSentAt ? "Gửi lại Gmail" : "Mở Gmail gửi khách"}</span>
                          </button>

                          {order.phone && (
                            <a
                              href={`https://zalo.me/${order.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Nhắn tin qua Zalo cho khách"
                              className="inline-flex items-center gap-1 rounded-full bg-sky-500/20 px-2.5 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500 hover:text-white">
                              <MessageCircleIcon className="h-3.5 w-3.5" />
                              <span>Zalo</span>
                            </a>
                          )}

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleToggleOrderStatus(order)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              isPaid
                                ? "bg-white/10 text-white/80 hover:bg-white/20"
                                : "bg-emerald-500 text-black hover:bg-emerald-400"
                            }`}>
                            {isUpdating ? (
                              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                            ) : isPaid ? (
                              <Undo2Icon className="h-3.5 w-3.5" />
                            ) : (
                              <CheckCircle2Icon className="h-3.5 w-3.5" />
                            )}
                            <span>{isPaid ? "Đặt lại chờ" : "Duyệt đã thu"}</span>
                          </button>

                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleDeleteOrder(order)}
                            title="Xoá đơn hàng"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-white/50 transition-colors hover:bg-red-500/20 hover:text-red-300">
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bảng 2: Lịch sử Biến động số dư Ngân hàng & Webhook */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold">
            2. Lịch sử Biến động số dư Ngân hàng & Webhook transaction.in ({filteredTransactions.length})
          </h3>
          <p className="mt-0.5 text-xs text-white/50">
            Hiển thị nguyên văn nội dung chuyển khoản thực tế ngân hàng nhận được để Admin rà soát nếu khách ghi nhầm mã đơn.
          </p>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-white/50">
            Chưa có biến động số dư nào được ghi nhận từ Webhook hoặc ApiPay.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-4 py-3.5">Thời gian GD</th>
                  <th className="px-4 py-3.5">Số tiền vào</th>
                  <th className="px-4 py-3.5">Nội dung chuyển khoản thực tế (Ngân hàng)</th>
                  <th className="px-4 py-3.5">Mã tham chiếu / Ngân hàng</th>
                  <th className="px-4 py-3.5">Đơn hàng đã khớp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.transactionId} className="hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-white/65">
                      {tx.transactionDate ? new Date(tx.transactionDate).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-semibold tabular-nums text-emerald-400">
                      +{formatPrice(Number(tx.amount || 0))}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-white">
                      {tx.content || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-white/65">
                      <div>{tx.referenceCode || tx.transactionId}</div>
                      <div className="text-[11px] text-white/40">Ngân hàng: {tx.gateway || "MB"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs">
                      {tx.orderId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-mono text-emerald-300 ring-1 ring-emerald-500/30">
                          <CheckCircle2Icon className="h-3 w-3" />
                          {tx.orderId}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300 ring-1 ring-amber-500/30">
                          Chưa khớp tự động (Khách ghi khác mã)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
