# Trang chủ HELIOS trên KS BootShop

Tham chiếu: https://helios.vn/, đọc ngày 30/10/2026. Thay trang chủ demo và nhóm header/footer bằng các section HELIOS, giữ nguyên nền tảng KS BootShop và các template bán hàng.

## Các phần có thể cấu hình

- **HELIOS · Header**: thanh vàng hotline/email, thông báo có nút trước/sau, liên kết hệ thống cửa hàng; hàng menu NEW IN / FEEDBACK / COLLAB / DISCOVER, logo giữa màn hình desktop, ngôn ngữ và tài khoản. Chọn các trang Feedback/Collab/cửa hàng có sẵn trong Theme Editor; nếu chưa có trang thì dùng tìm kiếm trang Shopify. Logo và menu Shopify có thể thay thế. Nếu chưa chọn menu, hiển thị các bộ sưu tập thực tế đang có sản phẩm cùng các route Shopify chuẩn. Hỗ trợ menu ba cấp, tìm kiếm, tài khoản và ngăn giỏ hàng KS BootShop.
- **HELIOS · Banner**: ba bộ ảnh Withered Jack (banner đầu), Signature Collections và Chu Tước, ảnh desktop/mobile độc lập, có thể thay từng ảnh và chọn bộ sưu tập đích. Tự chuyển mỗi 5 giây mặc định; có thể đặt 0 để tắt hoặc chọn 1–10 giây trong Theme Editor. Có nút tạm dừng/tiếp tục; vẫn chạy khi rê chuột trên ảnh hoặc nút điều khiển, tự dừng khi focus bàn phím, tab ẩn hoặc chọn block trong Theme Editor. Không tự chạy khi người dùng bật giảm chuyển động. Nếu chưa chọn bộ sưu tập thì dẫn đến tất cả sản phẩm.
- **HELIOS · Sản phẩm**: chọn bộ sưu tập và số lượng 4/8/12. Mặc định lấy `collections.all.products` của cửa hàng. Dùng nguyên `product-card`, giá, biến thể, trạng thái tồn kho và `product-form` của KS BootShop. Không dựng thẻ sản phẩm mẫu khi danh mục trống.
- **HELIOS · Bộ sưu tập**: sáu ô hình ảnh; chọn bộ sưu tập thực tế cho từng ô trong trình chỉnh sửa giao diện. Nếu chưa chọn, liên kết tìm kiếm theo từ khóa tương ứng, không giả định cửa hàng có các handle của helios.vn. Ô sản phẩm mới dùng danh sách sản phẩm sắp xếp mới nhất.
- **HELIOS · Câu chuyện**: ảnh, tiêu đề, nội dung và trang Shopify có sẵn. Khi chưa chọn trang, nút dẫn đến tất cả sản phẩm. Liên kết “Câu chuyện HELIOS” trong menu dẫn tới section này trên trang chủ.
- **HELIOS · Footer**: form đăng ký khách hàng Shopify có thẻ `newsletter`, phản hồi thành công/lỗi, menu hỗ trợ, trang liên hệ và thông tin doanh nghiệp. Các chính sách chỉ xuất hiện khi cửa hàng thực sự có nội dung chính sách. Thông tin doanh nghiệp mặc định lấy từ trang HELIOS tham chiếu; chủ cửa hàng cần xác nhận trước khi triển khai.

`config/settings_data.json`, sản phẩm, bộ sưu tập và menu trên Shopify không bị sửa. Các template sản phẩm, giỏ hàng, tìm kiếm và checkout không bị thay thế. Màu sắc HELIOS được áp dụng qua lớp CSS trên layout; vẫn giữ CSS/JavaScript Bootstrap và KS BootShop. Không có lệnh ghi sản phẩm hay xuất bản theme.

## Kiểm thử

```sh
npm install
npx playwright install chromium
npm run test:helios
npx eslint assets/base.js assets/cart.js assets/collection.js assets/custom.js assets/product.js assets/search.js assets/sections.js assets/helios.js
shopify theme check --no-input --output json
```

Trên Linux thiếu thư viện hệ thống, dùng `npx playwright install --with-deps chromium`. Trong môi trường hạn chế sandbox, cần quyền mở cổng loopback và chạy Chromium cho bài kiểm thử cục bộ.

`npm run test:helios` dựng các section bằng LiquidJS, kiểm tra cấu hình JSON/CSS, danh mục trống, route bộ sưu tập, banner đúng kích thước, thao tác menu bằng bàn phím, chuyển banner thủ công và tự động sau 5 giây, dừng/tiếp tục khi chuột vẫn trên nút, autoplay khi hover, focus bàn phím và reduced-motion, mở/đóng ngăn giỏ hàng Bootstrap, dữ liệu form nhận tin, chế độ giảm chuyển động và dự phòng khi tắt JavaScript. Chạy Chromium ở 320/375/390/768/1440 px, kiểm tra axe WCAG 2/2.1 AA và lỗi JavaScript. Ảnh kết quả nằm ở `/tmp/helios-test-artifacts` hoặc thư mục `HELIOS_TEST_ARTIFACTS`.

LiquidJS trong bài kiểm thử chỉ mô phỏng các bộ lọc/tag cần cho section, form khách hàng và khung giỏ hàng. Đây **không phải** bản render đầy đủ của Shopify; không kiểm chứng submit nhận tin, thêm sản phẩm thật, giá/biến thể thật, thanh toán hoặc app của cửa hàng. Không có sản phẩm giả trong dữ liệu kiểm thử hay theme.

Kết quả Theme Check 5.0.0: **13 lỗi và 1 cảnh báo có sẵn**, giống hoàn toàn trước khi thay đổi, không có lỗi mới trong phần HELIOS. Các nhóm lỗi gốc: `LiquidHTMLSyntaxError` (`templates/page.liquid` đóng `section` thay vì `article`), `ValidSchema` (9 thuộc tính `templates` cũ), `ImgWidthAndHeight`, `ParserBlockingScript`; cảnh báo `OrphanedSnippet`. Lệnh vẫn trả mã thoát 1, không được xem là toàn theme đã đạt kiểm tra.

Kiểm tra chỉ đọc `shopify theme list` nhận HTTP **401 Invalid API key or access token**. Cửa hàng công khai chuyển đến trang mật khẩu. Chưa kiểm thử trên cửa hàng, chưa tải theme lên Shopify, chưa xuất bản. Cần mật khẩu Theme Access hợp lệ trong cài đặt môi trường trước khi kiểm thử thương mại trên development theme đã được cho phép. Với CLI 5 trong môi trường proxy này, truyền `SHOPIFY_HTTP_PROXY="$HTTP_PROXY" SHOPIFY_HTTPS_PROXY="$HTTPS_PROXY"` để dùng proxy hiện có; không tắt TLS, không đưa mật khẩu vào lệnh hoặc Git.

## Ảnh để duyệt

Ảnh dưới là bản render component cục bộ **không có dữ liệu sản phẩm cửa hàng**; section sản phẩm tự ẩn đúng thiết kế. Không dùng sản phẩm mẫu để lấp khoảng trống. Khi kết nối được Shopify, section sản phẩm sẽ lấy catalog đã nhập.

[Desktop 1440 px](helios-review/desktop.png) · [Mobile 390 px](helios-review/mobile.png)

## Nguồn ảnh

Ảnh thương hiệu được tải từ các URL công khai có trong HTML của https://helios.vn/ ngày 30/10/2026, lưu trong `assets/` để không phụ thuộc hotlink lúc chạy theme. Không tải danh mục sản phẩm từ trang tham chiếu vào cửa hàng.

| Tệp trong theme | Nguồn (`https://helios.vn/cdn/shop/files/`) |
| --- | --- |
| `helios-logo.webp` | `logo-w.webp?v=1739845232&width=500` |
| `helios-favicon.jpg` | `464413022_945803257578038_2084379289906124096_n.jpg?crop=center&height=48&v=1764122552&width=48` |
| `helios-jack-desktop.jpg` | `1792214586807_2359740545583841509_g8350574569212514233_ec5911f747452a3da38f9a89ae502594.jpg?v=1792216997&width=2000` |
| `helios-jack-mobile.jpg` | `1792215672930_2359740545583841509_g8350574569212514233_376533b719882ef3e7726dfd39ec78b4.jpg?v=1792216996&width=800` |
| `helios-hero-desktop.jpg` | `banner_copy2.jpg?v=1791603985&width=2000` |
| `helios-hero-mobile.jpg` | `banner_copy.jpg?v=1791603985&width=800` |
| `helios-bird-desktop.webp` | `banner_19.9_optimized_2.webp?v=1789708979&width=2000` |
| `helios-bird-mobile.webp` | `banner_4.5_optimized.webp?v=1789708979&width=800` |
| `helios-category-1.webp` … `helios-category-6.webp` | `1_optimized.webp` … `6_optimized.webp`, `?v=1789469983&width=800` |
| `helios-story.jpg` | `z7748804682457_8bf676db49e4c1d1f0f30e5ca28bcfca.jpg?v=1776767409&width=1000` |

Ảnh dưới màn hình đầu tải lazy; banner đầu được ưu tiên tải. Mobile dùng ảnh 4:5 riêng, thay vì cắt banner desktop. Autoplay có kiểm soát và tôn trọng giảm chuyển động; không thêm thư viện JavaScript vào storefront. Giữ quyền sử dụng ảnh/nhận diện HELIOS phù hợp trước khi đưa vào vận hành.
