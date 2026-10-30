# Luồng mua hàng HELIOS

Trang sản phẩm bổ sung các phần còn thiếu và sửa chức năng mua hàng trên nền KS BootShop. Trang chủ, header và slideshow đã được giữ nguyên so với đầu nhánh `e1ee4a0`; các thay đổi CSS dùng selector cho gallery/trang sản phẩm. Footer chỉ bỏ newsletter trên trang sản phẩm, theo trang tham chiếu.

## Phần được hoàn thiện

- **Sản phẩm gợi ý** render ngay từ sản phẩm thật đã xuất bản: danh sách chọn thủ công, collection được chọn/cùng sản phẩm, rồi `collections.all`. Loại sản phẩm đang xem. API đề xuất Shopify trả dữ liệu hợp lệ thì thay danh sách; rỗng, lỗi hoặc timeout thì giữ danh sách dự phòng. Không có sản phẩm khác thì không tạo tiêu đề/khoảng trống giả. Không dùng sản phẩm demo.
- **Gallery**: thumbnail dọc desktop/ngang mobile bằng Swiper, chuyển ảnh/video, dừng video khi đổi slide, phóng ảnh bằng dialog và đóng bằng Escape. Đồng bộ ảnh theo biến thể. Sửa margin Bootstrap gây tràn ngang mobile.
- **Mẫu/size, giá và số lượng**: gửi đúng variant ID, đổi giá khi chọn mẫu, cập nhật trạng thái hết hàng/tổ hợp không có thật, kiểm tra min/max/increment số lượng, khóa cả nút thêm giỏ và mua ngay khi lựa chọn không hợp lệ. Khi tắt JavaScript, dropdown native vẫn gửi đúng SKU.
- **Giỏ hàng**: giữ AJAX/section rendering của KS BootShop; sửa lỗi kẹt loading khi mất mạng, thông báo lỗi tồn kho và thời hạn chờ API 10 giây. Nếu Shopify không trả HTML giỏ hợp lệ, chuyển về route giỏ hàng native để đọc trạng thái thật. Không thử lại POST thêm giỏ tự động.
- **Phần dưới sản phẩm**: video/poster chế tác và năm câu hỏi thường gặp chỉnh được trong Theme Editor, kế tiếp khu vực gợi ý. Video chỉ tự phát khi nhìn thấy, luôn muted, dừng khi ra khỏi màn hình và không tự phát với reduced motion. Có điều khiển native.
- **Nội dung**: giá/mô tả/biến thể lấy từ Shopify; giữ app block hiện có. Tắt khối cam kết demo tiếng Anh trong product template. Nhãn nút tiếng Việt chỉnh được trong block mua hàng. FAQ mặc định là nội dung hướng dẫn liên hệ, không tự hứa phí dịch vụ, thời gian giao hoặc bảo hành chưa có trong cấu hình. Có thể chọn trang Shopify thật cho từng câu hỏi.

Không chỉnh `config/settings_data.json`, không tạo/xóa/sửa sản phẩm hay thay tồn kho trên Shopify.

## Kiểm thử có thể chạy lại

```sh
npm install
npx playwright install chromium
npm run test:helios-product
npm run test:helios
npx eslint assets/product.js assets/cart.js assets/helios-product.js
shopify theme check --no-input --output json
```

`test:helios-product` dựng **product-main, form, options, gallery, price, recommendations, editorial và footer thật** bằng LiquidJS, chạy `base.js`, `product.js`, `cart.js`, Bootstrap và Swiper của repository trên Chromium. Các endpoint `/cart/add.js`, `/cart/change.js`, `/cart`, `/checkout` và recommendations được giả lập **chỉ trên localhost**. Không gửi yêu cầu tạo giỏ/đơn thật tới Shopify.

Kiểm thử gồm chọn size/giá/variant ID/URL, min số lượng, thêm–sửa–xóa giỏ và counter, HTTP 422, lỗi mạng, request treo 10 giây, SKU/tổ hợp không khả dụng, zoom/Escape/video, accordion/FAQ, recommendation rỗng/lỗi/có dữ liệu, route mua ngay/thanh toán và chọn SKU khi tắt JavaScript. Chạy 390/1440 px, kiểm tra tràn ngang, lỗi runtime và axe WCAG 2/2.1 AA. Trang chủ chạy hồi quy ở 320/375/390/768/1440 px.

Dữ liệu test là giá, ID, lựa chọn và URL media công khai của `https://helios.vn/products/michigan-iced-out-ring`, chụp 30/10/2026 trong `tests/fixtures/helios-product-reference.json`. Chỉ dùng cục bộ, không được storefront đọc hoặc nhập vào cửa hàng. Các tình huống hết hàng/lỗi mạng được mô phỏng trong browser/test server. `HELIOS_PRODUCT_IMAGE_CACHE` có thể trỏ đến manifest cache ảnh; nếu không có cache, trình duyệt dùng URL ảnh công khai qua proxy hiện có. Không yêu cầu credential Shopify cho bộ test.

Ảnh render với dữ liệu tham chiếu: [desktop](helios-product-review/desktop.png) · [mobile](helios-product-review/mobile.png). Header/form/body là component của theme; app blocks và thanh toán của Shopify không được mô phỏng đầy đủ.

## Kết quả và giới hạn

Hai bộ kiểm thử đạt. Theme Check: **0 lỗi**, còn một cảnh báo `OrphanedSnippet` cho `product-custom-badge.liquid` có sẵn. ESLint và `git diff --check` đạt.

Shopify Admin vẫn trả **401** với binding hiện có. Vì vậy chưa xác nhận checkout/payment, app hoặc cập nhật trực tiếp trên theme đang chạy. Route thanh toán và payload mua hàng đã được kiểm tra bằng server localhost; không phải một giao dịch thật.

Video/poster thương hiệu lấy từ trang sản phẩm tham chiếu: `https://helios.vn/cdn/shop/videos/c/vp/c9f006cb17ef468da3ab4d6b24ea7d05/c9f006cb17ef468da3ab4d6b24ea7d05.HD-720p-4.5Mbps-95845063.mp4?v=0` và `https://helios.vn/cdn/shop/files/preview_images/c9f006cb17ef468da3ab4d6b24ea7d05.thumbnail.0000000000.jpg?v=1790653802&width=1600`.
