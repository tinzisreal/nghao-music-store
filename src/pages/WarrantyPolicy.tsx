import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckIcon,
  MessageCircleIcon,
  PhoneIcon,
  ShieldAlertIcon,
  ShieldCheckIcon
} from "lucide-react";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { ContactFooter } from "../components/ContactFooter";
import { useStoreData } from "../hooks/useStoreData";
import { storeInfo as defaultInfo } from "../data/contact";
import { producer as defaultProducer } from "../data/tracks";

const BG_IMAGE = "/bg-custom.png?v=2";
const ZALO_PHONE = "0333025864";
const ZALO_DISPLAY = "0333 025 864";
const ZALO_LINK = `https://zalo.me/${ZALO_PHONE}`;

export function WarrantyPolicy() {
  const { state } = useStoreData();
  const info = state.status === "ready" ? state.data.info : defaultInfo;
  const producer = state.status === "ready" ? state.data.producer : defaultProducer;

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0c1824] font-sans text-white">
      {/* Background - exact same as Store.tsx */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none">
        <img
          src={BG_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <LanguageSwitch />

      <main className="relative z-10 mx-auto max-w-[1020px] px-4 pb-28 pt-4 sm:px-6 md:pb-36 md:pt-8">
        {/* Header matching store */}
        <header className="mb-6 flex items-center justify-between pr-20 sm:mb-8 sm:pr-24">
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 rounded-full bg-black/40 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-black/55 sm:gap-3.5 sm:px-4 sm:py-2">
            <img
              src="/logo-mark-white.png"
              alt="NGHAO Music Producer Logo"
              className="h-8 w-8 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-10 sm:w-10"
            />
            <div className="leading-tight">
              <span className="block text-sm font-bold tracking-[0.14em] text-white sm:text-base">NGHAO</span>
              <span className="block text-[9px] font-semibold tracking-[0.18em] text-white/65 sm:text-[10px] sm:tracking-[0.2em]">
                MUSIC PRODUCER
              </span>
            </div>
          </Link>

          <Link
            to="/"
            className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-white hover:text-black sm:text-sm">
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Về cửa hàng</span>
          </Link>
        </header>

        {/* Main Document Container - Single sleek progressive glass card */}
        <article className="progressive-card-glass rounded-[28px] p-6 sm:rounded-[36px] sm:p-10 md:p-14 shadow-2xl">
          {/* Document Header */}
          <div className="border-b border-white/10 pb-8 sm:pb-10">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-ember uppercase">
              <ShieldCheckIcon className="h-4 w-4 text-ember" />
              <span>Chính sách chính thức</span>
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-4xl md:text-[40px] leading-snug">
              Quyền Sử Dụng & Chính Sách Bảo Hành Nhạc SLOT
            </h1>

            <p className="mt-2 text-sm font-semibold tracking-wide text-white/70 sm:text-base">
              NGHAO PRODUCER
            </p>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-white/80">
              Chính sách này áp dụng cho toàn bộ các bản nhạc SLOT do <strong>NGHAO PRODUCER</strong> trực tiếp sản xuất, hoàn thiện và bàn giao cho khách hàng. Nhằm bảo đảm tính độc quyền và sự minh bạch trong giao dịch, mỗi bản nhạc được tích hợp dấu nhận diện riêng và áp dụng chế độ bảo hành từ 3–6 tháng.
            </p>

            {/* 3 Key Highlights - styled with authentic liquid-glass */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="liquid-glass rounded-2xl p-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Thời hạn bảo hành
                </span>
                <span className="mt-1 block text-lg font-bold text-white">03 – 06 Tháng</span>
                <span className="mt-0.5 block text-xs text-ember">Tính từ ngày nhận nhạc</span>
              </div>

              <div className="liquid-glass rounded-2xl p-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Dấu nhận diện
                </span>
                <span className="mt-1 block text-lg font-bold text-white">Định danh âm thanh</span>
                <span className="mt-0.5 block text-xs text-white/60">Truy xuất nguồn gốc</span>
              </div>

              <div className="liquid-glass rounded-2xl p-4">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Cam kết đền bù
                </span>
                <span className="mt-1 block text-lg font-bold text-white">Đổi bản nhạc mới</span>
                <span className="mt-0.5 block text-xs text-white/60">Hoặc hỗ trợ tương đương</span>
              </div>
            </div>
          </div>

          {/* Clauses Body */}
          <div className="mt-8 sm:mt-10 space-y-10 sm:space-y-12">

            {/* 1. Quyền lợi khách hàng */}
            <section aria-labelledby="section-1">
              <h2 id="section-1" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">1.</span>
                <span>Quyền lợi khách hàng</span>
              </h2>

              <p className="mt-3 text-sm sm:text-base text-white/80 leading-relaxed">
                Khi mua và nhận bàn giao bản nhạc SLOT từ NGHAO PRODUCER, khách hàng được hưởng các quyền lợi sau:
              </p>

              <ul className="mt-3.5 space-y-3 text-sm sm:text-base text-white/80 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    <strong className="text-white">Bản nhạc có dấu nhận diện riêng:</strong> Mỗi bản nhạc được bàn giao đã tích hợp dấu nhận diện riêng theo thỏa thuận giữa hai bên, nhằm hỗ trợ nhận diện và truy xuất nguồn gốc bản nhạc khi cần thiết.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    <strong className="text-white">Bảo hành từ 3–6 tháng:</strong> Thời hạn bảo hành cụ thể được thống nhất khi giao dịch, tính từ ngày khách hàng nhận bàn giao bản nhạc.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    <strong className="text-white">Hỗ trợ xử lý sự cố:</strong> Trong thời hạn bảo hành, nếu bản nhạc bị phát tán ra ngoài trái với phạm vi sử dụng đã thỏa thuận, NGHAO PRODUCER sẽ phối hợp cùng khách hàng xác minh tình hình và thống nhất phương án xử lý.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    <strong className="text-white">Chính sách đền bù:</strong> Nếu xảy ra sự cố phát tán bản nhạc thuộc phạm vi được bảo hành, phương án đền bù có thể là cung cấp bản nhạc khác hoặc hình thức hỗ trợ tương đương, tùy theo tình hình thực tế và thỏa thuận giữa hai bên.
                  </div>
                </li>
              </ul>
            </section>

            {/* 2. Quyền sử dụng bản nhạc */}
            <section aria-labelledby="section-2" className="border-t border-white/10 pt-8 sm:pt-10">
              <h2 id="section-2" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">2.</span>
                <span>Quyền sử dụng bản nhạc</span>
              </h2>

              <p className="mt-3 text-sm sm:text-base text-white/80 leading-relaxed">
                Khách hàng được sử dụng bản nhạc theo phạm vi đã thống nhất khi mua, bao gồm mục đích sử dụng, phạm vi phát hành và các quyền liên quan nếu có.
              </p>

              {/* Strict No Reselling Callout */}
              <div className="my-4 rounded-2xl border border-red-500/30 bg-red-950/25 p-4 sm:p-5 text-sm sm:text-base text-red-100/95 leading-relaxed">
                <div className="flex items-center gap-2 font-semibold text-red-300">
                  <ShieldAlertIcon className="h-4 w-4 shrink-0 text-red-400" />
                  <span>Quy định bảo mật độc quyền:</span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-red-100/90 leading-relaxed">
                  Khách hàng không được tự ý chia sẻ, bán lại, phân phối, đăng tải công khai hoặc chuyển giao file nhạc cho bên thứ ba nếu chưa được NGHAO PRODUCER cho phép bằng văn bản hoặc theo hình thức xác nhận được hai bên chấp thuận.
                </p>
              </div>

              <p className="text-xs sm:text-sm text-white/65 leading-relaxed">
                Các quyền sử dụng cụ thể khác, bao gồm quyền chỉnh sửa, phát hành thương mại, chuyển nhượng hoặc cấp phép lại, cần được thỏa thuận riêng khi giao dịch.
              </p>
            </section>

            {/* 3. Trách nhiệm bảo mật của khách hàng */}
            <section aria-labelledby="section-3" className="border-t border-white/10 pt-8 sm:pt-10">
              <h2 id="section-3" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">3.</span>
                <span>Trách nhiệm bảo mật của khách hàng</span>
              </h2>

              <div className="mt-3 space-y-3 text-sm sm:text-base text-white/80 leading-relaxed">
                <p>
                  Khách hàng có trách nhiệm bảo quản file nhạc, thông tin bàn giao và các dữ liệu liên quan; không tự ý cung cấp bản nhạc cho người không có quyền tiếp cận.
                </p>
                <p>
                  Nếu bản nhạc bị phát tán ra ngoài do hành vi hoặc lỗi bảo mật thuộc trách nhiệm của khách hàng, hai bên sẽ phối hợp xác minh nguyên nhân, mức độ ảnh hưởng và trách nhiệm liên quan.
                </p>
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs sm:text-sm text-white/75 leading-relaxed">
                  <strong className="text-white">Nghĩa vụ bồi thường:</strong> Trường hợp xác định khách hàng vi phạm nghĩa vụ bảo mật hoặc làm lọt bản nhạc do lỗi thuộc trách nhiệm của mình, khách hàng có trách nhiệm bồi thường theo mức và phương thức đã được hai bên thống nhất trước hoặc xác lập bằng văn bản tại thời điểm xử lý sự cố, phù hợp với quy định pháp luật áp dụng.
                </p>
              </div>
            </section>

            {/* 4. Phạm vi và điều kiện bảo hành */}
            <section aria-labelledby="section-4" className="border-t border-white/10 pt-8 sm:pt-10">
              <h2 id="section-4" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">4.</span>
                <span>Phạm vi và điều kiện bảo hành</span>
              </h2>

              <ul className="mt-3.5 space-y-3 text-sm sm:text-base text-white/80 leading-relaxed">
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    <strong className="text-white">Thời hạn bảo hành:</strong> 3–6 tháng, theo xác nhận cụ thể của từng giao dịch.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    Bảo hành áp dụng đối với sự cố phát tán bản nhạc thuộc phạm vi và điều kiện đã được hai bên thống nhất.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    Khi phát hiện sự cố, khách hàng cần thông báo cho NGHAO PRODUCER trong thời gian sớm nhất và cung cấp thông tin, bằng chứng liên quan nếu có.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ember" />
                  <div>
                    Hai bên phối hợp xác minh nguồn phát tán, phạm vi ảnh hưởng và trách nhiệm của từng bên trước khi quyết định phương án xử lý.
                  </div>
                </li>
                <li className="flex items-start gap-3 text-white/60">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/30" />
                  <div>
                    <strong className="text-white/80">Trường hợp loại trừ:</strong> Chính sách bảo hành không mặc nhiên áp dụng cho các trường hợp phát tán do khách hàng vi phạm thỏa thuận hoặc do bên thứ ba mà khách hàng tự nguyện cung cấp bản nhạc.
                  </div>
                </li>
              </ul>
            </section>

            {/* 5. Phương án xử lý và đền bù */}
            <section aria-labelledby="section-5" className="border-t border-white/10 pt-8 sm:pt-10">
              <h2 id="section-5" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">5.</span>
                <span>Phương án xử lý và đền bù</span>
              </h2>

              <p className="mt-3 text-sm sm:text-base text-white/80 leading-relaxed">
                Tùy theo tính chất và mức độ sự cố, hai bên có thể thống nhất một trong các phương án:
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="liquid-glass rounded-2xl p-4">
                  <span className="text-xs font-semibold text-ember uppercase tracking-wider">Phương án 1</span>
                  <p className="mt-1 text-sm font-semibold text-white">Cung cấp bản nhạc khác</p>
                  <p className="mt-1 text-xs text-white/65 leading-relaxed">
                    Có giá trị và phạm vi sử dụng tương đương với bản nhạc ban đầu.
                  </p>
                </div>

                <div className="liquid-glass rounded-2xl p-4">
                  <span className="text-xs font-semibold text-ember uppercase tracking-wider">Phương án 2</span>
                  <p className="mt-1 text-sm font-semibold text-white">Thay thế theo yêu cầu</p>
                  <p className="mt-1 text-xs text-white/65 leading-relaxed">
                    Thay thế bằng bản nhạc khác theo yêu cầu và thỏa thuận giữa hai bên.
                  </p>
                </div>

                <div className="liquid-glass rounded-2xl p-4">
                  <span className="text-xs font-semibold text-ember uppercase tracking-wider">Phương án 3</span>
                  <p className="mt-1 text-sm font-semibold text-white">Khắc phục thiệt hại</p>
                  <p className="mt-1 text-xs text-white/65 leading-relaxed">
                    Theo thỏa thuận và quy định pháp luật áp dụng.
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-white/50 leading-relaxed">
                * Mọi thỏa thuận về mức đền bù, điều kiện áp dụng và trách nhiệm của mỗi bên nên được xác nhận bằng văn bản hoặc hình thức điện tử có thể lưu trữ, đối chiếu.
              </p>
            </section>

            {/* 6. Xác nhận thỏa thuận */}
            <section aria-labelledby="section-6" className="border-t border-white/10 pt-8 sm:pt-10">
              <h2 id="section-6" className="text-lg font-bold text-white sm:text-xl flex items-baseline gap-2.5">
                <span className="text-ember font-mono">6.</span>
                <span>Xác nhận thỏa thuận</span>
              </h2>

              <div className="mt-3 space-y-2.5 text-sm sm:text-base text-white/80 leading-relaxed">
                <p>
                  Việc thanh toán và nhận bàn giao bản nhạc SLOT được thực hiện trên cơ sở khách hàng đã được thông báo về phạm vi quyền sử dụng, thời hạn bảo hành, nghĩa vụ bảo mật và phương án xử lý khi phát sinh sự cố.
                </p>
                <p className="text-xs sm:text-sm text-white/60">
                  Các điều khoản riêng của từng giao dịch được ưu tiên áp dụng trong phạm vi phù hợp với quy định pháp luật và những nội dung đã được hai bên thống nhất.
                </p>
              </div>
            </section>
          </div>

          {/* Direct Contact Banner inside article footer */}
          <div className="mt-12 border-t border-white/10 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm sm:text-base font-semibold text-white">
                Cần trao đổi thêm về bản quyền nhạc SLOT?
              </p>
              <p className="text-xs sm:text-sm text-white/60 mt-0.5">
                Liên hệ trực tiếp với Nghao Producer qua Zalo hoặc Hotline để được hỗ trợ nhanh nhất.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href={ZALO_LINK}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs sm:text-sm font-semibold text-black shadow-lg transition-transform hover:scale-105 active:scale-95">
                <MessageCircleIcon className="h-4 w-4 fill-black" />
                <span>Zalo: {ZALO_DISPLAY}</span>
              </a>

              <a
                href={`tel:${ZALO_PHONE}`}
                className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-white hover:text-black">
                <PhoneIcon className="h-4 w-4" />
                <span>Gọi Hotline</span>
              </a>
            </div>
          </div>
        </article>

        {/* Store's ContactFooter */}
        <div className="mt-12 sm:mt-16 md:mt-20">
          <ContactFooter name={producer.name} info={info} />
        </div>
      </main>
    </div>
  );
}
