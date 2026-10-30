# HELIOS trên KS BootShop

Bản tham chiếu: https://helios.vn/, kiểm tra bằng Chromium ngày 30/10/2026 ở 1440×1000 và 390×844. Giữ nền tảng KS BootShop và dữ liệu bán hàng Shopify; cập nhật giao diện qua nhánh `feat/helios-homepage`.

## Giao diện và tương tác

- Font thân trang **SVN Futura Regular**, tiêu đề **UTM Copperplate**, tải từ chính các tệp mà trang HELIOS đang dùng và lưu trong assets. Nền `#000`, chữ `#d2d2d2`, thanh thông báo `#fab320` lấy từ trang tham chiếu.
- Thanh thông báo tự chuyển mỗi 5 giây, chữ fade/trượt nhẹ 450 ms, nút dừng/tiếp tục hiện khi rê chuột hoặc focus. Header chồng lên banner ở trang chủ, logo giữa và nền hoàn toàn trong suốt; đổi nền đen khi hover, mở menu hoặc focus bàn phím, trở lại trong suốt khi rời thanh menu. Desktop mở mega menu ba nhóm cùng hai ảnh khi hover; DISCOVER có dropdown riêng. Mobile dùng menu cuộn và accordion nhóm sản phẩm. Hỗ trợ Escape, bàn phím và liên kết khi tắt JavaScript.
- Ba banner desktop/mobile Withered Jack, Signature Collections, Chu Tước. Hòa trộn chồng ảnh (crossfade) 1.400 ms, giữ ảnh cũ ở dưới để không nháy đen; mặc định tự chuyển sau **7 giây** theo cấu hình trang tham chiếu. Chấm điều hướng, nút dừng/tiếp tục; vẫn tự chuyển khi để chuột trên ảnh, dừng khi focus bàn phím, tab bị ẩn hoặc chọn block trong Theme Editor. Tôn trọng chế độ giảm chuyển động.
- Sản phẩm lấy từ bộ sưu tập được chọn hoặc `collections.all`. Desktop bốn cột/tám sản phẩm, mobile hai cột/bốn sản phẩm. Ảnh thứ hai crossfade khi hover, tiêu đề Copperplate, giá/biến thể thực của Shopify. Badge và đánh giá chỉ xuất hiện khi sản phẩm có dữ liệu tương ứng. Catalog trống không tạo thẻ hoặc sản phẩm mẫu.
- Sáu ảnh danh mục tràn viền: hai cột desktop, một cột mobile; thứ tự và tỷ lệ theo trang tham chiếu. Trên mobile hai ảnh đầu 4:5, bốn ảnh sau 2:3; desktop ảnh vuông. Hover phóng ảnh nhẹ. Đã bỏ tiêu đề phụ và khoảng trắng không có trên trang gốc.
- Newsletter có ảnh nền đúng trang gốc, dùng form khách hàng Shopify với tag `newsletter`, xử lý phản hồi lỗi/thành công. Footer bốn cột desktop/một cột mobile, thông tin thương hiệu, menu hỗ trợ, mạng xã hội và liên kết đến hồ sơ đăng ký công khai của **helios.vn**.
- Tìm kiếm và giỏ hàng dùng drawer Bootstrap/KS BootShop hiện có, có route dự phòng khi không chạy JavaScript. Collection, bộ lọc, sản phẩm, tài khoản và form thanh toán tiếp tục dùng các thành phần bán hàng của KS BootShop.
- Trang sản phẩm dùng gallery/thumb dọc trên desktop và accordion thông tin theo trang tham chiếu. Có tùy chọn tab ngang trong Theme Editor, hỗ trợ phím trái/phải/Home/End. Nội dung lấy từ mô tả sản phẩm, block và các trang chính sách hiện có; không tạo chính sách giả hoặc dữ liệu đánh giá giả.
- Reveal ảnh/chữ khi cuộn, underline menu, hover ảnh và chuyển trang chiếu dùng CSS/Web Animations; không thêm thư viện JavaScript vào storefront.

Section câu chuyện lớn của bản trước được giữ để bật tùy ý trong Theme Editor, mặc định tắt vì trang chủ tham chiếu không có section đó. Câu chuyện thương hiệu vẫn có ở footer và liên kết `#helios-story`.

## Cấu hình dữ liệu

Chọn menu, các trang Feedback/Collab/cửa hàng, bộ sưu tập và ảnh thay thế trong các section **HELIOS**. Nếu chưa có collection/page tương ứng, theme dùng route tìm kiếm Shopify phù hợp thay vì dựng URL 404. Nội dung tài khoản/ngôn ngữ phụ thuộc cấu hình thật của cửa hàng.

`config/settings_data.json` không bị ghi đè. Không tạo, xóa hay thay giá sản phẩm. Không sao chép cấu hình app, mã theo dõi, dữ liệu thành viên hoặc đánh giá từ helios.vn sang cửa hàng đích. Theme không thể tự tạo nội dung trang chính sách hay cài ứng dụng của cửa hàng tham chiếu qua GitHub.

## Kiểm thử

```sh
npm install
npx playwright install chromium
npm run test:helios
npx eslint assets/base.js assets/cart.js assets/collection.js assets/custom.js assets/product.js assets/search.js assets/sections.js assets/helios.js
shopify theme check --no-input --output json
```

Linux thiếu thư viện hệ thống: `npx playwright install --with-deps chromium`. Bộ test cần mở cổng loopback và chạy Chromium. `HELIOS_TEST_ARTIFACTS` đổi thư mục lưu ảnh, mặc định `/tmp/helios-test-artifacts`.

Bộ test dựng section bằng LiquidJS, kiểm tra JSON/CSS, font, nền đen, hình học banner, cột danh mục, menu hover/bàn phím, carousel/chấm điều hướng, tự chạy 7 giây và các điều kiện dừng, tìm kiếm, khung giỏ hàng Bootstrap, form nhận tin, tab ngang, reduced motion, no-JavaScript fallback, lỗi runtime và axe WCAG 2/2.1 AA ở 320/375/390/768/1440 px.

### Kiểm thử ảnh sản phẩm tham chiếu

`tests/fixtures/helios-reference-products.json` chứa tên/giá/URL ảnh của tám sản phẩm **công khai thật** được chụp từ helios.vn. Chỉ bộ test cục bộ đọc tệp này khi bật rõ ràng:

```sh
HELIOS_REFERENCE_CATALOG=1 npm run test:helios
```

Mặc định bộ test dùng catalog trống. Storefront Liquid không đọc fixture, không có lệnh nhập fixture vào Shopify. Có thể đặt `HELIOS_REFERENCE_IMAGE_CACHE` đến thư mục cache ảnh để test offline; nếu không đặt, trình duyệt tải ảnh công khai qua proxy hiện có khi có cấu hình. Dữ liệu này phục vụ so sánh bố cục, không phải bằng chứng rằng catalog cửa hàng đích trùng trang tham chiếu.

Ảnh duyệt: [desktop](helios-review/desktop.png), [mobile](helios-review/mobile.png), [mega menu](helios-review/menu.png). Đây là ảnh render component cục bộ với dữ liệu tham chiếu; giá và nội dung thực trên cửa hàng lấy từ Shopify của chủ cửa hàng.

### Kết quả và giới hạn

Theme Check 5.0.0: **0 lỗi**, còn một cảnh báo `OrphanedSnippet` cho `product-custom-badge.liquid` có sẵn. Đã sửa chín schema dùng khóa `templates` cũ, thẻ đóng sai trong page template, thuộc tính ảnh gift card và script chặn parser; QR gift card khởi tạo sau khi script defer tải xong. Thêm section Apps chuẩn để giữ các app block hiện có.

LiquidJS/Chromium cục bộ không thay thế Shopify runtime. Shopify Admin/endpoint catalog cửa hàng đích vẫn trả HTTP 401 trong phiên kiểm tra; chưa kiểm chứng checkout, submit newsletter, app hay biến thể trên cửa hàng đích. Khi có quyền hợp lệ, cần kiểm tra lại các chức năng này trên Shopify. Không có lệnh tải theme hoặc xuất bản Shopify; thay đổi được đẩy lên GitHub theo yêu cầu.

Đã đo và đối chiếu giao diện/tương tác nêu trên. Chưa xác nhận trùng từng pixel trong mọi trình duyệt, mọi trang nội dung hay trạng thái app của cửa hàng thật.

## Nguồn nhận diện

Tệp được tải từ tài nguyên công khai của HELIOS ngày 30/10/2026, giữ trong `assets/` để tránh hotlink khi khách mở storefront:

- Futura: `https://cdn.shopify.com/s/files/1/0644/2958/8701/files/SVN-Futura-Regular_bb365d62-16a8-43b2-ad15-c2d7f7f89c26.woff2?v=1736240196`.
- Copperplate: `https://cdn.shopify.com/s/files/1/0644/2958/8701/files/UTM_CopperplateB_fd3f2034-850b-448d-b6dd-8584712ee544.ttf?v=1785750960`.
- Logo: `https://helios.vn/cdn/shop/files/logo-w.webp?v=1739845232&width=500`.
- Withered Jack desktop/mobile: `1792214586807_2359740545583841509_g8350574569212514233_ec5911f747452a3da38f9a89ae502594.jpg` / `1792215672930_2359740545583841509_g8350574569212514233_376533b719882ef3e7726dfd39ec78b4.jpg` trên `https://helios.vn/cdn/shop/files/`.
- Signature: `banner_copy2.jpg` / `banner_copy.jpg`; Chu Tước: `banner_19.9_optimized_2.webp` / `banner_4.5_optimized.webp` cùng CDN.
- Sáu danh mục: `1_optimized.webp` … `6_optimized.webp?v=1789469983&width=800`.
- Ảnh menu/câu chuyện: `z7748804682457_8bf676db49e4c1d1f0f30e5ca28bcfca.jpg` và `z7748796188191_d8eb292563a0133b9e58e2a2da25e8fe.jpg`.
- Newsletter: `DANG_KY_NHAN_THONG_TIN.jpg?v=1786673176&width=1900`; ảnh liên kết hồ sơ đăng ký: `bo-cong-thuong.png?v=1768454208&width=310`.
