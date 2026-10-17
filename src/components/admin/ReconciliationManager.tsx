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
import { Order, ProcessedTransaction, ReconciliationData } from "../../types/store";
import { api, errorMessage } from "../../utils/api";
import { formatPrice } from "../../utils/format";

type FilterStatus = "has_payment" | "exact" | "underpaid" | "overpaid" | "unmatched" | "pending_verification" | "all";

interface UnifiedItem {
  key: string;
  kind: "order" | "unmatched_tx";
  order?: Order;
  transaction?: ProcessedTransaction;
  hasPayment: boolean;
  effectiveTime: number;
  status: "exact" | "underpaid" | "overpaid" | "unmatched" | "pending_verification";
  amount: number;
  paidAmount: number;
  shortfallAmount: number;
  overpaidAmount: number;
  transferNote: string;
  referenceCode?: string;
  transactionId?: string;
  gateway?: string;
  trackTitle?: string;
  email?: string;
  phone?: string;
  emailSentAt?: string;
  apipayPublicId?: string;
  payUrl?: string;
  reconciledVia?: string;
  createdAt?: string;
  paidAt?: string;
}

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

  // Gom toàn bộ Đơn hàng và Biến động ngân hàng thành 1 danh sách hợp nhất (Unified List)
  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const orders = data?.orders || [];
    const transactions = data?.processedTransactions || [];

    const matchedTxIds = new Set<string>();

    orders.forEach((o) => {
      if (o.transactionId) matchedTxIds.add(o.transactionId);
      if (Array.isArray(o.paymentHistory)) {
        o.paymentHistory.forEach((h) => {
          if (h.transactionId) matchedTxIds.add(h.transactionId);
        });
      }
    });

    const items: UnifiedItem[] = [];

    // 1. Chuyển đổi toàn bộ Đơn hàng sang item
    for (const order of orders) {
      const isPaid = order.status === "paid";
      const isUnderpaid = order.status === "underpaid";
      const isOverpaid = (order.overpaidAmount || 0) > 0 || order.paymentResolution === "overpaid";
      const hasPayment = isPaid || isUnderpaid || (order.paidAmount || 0) > 0 || isOverpaid;

      let status: UnifiedItem["status"] = "pending_verification";
      if (isUnderpaid) status = "underpaid";
      else if (isOverpaid) status = "overpaid";
      else if (isPaid) status = "exact";

      const effectiveTime = hasPayment
        ? Date.parse(order.paidAt || order.lastPaymentAt || order.createdAt || "") || 0
        : Date.parse(order.createdAt || "") || 0;

      items.push({
        key: `order_${order.id}`,
        kind: "order",
        order,
        hasPayment,
        effectiveTime,
        status,
        amount: order.amount,
        paidAmount: order.paidAmount || (isPaid ? order.amount : 0),
        shortfallAmount: order.shortfallAmount || (isUnderpaid ? Math.max(0, order.amount - (order.paidAmount || 0)) : 0),
        overpaidAmount: order.overpaidAmount || 0,
        transferNote: order.transferNote,
        referenceCode: order.referenceCode,
        transactionId: order.transactionId,
        gateway: order.paymentMethod === "paypal_card" ? "PayPal" : "MBBank",
        trackTitle: order.items && order.items.length > 1
          ? `${order.items.length} bài (${order.items.map((i) => i.title).join(", ")})`
          : order.trackTitle || order.trackId,
        email: order.email,
        phone: order.phone,
        emailSentAt: order.emailSentAt,
        apipayPublicId: order.apipayPublicId,
        payUrl: order.payUrl,
        reconciledVia: order.reconciledVia,
        createdAt: order.createdAt,
        paidAt: order.paidAt
      });
    }

    // 2. Chuyển đổi các biến động ngân hàng chưa khớp sang item
    for (const tx of transactions) {
      const isMatched = (tx.orderId && orders.some((o) => o.id === tx.orderId)) || matchedTxIds.has(tx.transactionId);
      if (isMatched) continue;

      const txAmount = Number(tx.amount || 0);
      const effectiveTime = Date.parse(tx.transactionDate || tx.processedAt || "") || 0;

      items.push({
        key: `tx_${tx.transactionId}`,
        kind: "unmatched_tx",
        transaction: tx,
        hasPayment: true,
        effectiveTime,
        status: "unmatched",
        amount: txAmount,
        paidAmount: txAmount,
        shortfallAmount: 0,
        overpaidAmount: 0,
        transferNote: tx.content,
        referenceCode: tx.referenceCode || tx.transactionId,
        transactionId: tx.transactionId,
        gateway: tx.gateway || "MBBank",
        trackTitle: "Chưa gán bài hát",
        createdAt: tx.transactionDate || tx.processedAt,
        paidAt: tx.transactionDate || tx.processedAt
      });
    }

    // 3. Quy tắc cốt lõi: CỨ NHẬN TIỀN LÀ LÊN TRƯỚC HẾT!
    // Giao dịch mới nhận tiền nhất sẽ đứng ngay dòng 1.
    items.sort((a, b) => {
      if (a.hasPayment !== b.hasPayment) {
        return a.hasPayment ? -1 : 1;
      }
      return b.effectiveTime - a.effectiveTime;
    });

    return items;
  }, [data]);

  const stats = useMemo(() => {
    const hasPaymentItems = unifiedItems.filter((i) => i.hasPayment);
    const exactItems = unifiedItems.filter((i) => i.status === "exact");
    const underpaidItems = unifiedItems.filter((i) => i.status === "underpaid");
    const overpaidItems = unifiedItems.filter((i) => i.status === "overpaid");
    const unmatchedItems = unifiedItems.filter((i) => i.status === "unmatched");
    const pendingItems = unifiedItems.filter((i) => i.status === "pending_verification");

    const totalRevenue = unifiedItems.reduce(
      (sum, i) => sum + Number(i.paidAmount || 0),
      0
    );

    return {
      totalCount: unifiedItems.length,
      hasPaymentCount: hasPaymentItems.length,
      exactCount: exactItems.length,
      underpaidCount: underpaidItems.length,
      overpaidCount: overpaidItems.length,
      unmatchedCount: unmatchedItems.length,
      pendingCount: pendingItems.length,
      totalRevenue
    };
  }, [unifiedItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedItems.filter((item) => {
      if (filterStatus === "has_payment" && !item.hasPayment) return false;
      if (filterStatus === "exact" && item.status !== "exact") return false;
      if (filterStatus === "underpaid" && item.status !== "underpaid") return false;
      if (filterStatus === "overpaid" && item.status !== "overpaid") return false;
      if (filterStatus === "unmatched" && item.status !== "unmatched") return false;
      if (filterStatus === "pending_verification" && item.status !== "pending_verification") return false;

      if (!q) return true;
      return (
        (item.transferNote || "").toLowerCase().includes(q) ||
        (item.key || "").toLowerCase().includes(q) ||
        (item.trackTitle || "").toLowerCase().includes(q) ||
        (item.email || "").toLowerCase().includes(q) ||
        (item.phone || "").toLowerCase().includes(q) ||
        (item.referenceCode || "").toLowerCase().includes(q) ||
        (item.transactionId || "").toLowerCase().includes(q) ||
        (item.apipayPublicId || "").toLowerCase().includes(q) ||
        (item.gateway || "").toLowerCase().includes(q)
      );
    });
  }, [unifiedItems, search, filterStatus]);

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
            Từ {stats.exactCount + stats.overpaidCount} đơn hoàn tất {stats.underpaidCount > 0 ? `(+${stats.underpaidCount} đơn chuyển thiếu)` : ""}
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
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Phân loại nhận tiền</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            <span className="text-emerald-400" title="Đã thanh toán đủ">{stats.exactCount} đủ</span>
            <span className="mx-1 text-white/30">·</span>
            <span className="text-orange-400" title="Chuyển thiếu">{stats.underpaidCount} thiếu</span>
            <span className="mx-1 text-white/30">·</span>
            <span className="text-cyan-400" title="Chuyển thừa">{stats.overpaidCount} thừa</span>
            {stats.unmatchedCount > 0 && (
              <>
                <span className="mx-1 text-white/30">·</span>
                <span className="text-amber-400" title="Chưa khớp">{stats.unmatchedCount} chưa khớp</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-white/45">
            Tổng {stats.hasPaymentCount} giao dịch có tiền ({stats.pendingCount} đơn chưa CK)
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Tổng số đơn hàng</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
            {stats.totalCount}
          </p>
          <p className="mt-1 text-xs text-white/45">Được đồng bộ và bảo vệ chống trùng lặp</p>
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo nội dung CK (VD: NGHAO ...), mã đơn, tên bài nhạc, email, SĐT, mã tham chiếu..."
            className="w-full rounded-2xl bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-ember"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white/[0.04] p-1.5 ring-1 ring-inset ring-white/10">
          {(
            [
              { id: "has_payment", label: `Đã nhận tiền (${stats.hasPaymentCount})` },
              { id: "exact", label: `Đủ tiền (${stats.exactCount})` },
              { id: "underpaid", label: `Chuyển thiếu (${stats.underpaidCount})` },
              { id: "overpaid", label: `Chuyển thừa (${stats.overpaidCount})` },
              { id: "unmatched", label: `Chưa khớp (${stats.unmatchedCount})` },
              { id: "pending_verification", label: `Đơn chưa CK (${stats.pendingCount})` },
              { id: "all", label: `Tất cả (${stats.totalCount})` }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilterStatus(item.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                filterStatus === item.id
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-white/65 hover:text-white hover:bg-white/[0.04]"
              }`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* DUY NHẤT 1 BẢNG MASTER: Danh sách Đơn hàng & Đối soát Giao dịch */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
        <div className="border-b border-white/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">Danh sách Đối soát & Giao dịch ({filteredItems.length})</h3>
            <p className="mt-0.5 text-xs text-white/50">
              {filterStatus === "has_payment" && "Toàn bộ giao dịch ngân hàng đã nhận tiền — xếp giao dịch mới nhận lên đầu tiên"}
              {filterStatus === "exact" && "Chỉ hiển thị các đơn đã chuyển đủ chính xác giá bản nhạc"}
              {filterStatus === "underpaid" && "Chỉ hiển thị các đơn chuyển thiếu cần bù thêm"}
              {filterStatus === "overpaid" && "Chỉ hiển thị các đơn chuyển thừa cần lưu ý"}
              {filterStatus === "unmatched" && "Giao dịch ngân hàng đã nhận nhưng khách ghi khác cú pháp mã đơn"}
              {filterStatus === "pending_verification" && "Đơn hàng khách bấm mua nhưng chưa quét mã chuyển khoản"}
              {filterStatus === "all" && "Toàn bộ đơn hàng và biến động số dư hệ thống"}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1 text-xs text-white/60">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Ưu tiên hiển thị: Giao dịch có tiền lên đầu
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-white/50">
            Không có giao dịch hoặc đơn hàng nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-5 py-4 w-[170px] min-w-[160px]">Thời gian & Mã GD</th>
                  <th className="px-5 py-4 w-[230px] min-w-[210px]">Nội dung CK & Cổng TT</th>
                  <th className="px-5 py-4 min-w-[260px]">Bài hát & Khách hàng</th>
                  <th className="px-5 py-4 w-[180px] min-w-[170px]">Số tiền / Đã nhận</th>
                  <th className="px-5 py-4 w-[220px] min-w-[200px]">Trạng thái & Đối soát</th>
                  <th className="px-5 py-4 w-[250px] min-w-[240px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredItems.map((item) => {
                  const isOrder = item.kind === "order";
                  const order = item.order;
                  const isPaid = item.status === "exact" || item.status === "overpaid";
                  const isUnderpaid = item.status === "underpaid";
                  const isOverpaid = item.status === "overpaid";
                  const isUnmatched = item.status === "unmatched";
                  const isUpdating = order ? updatingOrderId === order.id : false;

                  return (
                    <tr
                      key={item.key}
                      className={`transition-colors hover:bg-white/[0.03] ${
                        item.hasPayment ? "bg-white/[0.01]" : ""
                      }`}>
                      {/* Cột 1: Thời gian & Mã */}
                      <td className="px-5 py-4 text-xs text-white/70">
                        <div className="font-medium text-white/90">
                          {item.paidAt
                            ? new Date(item.paidAt).toLocaleString("vi-VN")
                            : item.createdAt
                            ? new Date(item.createdAt).toLocaleString("vi-VN")
                            : "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-white/40">
                          <span>{order ? order.id : item.transactionId}</span>
                        </div>
                        {item.hasPayment && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Đã nhận tiền
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Cột 2: Nội dung chuyển khoản & Cổng TT */}
                      <td className="px-5 py-4">
                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-ember/15 px-3 py-1.5 font-mono text-xs font-semibold text-ember ring-1 ring-ember/30 max-w-full">
                          <span className="truncate" title={item.transferNote}>
                            {item.transferNote}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(item.transferNote)}
                            title="Sao chép nội dung chuyển khoản"
                            className="shrink-0 text-white/70 hover:text-white">
                            {copiedText === item.transferNote ? (
                              <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <CopyIcon className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
                          <span className="rounded bg-white/5 px-2 py-0.5 font-medium text-white/70">
                            {item.gateway || "MBBank"}
                          </span>
                          {item.apipayPublicId && (
                            <span className="flex items-center gap-1">
                              <span>ApiPay: {item.apipayPublicId}</span>
                              {item.payUrl && (
                                <a
                                  href={item.payUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-ember hover:underline"
                                  title="Mở trang thanh toán ApiPay">
                                  <ExternalLinkIcon className="h-3 w-3" />
                                </a>
                              )}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Tên bài hát & Khách hàng */}
                      <td className="px-5 py-4 text-xs">
                        <div className="font-semibold text-white text-sm">
                          {item.trackTitle}
                        </div>

                        <div className="mt-2 space-y-1">
                          {item.email ? (
                            <div className="flex items-center gap-1.5 font-medium text-white/90">
                              <MailIcon className="h-3.5 w-3.5 shrink-0 text-white/45" />
                              <span className="truncate max-w-[200px]" title={item.email}>
                                {item.email}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.email!)}
                                title="Sao chép Gmail"
                                className="text-white/50 hover:text-white">
                                {copiedText === item.email ? (
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <CopyIcon className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/35 italic">Chưa nhập Gmail</span>
                          )}

                          {item.phone && (
                            <div className="flex items-center gap-1.5 font-medium text-ember">
                              <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-ember/70" />
                              <a href={`tel:${item.phone}`} className="hover:underline" title="Bấm để gọi">
                                {item.phone}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.phone!)}
                                title="Sao chép SĐT"
                                className="text-white/50 hover:text-white">
                                {copiedText === item.phone ? (
                                  <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <CopyIcon className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          )}

                          <div className="pt-0.5">
                            {item.emailSentAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                                ✓ Đã gửi Gmail file nhạc
                              </span>
                            ) : isPaid && isOrder ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
                                Chờ gửi file
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Cột 4: Số tiền & Đã nhận */}
                      <td className="px-5 py-4 tabular-nums">
                        <div className="font-medium text-white/60 text-xs">
                          Giá niêm yết: <strong className="text-white font-semibold">{formatPrice(item.amount)}</strong>
                        </div>
                        {order?.amountUsd && (
                          <div className="text-[11px] text-emerald-400 font-medium">
                            (${order.amountUsd} USD)
                          </div>
                        )}

                        {item.paidAmount > 0 ? (
                          <div className="mt-1 text-sm font-bold text-emerald-400">
                            +{formatPrice(item.paidAmount)}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-white/40">Chưa nhận</div>
                        )}

                        {isUnderpaid && item.shortfallAmount > 0 && (
                          <div className="mt-0.5 text-[11px] font-medium text-orange-400">
                            Thiếu: -{formatPrice(item.shortfallAmount)}
                          </div>
                        )}
                        {isOverpaid && item.overpaidAmount > 0 && (
                          <div className="mt-0.5 text-[11px] font-medium text-cyan-400">
                            Thừa: +{formatPrice(item.overpaidAmount)}
                          </div>
                        )}
                      </td>

                      {/* Cột 5: Trạng thái & Đối soát */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          {isPaid ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                                <CheckCircle2Icon className="h-3.5 w-3.5" />
                                Đã thanh toán (Đủ tiền)
                              </span>
                              {isOverpaid && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                                  Chuyển thừa (+{formatPrice(item.overpaidAmount)})
                                </span>
                              )}
                            </div>
                          ) : isUnderpaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold text-orange-300 ring-1 ring-orange-500/40">
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              Chuyển thiếu (-{formatPrice(item.shortfallAmount)})
                            </span>
                          ) : isUnmatched ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40">
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              Chưa khớp tự động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 px-3 py-1 text-xs font-medium text-white/60 ring-1 ring-white/10">
                              <ClockIcon className="h-3.5 w-3.5" />
                              Chờ chuyển khoản
                            </span>
                          )}

                          {item.referenceCode && (
                            <div className="font-mono text-[11px] text-white/55">
                              Mã tham chiếu: <span className="text-white/80">{item.referenceCode}</span>
                            </div>
                          )}

                          {item.reconciledVia === "manual_admin" && (
                            <div className="text-[11px] text-amber-300/80">Duyệt thủ công bởi Admin</div>
                          )}
                          {item.reconciledVia === "apipay_sync" && (
                            <div className="text-[11px] text-emerald-400/80">Khớp tự động qua ApiPay</div>
                          )}
                        </div>
                      </td>

                      {/* Cột 6: Thao tác */}
                      <td className="px-5 py-4 text-right">
                        {isOrder && order ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleOpenManualGmail(order)}
                              title="Mở Gmail soạn thư gửi file nhạc cho khách"
                              className="inline-flex items-center gap-1.5 rounded-full bg-ember/20 px-3 py-1.5 text-xs font-semibold text-ember transition-colors hover:bg-ember hover:text-white disabled:opacity-50">
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
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={syncing}
                              onClick={() => loadData(true)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black">
                              <RefreshCwIcon className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                              <span>Đồng bộ / Khớp đơn</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
