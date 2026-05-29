# ỨNG DỤNG TRÍ TUỆ NHÂN TẠO VÀO HỆ THỐNG THỬ ĐỒ ẢO CHO TRANG PHỤC ÁO DÀI TRONG THƯƠNG MẠI THỜI TRANG

**Loại công trình:** Báo cáo nghiên cứu khoa học ứng dụng  
**Lĩnh vực:** Trí tuệ nhân tạo, thị giác máy tính, thương mại điện tử thời trang  
**Ngày cập nhật:** 20/05/2026  
**Nền tảng triển khai tham chiếu:** IDM-VTON, web demo và Colab API bridge trong repository hiện tại  
**Đóng góp mới của nhóm:** Thu thập và phân tích khoảng 100 mẫu áo dài để xây dựng bộ dữ liệu thử nghiệm, chuẩn hóa thuộc tính trang phục và làm cơ sở cho huấn luyện/tinh chỉnh mô hình thử đồ ảo.

## Tóm tắt công trình

Thử đồ ảo bằng trí tuệ nhân tạo là một hướng ứng dụng cho phép người dùng xem trước hình ảnh bản thân mặc một sản phẩm thời trang dựa trên ảnh người và ảnh trang phục. Trong bối cảnh thương mại điện tử, công nghệ này có ý nghĩa thực tiễn vì người mua trực tuyến thường không thể mặc thử sản phẩm trước khi quyết định. Với trang phục áo dài, bài toán còn khó hơn do áo dài có cấu trúc đặc thù như cổ cao, tay dài, tà áo, họa tiết thêu/in và sự kết hợp giữa áo với quần. Những đặc điểm này khiến các mô hình thử đồ ảo huấn luyện trên dữ liệu thời trang phổ thông có thể không giữ đúng hình dáng và bản sắc trang phục.

Công trình này nghiên cứu khả năng ứng dụng mô hình thử đồ ảo dựa trên trí tuệ nhân tạo vào website thời trang, lấy IDM-VTON làm nền tảng kỹ thuật tham chiếu và áo dài làm trường hợp ứng dụng cụ thể. Đóng góp mới của nhóm là thu thập khoảng 100 mẫu áo dài, phân tích các thuộc tính thị giác của từng mẫu, xây dựng cấu trúc dữ liệu phục vụ thử nghiệm và đề xuất quy trình chuẩn hóa dữ liệu để có thể huấn luyện hoặc tinh chỉnh mô hình trong các giai đoạn tiếp theo.

Kết quả chính của công trình gồm ba nhóm. Thứ nhất, công trình đề xuất phương án triển khai hệ thống thử đồ ảo gồm giao diện web, server local, API bridge trên Colab hoặc máy có GPU và pipeline suy luận IDM-VTON. Thứ hai, công trình xây dựng khung dữ liệu áo dài với các nhãn như kiểu cổ, kiểu tay, màu chủ đạo, họa tiết, độ dài tà, mức độ phức tạp hoa văn và trạng thái paired/unpaired. Thứ ba, công trình đề xuất bộ tiêu chí đánh giá gồm độ trung thực trang phục, độ tự nhiên của ảnh, thời gian xử lý, lỗi vùng biên, mức độ hữu ích với người dùng, niềm tin khi mua hàng và mức độ chấp nhận tải ảnh cá nhân.

Ý nghĩa khoa học của công trình nằm ở việc hệ thống hóa cơ sở công nghệ thử đồ ảo bằng mô hình khuếch tán, đồng thời đưa ra hướng bản địa hóa dữ liệu cho trang phục áo dài Việt Nam. Ý nghĩa thực tiễn nằm ở khả năng phát triển thành demo hỗ trợ mua sắm thời trang trực tuyến, phục vụ nghiên cứu, giảng dạy, thử nghiệm sản phẩm số và tạo nền tảng dữ liệu ban đầu cho các nghiên cứu huấn luyện mô hình thử đồ áo dài.

**Từ khóa:** trí tuệ nhân tạo; thử đồ ảo; virtual try-on; áo dài; diffusion model; IDM-VTON; bộ dữ liệu thời trang; thương mại điện tử.

## 1. Đặt vấn đề

### 1.1. Sự cần thiết của đề tài

Thương mại điện tử đã thay đổi cách người tiêu dùng tiếp cận sản phẩm thời trang. Người mua có thể xem nhiều mẫu mã, so sánh giá và đặt hàng mà không cần đến cửa hàng. Tuy nhiên, thời trang là nhóm sản phẩm phụ thuộc mạnh vào cảm nhận trực quan và độ phù hợp với từng cơ thể. Một chiếc áo có thể trông đẹp trên ảnh người mẫu nhưng không phù hợp với người mua do khác biệt về vóc dáng, màu da, tư thế, phong cách hoặc cách phối đồ. Vì vậy, việc mua quần áo trực tuyến thường đi kèm sự bất định cao hơn so với mua tại cửa hàng.

Sự bất định này tạo ra hai vấn đề. Về phía người dùng, họ thiếu cơ sở trực quan để quyết định sản phẩm có phù hợp với mình hay không. Về phía doanh nghiệp, thiếu trải nghiệm thử đồ có thể làm giảm tỷ lệ chuyển đổi và góp phần làm tăng tỷ lệ hoàn trả. National Retail Federation (2024) cho biết tổng giá trị hàng hóa bị hoàn trả trong ngành bán lẻ Hoa Kỳ năm 2024 được dự báo đạt 890 tỷ USD. Số liệu này không đồng nghĩa mọi trường hợp hoàn trả đều do thiếu công cụ thử đồ, nhưng cho thấy hoàn trả là một chi phí lớn và việc giảm sai lệch kỳ vọng trước khi mua có giá trị thực tiễn.

Trong bối cảnh đó, thử đồ ảo bằng trí tuệ nhân tạo trở thành một giải pháp đáng nghiên cứu. Công nghệ này cho phép người dùng tải ảnh cá nhân và xem ảnh mô phỏng khi mặc một trang phục cụ thể. Nếu được triển khai tốt, hệ thống có thể hỗ trợ người dùng hình dung sản phẩm trực quan hơn, tăng niềm tin khi mua hàng và tạo trải nghiệm cá nhân hóa cho website thời trang.

### 1.2. Lý do chọn đề tài

Đề tài được lựa chọn vì ba lý do chính.

Thứ nhất, thử đồ ảo là một bài toán ứng dụng rõ ràng của trí tuệ nhân tạo trong thương mại điện tử. Công nghệ này không chỉ có ý nghĩa trình diễn, mà còn gắn với bài toán kinh doanh cụ thể: giúp người dùng lựa chọn sản phẩm tốt hơn và hỗ trợ doanh nghiệp cải thiện trải nghiệm mua sắm.

Thứ hai, lĩnh vực thử đồ ảo đang phát triển nhanh nhờ các mô hình sinh ảnh, đặc biệt là diffusion model. Các công trình gần đây như TryOnDiffusion, StableVITON, IDM-VTON và CatVTON cho thấy chất lượng ảnh thử đồ đã tiến gần hơn tới yêu cầu sử dụng thực tế. Điều này tạo điều kiện cho sinh viên và nhóm nghiên cứu xây dựng demo ứng dụng mà không cần huấn luyện mô hình từ đầu.

Thứ ba, repository IDM-VTON hiện tại đã có nhiều thành phần phù hợp để phát triển đề tài: mã nguồn suy luận, pipeline model, demo Gradio, web demo và API bridge có thể chạy qua Colab. Vì vậy, đề tài có tính khả thi cao trong điều kiện thiết bị hạn chế. Nhóm nghiên cứu có thể tập trung vào tích hợp hệ thống, đánh giá chất lượng kết quả và khảo sát người dùng.

Thứ tư, áo dài là loại trang phục có ý nghĩa văn hóa và cấu trúc thị giác riêng, nhưng không phải trọng tâm của phần lớn bộ dữ liệu thử đồ ảo quốc tế. Việc nhóm tự thu thập khoảng 100 mẫu áo dài và phân tích thuộc tính trang phục giúp đề tài có đóng góp riêng, thay vì chỉ dừng ở việc chạy lại một mô hình có sẵn.

### 1.3. Vấn đề nghiên cứu

Công trình tập trung vào câu hỏi nghiên cứu chính:

**Hệ thống thử đồ ảo dựa trên mô hình IDM-VTON, khi được bổ sung bộ dữ liệu áo dài do nhóm thu thập và phân tích, có thể hỗ trợ người dùng hình dung sản phẩm áo dài và cải thiện trải nghiệm mua sắm trực tuyến ở mức nào?**

Từ câu hỏi chính, công trình đặt ra các câu hỏi phụ:

1. Những thành phần kỹ thuật nào cần có trong một hệ thống thử đồ ảo dựa trên ảnh 2D?
2. Các công trình nghiên cứu trước đây đã giải quyết bài toán thử đồ ảo như thế nào?
3. Bộ dữ liệu khoảng 100 mẫu áo dài cần được phân tích và chuẩn hóa như thế nào để phục vụ thử nghiệm hoặc huấn luyện/tinh chỉnh mô hình?
4. IDM-VTON có điểm phù hợp và hạn chế gì khi triển khai thành demo web cho trang phục áo dài?
5. Hệ thống cần được đánh giá bằng những tiêu chí kỹ thuật và trải nghiệm người dùng nào?
6. Những rủi ro đạo đức, quyền riêng tư và sai lệch thương mại nào cần kiểm soát?

## 2. Tổng quan tài liệu

### 2.1. Khái quát về thử đồ ảo

Thử đồ ảo là nhóm công nghệ cho phép người dùng xem trước sản phẩm thời trang trên cơ thể trong môi trường số. Có nhiều hướng tiếp cận khác nhau, gồm thử đồ dựa trên ảnh 2D, thử đồ dựa trên mô hình cơ thể 3D, thử đồ bằng thực tế tăng cường và hệ thống gợi ý kích thước. Trong phạm vi công trình này, hướng được tập trung là image-based virtual try-on, tức sử dụng ảnh người và ảnh trang phục làm đầu vào để sinh ảnh kết quả.

Một hệ thống thử đồ ảo dựa trên ảnh thường có các thành phần: phân đoạn cơ thể người, ước lượng tư thế hoặc ánh xạ bề mặt cơ thể, tạo biểu diễn người dùng không phụ thuộc trang phục cũ, mã hóa trang phục mới, căn chỉnh trang phục theo cơ thể và sinh ảnh cuối cùng. Các thành phần này phối hợp để giải quyết một bài toán khó: giữ nguyên danh tính người mặc, giữ đúng chi tiết trang phục và tạo ảnh tự nhiên.

### 2.2. Các giải pháp khoa học đã được giải quyết ở nước ngoài

VITON là một công trình nền tảng trong lĩnh vực image-based virtual try-on. Han và đồng tác giả (2018) đề xuất một mạng thử đồ ảo không cần mô hình 3D, sử dụng biểu diễn clothing-agnostic của người mặc và quá trình tổng hợp ảnh theo hướng coarse-to-fine. Công trình này đặt nền móng cho nhiều pipeline thử đồ ảo sau đó, trong đó trang phục cũ được loại bỏ khỏi biểu diễn người dùng, trang phục mới được căn chỉnh và ảnh kết quả được sinh ra.

VITON-HD tiếp tục phát triển hướng này ở độ phân giải cao hơn. Choi và đồng tác giả (2021) đề xuất cơ chế misalignment-aware normalization để xử lý sai lệch giữa trang phục đã căn chỉnh và cơ thể người mặc. Đây là một bước tiến quan trọng vì ảnh thương mại điện tử cần độ phân giải đủ cao để người dùng quan sát chi tiết sản phẩm. Tuy nhiên, các phương pháp dựa nhiều vào warping vẫn có thể gặp lỗi khi trang phục có logo, chữ, họa tiết nhỏ hoặc khi tư thế người mặc phức tạp.

Sự xuất hiện của diffusion model tạo ra bước chuyển mới. Zhu và đồng tác giả (2023) đề xuất TryOnDiffusion, một hệ thống dùng kiến trúc hai UNet để học quá trình biến dạng và sinh ảnh trong một pipeline thống nhất hơn. Morelli và đồng tác giả (2023) phát triển LaDI-VTON bằng cách đưa bài toán vào latent diffusion và dùng textual inversion để biểu diễn thông tin trang phục. Kim và đồng tác giả (2024) giới thiệu StableVITON, khai thác semantic correspondence trong latent diffusion nhằm tăng khả năng giữ tương ứng giữa cơ thể và trang phục.

IDM-VTON của Choi và đồng tác giả (2024) trực tiếp liên quan đến công trình này. Tác giả nhận định rằng các mô hình diffusion inpainting có thể tạo ảnh tự nhiên nhưng vẫn khó giữ đúng chi tiết trang phục. IDM-VTON giải quyết vấn đề bằng hai luồng mã hóa trang phục: đặc trưng ngữ nghĩa mức cao được đưa vào cross-attention, còn đặc trưng mức thấp được đưa vào self-attention thông qua Parallel-UNet. Cách thiết kế này hướng tới việc vừa giữ tính chân thực của ảnh vừa bảo toàn chi tiết trang phục.

Gần đây, CatVTON của Chong và đồng tác giả (2024/2025) cho thấy xu hướng đơn giản hóa pipeline. Thay vì phụ thuộc nặng vào nhiều module tiền xử lý như pose estimation, human parsing hoặc captioning, CatVTON khai thác chiến lược nối ảnh người và ảnh trang phục làm điều kiện đầu vào cho diffusion model. Hướng tiếp cận này đáng chú ý vì trong triển khai thực tế, càng nhiều module trung gian thì càng nhiều điểm có thể phát sinh lỗi.

### 2.3. Tình hình nghiên cứu và ứng dụng trong nước

Tại Việt Nam, các ứng dụng thương mại điện tử thời trang đã phát triển mạnh, nhưng tính năng thử đồ ảo bằng mô hình sinh ảnh vẫn chưa phổ biến ở mức sản phẩm đại trà. Một số nền tảng có thể có tính năng gợi ý kích thước, bộ lọc sản phẩm hoặc hiển thị ảnh người mẫu, nhưng hệ thống cho phép người dùng tải ảnh cá nhân và sinh ảnh thử đồ bằng AI còn hạn chế. Nguyên nhân có thể đến từ chi phí GPU, yêu cầu bảo mật dữ liệu cá nhân, thiếu bộ dữ liệu phù hợp với người dùng Việt Nam và độ ổn định của mô hình trong môi trường thực tế.

Riêng với áo dài, khoảng trống dữ liệu càng rõ hơn. Áo dài có tà dài, cổ cao, tay dài, dáng ôm và thường đi kèm họa tiết thêu, in hoặc hoa văn truyền thống. Những đặc điểm này khác với nhiều loại áo thông thường trong các bộ dữ liệu quốc tế. Vì vậy, nếu chỉ dùng model huấn luyện trên dữ liệu thời trang phổ thông, ảnh thử đồ áo dài có thể bị sai tà, mất họa tiết hoặc làm biến dạng phần cổ và tay áo.

Khoảng trống này tạo cơ hội cho nghiên cứu ứng dụng. Thay vì xây dựng mô hình từ đầu, nhóm nghiên cứu có thể tận dụng mô hình nguồn mở như IDM-VTON để xây dựng demo, đồng thời thu thập bộ dữ liệu áo dài riêng để phân tích, thử nghiệm và chuẩn bị cho huấn luyện/tinh chỉnh. Cách tiếp cận này giúp công trình có đóng góp cụ thể trong bối cảnh Việt Nam.

### 2.4. Những vấn đề còn tồn tại

Các nghiên cứu hiện có đã cải thiện đáng kể chất lượng ảnh thử đồ, nhưng vẫn còn nhiều vấn đề cần tiếp tục nghiên cứu.

Thứ nhất, độ trung thực của trang phục chưa luôn ổn định. Logo, chữ, hoa văn nhỏ, đường viền cổ áo và tay áo có thể bị biến dạng hoặc mất chi tiết sau khi sinh ảnh.

Thứ hai, độ tự nhiên của cơ thể người mặc vẫn là thách thức. Một số kết quả có thể làm thay đổi khuôn mặt, bàn tay, cổ, vai hoặc vùng tóc, gây cảm giác không thật.

Thứ ba, hệ thống chưa phản ánh chính xác cảm giác vật lý của quần áo. Ảnh thử đồ có thể cho biết trang phục trông như thế nào, nhưng không đảm bảo độ vừa, độ co giãn, độ dày hoặc chất liệu khi mặc thật.

Thứ tư, quyền riêng tư là vấn đề lớn. Ảnh người dùng có thể chứa khuôn mặt, cơ thể và bối cảnh cá nhân. Nếu hệ thống lưu trữ hoặc dùng lại ảnh mà không có sự đồng ý, rủi ro đạo đức và pháp lý sẽ tăng.

Thứ năm, chi phí suy luận cao gây khó khăn cho triển khai diện rộng. Diffusion model thường cần GPU mạnh, trong khi website thương mại cần thời gian phản hồi ngắn và khả năng phục vụ nhiều người dùng.

Thứ sáu, các bộ dữ liệu thử đồ ảo phổ biến chưa phản ánh đầy đủ trang phục truyền thống Việt Nam. Đây là vấn đề trực tiếp của công trình này. Nếu không có dữ liệu áo dài được thu thập và mã hóa thuộc tính, hệ thống chỉ chứng minh được khả năng chạy mô hình có sẵn, chưa thể hiện được đóng góp mới về dữ liệu và khả năng bản địa hóa mô hình.

### 2.5. Phương án giải quyết của nhóm tác giả

Nhóm tác giả đề xuất phương án nghiên cứu ứng dụng theo hướng xây dựng một hệ thống demo dựa trên IDM-VTON, gồm giao diện web local và API bridge chạy trên Colab hoặc máy có GPU. Điểm mới của phương án không chỉ nằm ở việc tích hợp mô hình, mà còn ở việc xây dựng bộ dữ liệu thử nghiệm áo dài do nhóm thu thập. Bộ dữ liệu này gồm khoảng 100 mẫu áo dài, được phân tích theo các thuộc tính thị giác và chuẩn hóa để phục vụ thử nghiệm, đánh giá và chuẩn bị cho huấn luyện/tinh chỉnh mô hình.

Phương án nghiên cứu tập trung vào:

1. Tích hợp mô hình IDM-VTON vào luồng sử dụng thực tế.
2. Thu thập, lọc và mã hóa thuộc tính khoảng 100 mẫu áo dài.
3. Chuẩn hóa dữ liệu theo cấu trúc có thể chuyển đổi sang định dạng huấn luyện của IDM-VTON/VITON-HD.
4. Xây dựng giao diện thử đồ dễ thao tác.
5. Thiết kế quy trình đánh giá kỹ thuật và khảo sát người dùng.
6. Ghi nhận lỗi thường gặp trên áo dài để đề xuất hướng cải tiến.
7. Áp dụng nguyên tắc bảo vệ dữ liệu cá nhân và minh bạch với người dùng.

Phương án này phù hợp với điều kiện nghiên cứu vì tận dụng nền tảng mã nguồn mở, giảm chi phí huấn luyện mô hình, đồng thời vẫn tạo được sản phẩm demo có thể kiểm chứng.

## 3. Mục tiêu - Phương pháp

### 3.1. Mục tiêu tổng quát

Mục tiêu tổng quát của công trình là nghiên cứu và đề xuất hệ thống thử đồ ảo dựa trên trí tuệ nhân tạo cho trang phục áo dài, sử dụng IDM-VTON làm mô hình kỹ thuật tham chiếu và bộ dữ liệu áo dài do nhóm thu thập làm đóng góp thực nghiệm ban đầu.

### 3.2. Mục tiêu cụ thể

Công trình có các mục tiêu cụ thể sau:

1. Tổng quan cơ sở lý thuyết và các công trình nghiên cứu liên quan đến thử đồ ảo.
2. Phân tích nguyên lý hoạt động và khả năng ứng dụng của IDM-VTON.
3. Thu thập khoảng 100 mẫu áo dài và phân tích các thuộc tính thị giác phục vụ thử đồ ảo.
4. Đề xuất cấu trúc dữ liệu áo dài có thể chuyển đổi sang quy trình train/fine-tune của IDM-VTON.
5. Đề xuất kiến trúc hệ thống thử đồ ảo gồm giao diện web, server local, API bridge và pipeline suy luận.
6. Xây dựng bộ tiêu chí đánh giá kết quả gồm tiêu chí kỹ thuật và tiêu chí người dùng.
7. Đề xuất quy trình thực nghiệm phù hợp với điều kiện triển khai của nhóm nghiên cứu.
8. Phân tích rủi ro đạo đức, quyền riêng tư và giới hạn sử dụng của hệ thống.

### 3.3. Đối tượng và phạm vi nghiên cứu

Đối tượng nghiên cứu là hệ thống thử đồ ảo dựa trên ảnh 2D, trong đó đầu vào gồm ảnh người và ảnh trang phục, đầu ra là ảnh mô phỏng người trong ảnh đầu vào mặc trang phục mới.

Phạm vi nghiên cứu tập trung vào áo dài, ưu tiên các mẫu áo dài nữ ở dạng ảnh sản phẩm hoặc ảnh người mặc có thể dùng để phân tích hình dáng, màu sắc, họa tiết và cấu trúc trang phục. Công trình không đi sâu vào mô phỏng vật lý vải, quét cơ thể 3D hoặc thử đồ thời gian thực bằng camera. Những hướng này có thể được xem là hướng phát triển tiếp theo.

### 3.4. Phương pháp nghiên cứu

Công trình sử dụng các phương pháp nghiên cứu sau:

**Phương pháp tổng quan tài liệu:** Thu thập và phân tích các công trình về virtual try-on, diffusion model và quản trị rủi ro AI. Các nguồn chính gồm bài báo hội nghị, bài arXiv, báo cáo tổ chức và tài liệu chính thống.

**Phương pháp phân tích hệ thống:** Phân tích repository IDM-VTON, xác định các thành phần có thể dùng cho demo, gồm pipeline inference, Gradio demo, web demo và Colab bridge.

**Phương pháp thu thập và phân tích dữ liệu:** Thu thập khoảng 100 mẫu áo dài từ nguồn được phép sử dụng hoặc nguồn do nhóm tự chuẩn bị. Mỗi mẫu được kiểm tra chất lượng ảnh, loại bỏ ảnh trùng/lỗi, sau đó gán nhãn thuộc tính như màu chủ đạo, kiểu cổ, kiểu tay, họa tiết, độ dài tà, mức độ phức tạp hoa văn và trạng thái paired/unpaired.

**Phương pháp thiết kế ứng dụng:** Đề xuất kiến trúc hệ thống gồm lớp giao diện, lớp server local, lớp API bridge và lớp mô hình.

**Phương pháp chuẩn bị huấn luyện/tinh chỉnh:** Chuẩn hóa ảnh áo dài về kích thước và cấu trúc thư mục phù hợp với pipeline IDM-VTON/VITON-HD. Với mẫu có ảnh người mặc tương ứng, dữ liệu được đánh dấu là paired; với mẫu chỉ có ảnh sản phẩm, dữ liệu được dùng cho đánh giá inference hoặc mở rộng thành unpaired set. Do số lượng khoảng 100 mẫu còn nhỏ, hướng phù hợp là fine-tune nhẹ hoặc thử nghiệm tiền xử lý, không huấn luyện mô hình từ đầu.

**Phương pháp thực nghiệm:** Chạy thử hệ thống với nhiều cặp ảnh người - áo dài, ghi nhận kết quả, thời gian xử lý và lỗi thường gặp.

**Phương pháp khảo sát người dùng:** Thiết kế bảng hỏi Likert 1-5 để đánh giá mức độ tự nhiên, độ đúng trang phục, mức độ hữu ích, niềm tin và lo ngại quyền riêng tư.

### 3.5. Công thức và cách tính chỉ số đánh giá

Công trình đề xuất một số chỉ số định lượng đơn giản để phục vụ thực nghiệm.

Công thức (1): Điểm trung bình của một tiêu chí khảo sát

`Điểm trung bình = (x1 + x2 + ... + xn) / n`

Trong đó, `xi` là điểm đánh giá của người tham gia thứ `i`, `n` là tổng số người tham gia khảo sát.

Công thức (2): Tỷ lệ kết quả có lỗi quan sát được

`Tỷ lệ lỗi = số kết quả có lỗi / tổng số kết quả thử nghiệm x 100%`

Trong đó, "lỗi" có thể là sai màu, mất logo, lệch cổ áo, biến dạng tay, lỗi mask hoặc thay đổi khuôn mặt.

Công thức (3): Thời gian xử lý trung bình

`Thời gian trung bình = tổng thời gian xử lý tất cả mẫu / số mẫu thử nghiệm`

Các công thức này không thay thế các chỉ số thị giác máy tính chuyên sâu như LPIPS, SSIM hoặc FID, nhưng phù hợp với giai đoạn demo ứng dụng và đánh giá người dùng quy mô nhỏ.

### 3.6. Quy trình xây dựng bộ dữ liệu áo dài

Bộ dữ liệu áo dài là đóng góp mới quan trọng của công trình. Quy trình xây dựng gồm năm bước.

**Bước 1: Thu thập dữ liệu.** Nhóm thu thập khoảng 100 mẫu áo dài. Mỗi mẫu ưu tiên có ảnh sản phẩm rõ mặt trước, nền ít nhiễu, màu sắc đủ sáng và độ phân giải đủ để quan sát họa tiết. Nếu có ảnh người mặc tương ứng, mẫu được đánh dấu là dữ liệu paired; nếu chỉ có ảnh áo dài riêng lẻ, mẫu được đánh dấu là dữ liệu unpaired hoặc garment-only.

**Bước 2: Lọc và chuẩn hóa chất lượng.** Các ảnh bị mờ, cắt mất phần tà áo, sai màu nghiêm trọng, trùng lặp hoặc có watermark lớn được loại bỏ hoặc đánh dấu cần xử lý. Ảnh còn lại được chuẩn hóa tên file, kích thước và thư mục lưu trữ.

**Bước 3: Gán nhãn thuộc tính áo dài.** Mỗi mẫu được mô tả bằng bộ thuộc tính gồm màu chủ đạo, kiểu cổ, kiểu tay, độ dài tà, loại họa tiết, mật độ hoa văn, chất liệu quan sát được và mức độ phức tạp của trang phục. Việc gán nhãn này giúp phân tích lỗi theo từng nhóm trang phục, thay vì chỉ đánh giá ảnh kết quả một cách cảm tính.

**Bước 4: Chuyển đổi sang cấu trúc huấn luyện.** Dữ liệu được tổ chức theo hướng có thể chuyển sang cấu trúc `train/image`, `train/cloth`, `train/image-densepose`, `train/agnostic-mask` và file JSON mô tả cặp ảnh nếu có đủ điều kiện. Đây là cấu trúc gần với cách các pipeline như VITON-HD và IDM-VTON sử dụng dữ liệu.

**Bước 5: Chia tập và kiểm tra khả năng huấn luyện.** Với khoảng 100 mẫu, tập dữ liệu có thể chia sơ bộ theo tỷ lệ 70% train, 15% validation và 15% test. Tuy nhiên, do quy mô còn nhỏ, mục tiêu hợp lý là fine-tune thử nghiệm, kiểm tra pipeline dữ liệu và đánh giá xu hướng lỗi, không khẳng định huấn luyện được một mô hình tổng quát.

Bảng 1 trình bày bộ thuộc tính đề xuất cho dữ liệu áo dài.

| Nhóm thuộc tính | Trường dữ liệu | Mục đích sử dụng |
|---|---|---|
| Nhận dạng mẫu | `sample_id`, `source`, `license_note` | Quản lý dữ liệu và kiểm tra quyền sử dụng |
| Màu sắc | `main_color`, `secondary_color` | Đánh giá lỗi sai màu sau thử đồ |
| Cấu trúc áo | `collar_type`, `sleeve_type`, `tail_length` | Phân tích lỗi cổ áo, tay áo và tà áo |
| Họa tiết | `pattern_type`, `pattern_density` | Đánh giá khả năng giữ hoa văn, thêu, in |
| Trạng thái dữ liệu | `paired_status`, `has_person_image`, `has_cloth_image` | Xác định mẫu dùng cho train, validation, test hoặc inference |
| Chất lượng ảnh | `resolution`, `background_quality`, `occlusion_level` | Lọc mẫu và giải thích lỗi model |

## 4. Kết quả - Thảo luận

### 4.1. Kết quả tổng quan công nghệ

Kết quả tổng quan cho thấy thử đồ ảo đã phát triển qua ba giai đoạn chính. Giai đoạn đầu tập trung vào ghép và biến dạng trang phục trong ảnh 2D. Giai đoạn tiếp theo nâng chất lượng ảnh và độ phân giải, tiêu biểu là VITON-HD. Giai đoạn gần đây sử dụng diffusion model để tăng độ chân thực và khả năng giữ chi tiết trang phục.

Bảng 2 trình bày tóm tắt một số công trình tiêu biểu.

| Công trình | Năm | Hướng tiếp cận | Đóng góp chính | Hạn chế liên quan |
|---|---:|---|---|---|
| VITON | 2018 | Image-based VTO | Đề xuất pipeline thử đồ ảo không cần 3D | Độ phân giải và chi tiết còn hạn chế |
| VITON-HD | 2021 | High-resolution VTO | Cải thiện ảnh độ phân giải cao và xử lý sai lệch căn chỉnh | Vẫn phụ thuộc nhiều vào warping |
| TryOnDiffusion | 2023 | Diffusion model | Học quá trình biến dạng và sinh ảnh trong hệ thống diffusion | Chi phí tính toán cao |
| LaDI-VTON | 2023 | Latent diffusion | Dùng textual inversion để biểu diễn trang phục | Phụ thuộc chất lượng điều kiện hóa |
| StableVITON | 2024 | Latent diffusion | Học semantic correspondence giữa cơ thể và trang phục | Cần kiểm soát tốt chi tiết nhỏ |
| IDM-VTON | 2024 | Diffusion-based VTO | Kết hợp đặc trưng mức cao và mức thấp để giữ chi tiết trang phục | Cần GPU và pipeline tiền xử lý |
| CatVTON | 2024/2025 | Simplified diffusion pipeline | Giảm phụ thuộc vào nhiều bước tiền xử lý | Cần đánh giá thêm trong từng bối cảnh triển khai |

### 4.2. Kết quả phân tích IDM-VTON

IDM-VTON phù hợp với công trình này vì có ba ưu điểm chính.

Thứ nhất, mô hình hướng tới bối cảnh "in the wild", tức xử lý ảnh thực tế với nhiều điều kiện khác nhau. Đây là yêu cầu quan trọng nếu hệ thống được đưa vào website cho người dùng tải ảnh cá nhân.

Thứ hai, kiến trúc của IDM-VTON quan tâm trực tiếp đến vấn đề giữ chi tiết trang phục. Theo Choi và đồng tác giả (2024), hệ thống dùng visual encoder để trích xuất đặc trưng ngữ nghĩa mức cao và Parallel-UNet để đưa đặc trưng mức thấp vào quá trình sinh ảnh. Cách kết hợp này nhằm giảm lỗi mất họa tiết, sai màu hoặc mất cấu trúc trang phục.

Thứ ba, repository hiện tại có sẵn các điểm vào triển khai. Các file `inference.py` và `inference_dc.py` phục vụ suy luận; `gradio_demo/` phục vụ demo local; `web_demo/` phục vụ giao diện web và proxy đến Colab bridge. Điều này giúp nhóm nghiên cứu có thể xây dựng demo mà không cần viết toàn bộ hệ thống từ đầu.

Tuy nhiên, IDM-VTON cũng có hạn chế. Mô hình cần checkpoint lớn và môi trường GPU phù hợp. Một số bước tiền xử lý như human parsing, DensePose hoặc mask có thể phát sinh lỗi. Ngoài ra, giấy phép CC BY-NC-SA 4.0 của mã nguồn và checkpoint cần được tôn trọng; hệ thống phù hợp cho nghiên cứu và demo phi thương mại hơn là triển khai thương mại trực tiếp.

### 4.3. Kết quả đề xuất kiến trúc hệ thống

Hình 1 mô tả luồng xử lý tổng quát của hệ thống đề xuất.

`Người dùng -> Giao diện web -> Server local -> API bridge trên Colab/GPU -> IDM-VTON pipeline -> Ảnh thử đồ -> Đánh giá kết quả`

Hệ thống gồm bốn lớp.

**Lớp giao diện người dùng:** Cho phép người dùng tải ảnh người, tải ảnh trang phục, nhập mô tả trang phục, bật hoặc tắt auto-mask, auto-crop, chọn seed và gửi yêu cầu thử đồ. Giao diện hiển thị ảnh đầu vào, ảnh mask preview và ảnh kết quả.

**Lớp server local:** Chạy `web_demo/server.py`, phục vụ file tĩnh và chuyển tiếp request đến bridge suy luận. Lớp này không cần tải mô hình nặng nên có thể chạy trên máy cá nhân.

**Lớp API bridge:** Chạy `web_demo/colab_bridge.py` trên Colab hoặc máy có GPU. Bridge nhận request `/api/tryon`, gọi pipeline IDM-VTON và trả về kết quả.

**Lớp mô hình:** Bao gồm checkpoint, IP-Adapter, image encoder, human parsing, DensePose/OpenPose nếu cần và pipeline diffusion để sinh ảnh.

Bảng 3 trình bày các thành phần chính của hệ thống.

| Thành phần | Vai trò | Ghi chú triển khai |
|---|---|---|
| Web UI | Nhận ảnh và hiển thị kết quả | Nằm trong `web_demo/templates/` và `web_demo/static/` |
| Local server | Phục vụ giao diện, proxy request | Chạy bằng `python web_demo/server.py` |
| Colab bridge | API suy luận từ xa | Chạy bằng `python web_demo/colab_bridge.py` |
| IDM-VTON pipeline | Sinh ảnh thử đồ | Cần checkpoint và GPU |
| Log thực nghiệm | Lưu seed, thời gian, lỗi | Chỉ lưu khi có đồng ý của người dùng |

### 4.4. Kết quả xây dựng bộ dữ liệu áo dài

Đóng góp cụ thể của nhóm là xây dựng bộ dữ liệu áo dài quy mô ban đầu khoảng 100 mẫu. Bộ dữ liệu này không chỉ dùng để chạy demo, mà còn phục vụ phân tích đặc trưng trang phục truyền thống Việt Nam trong bài toán thử đồ ảo. Điểm khác biệt so với việc dùng dữ liệu sẵn có là nhóm chủ động thu thập, lọc, mô tả thuộc tính và chuẩn bị cấu trúc dữ liệu theo nhu cầu huấn luyện/tinh chỉnh mô hình.

Dữ liệu được phân tích theo ba nhóm thông tin. Nhóm thứ nhất là thông tin nhận dạng mẫu như mã mẫu, nguồn ảnh, trạng thái quyền sử dụng và chất lượng ảnh. Nhóm thứ hai là thông tin thị giác của áo dài như màu chủ đạo, kiểu cổ, kiểu tay, độ dài tà, loại hoa văn, mức độ phức tạp họa tiết và mức độ che khuất. Nhóm thứ ba là thông tin phục vụ huấn luyện như trạng thái paired/unpaired, ảnh người mặc tương ứng, ảnh áo riêng, mask và densepose nếu có.

Bảng 4 trình bày cấu trúc phân tích bộ dữ liệu áo dài của nhóm.

| Hạng mục | Nội dung phân tích | Đóng góp cho nghiên cứu |
|---|---|---|
| Quy mô ban đầu | Khoảng 100 mẫu áo dài | Tạo tập dữ liệu riêng thay vì chỉ dùng ảnh mẫu có sẵn |
| Nhóm màu sắc | Trắng, đỏ, vàng, xanh, pastel, màu tối, phối màu | Phân tích lỗi sai màu và độ bền màu sau sinh ảnh |
| Nhóm cấu trúc | Cổ cao, cổ tròn/cách tân, tay dài, tay lỡ, tà dài | Kiểm tra lỗi đặc thù của áo dài như biến dạng cổ và tà |
| Nhóm họa tiết | Trơn, hoa văn, thêu, in, họa tiết dày/thưa | Đánh giá khả năng giữ chi tiết trang phục |
| Trạng thái dữ liệu | Paired, unpaired, garment-only | Xác định mẫu dùng cho train, validation, test hoặc inference |
| Chất lượng ảnh | Độ phân giải, nền, che khuất, watermark | Lọc dữ liệu và giải thích nguyên nhân lỗi |

Bộ dữ liệu 100 mẫu chưa đủ lớn để huấn luyện một mô hình thử đồ ảo tổng quát từ đầu. Tuy nhiên, đây là đóng góp có ý nghĩa vì tạo ra tập dữ liệu chuyên biệt cho áo dài, giúp nhóm nghiên cứu kiểm tra khả năng thích ứng của IDM-VTON với trang phục Việt Nam và tạo nền cho các bước fine-tune sau này.

### 4.5. Kết quả đề xuất quy trình train/fine-tune từ dữ liệu áo dài

Từ bộ dữ liệu áo dài đã thu thập, công trình đề xuất quy trình chuẩn bị train/fine-tune gồm bốn giai đoạn.

Giai đoạn thứ nhất là chuẩn hóa ảnh. Ảnh áo dài được đổi tên theo mã mẫu, kiểm tra độ phân giải, cắt hoặc padding nếu cần và đưa về cấu trúc thư mục thống nhất. Với IDM-VTON, ảnh người và ảnh áo cần được tổ chức sao cho có thể tạo cặp dữ liệu tương tự cấu trúc VITON-HD.

Giai đoạn thứ hai là tạo dữ liệu phụ trợ. Với các mẫu có ảnh người mặc, nhóm có thể tạo mask vùng áo, ảnh densepose và ảnh clothing-agnostic. Đây là bước quan trọng vì pipeline thử đồ ảo không chỉ cần ảnh áo mà còn cần thông tin cơ thể người mặc và vùng cần thay trang phục.

Giai đoạn thứ ba là chia dữ liệu. Với khoảng 100 mẫu, phương án chia sơ bộ là 70 mẫu train, 15 mẫu validation và 15 mẫu test. Nếu số mẫu paired ít hơn, cần ưu tiên dùng tập dữ liệu này cho đánh giá inference và chỉ fine-tune ở mức thử nghiệm. Cách trình bày này giúp tránh phóng đại kết quả khi quy mô dữ liệu còn nhỏ.

Giai đoạn thứ tư là đánh giá sau fine-tune. Kết quả cần so sánh giữa mô hình gốc IDM-VTON và mô hình sau fine-tune trên dữ liệu áo dài. Các lỗi cần quan sát gồm mất tà áo, lệch cổ cao, sai màu, mất hoa văn, biến dạng tay áo và thay đổi khuôn mặt người mặc. Nếu chưa đủ điều kiện train, phần này được ghi là kế hoạch thực nghiệm tiếp theo, còn đóng góp hiện tại là bộ dữ liệu và quy trình chuẩn hóa.

### 4.6. Kết quả đề xuất tiêu chí đánh giá

Công trình đề xuất hai nhóm tiêu chí đánh giá.

Nhóm tiêu chí kỹ thuật gồm:

- Độ trung thực màu sắc trang phục.
- Độ giữ đúng họa tiết, logo và chữ.
- Độ tự nhiên của cổ áo, tay áo, vai và thân áo.
- Độ ổn định của khuôn mặt và cơ thể người mặc.
- Chất lượng vùng biên giữa áo, da, tóc và nền.
- Thời gian xử lý trung bình.
- Tỷ lệ lỗi quan sát được.

Nhóm tiêu chí người dùng gồm:

- Ảnh thử đồ có giúp hình dung sản phẩm tốt hơn không.
- Người dùng có tin tưởng kết quả không.
- Người dùng có sẵn sàng dùng tính năng trên website bán hàng không.
- Người dùng có lo ngại khi tải ảnh cá nhân không.
- Người dùng có cho rằng tính năng này hỗ trợ quyết định mua hàng không.

Bảng 5 trình bày mẫu thang đo khảo sát.

| Tiêu chí | Câu hỏi khảo sát | Thang đo |
|---|---|---|
| Độ tự nhiên | Ảnh thử đồ trông tự nhiên. | 1-5 |
| Độ đúng trang phục | Trang phục trong ảnh kết quả giống ảnh sản phẩm gốc. | 1-5 |
| Hữu ích | Ảnh thử đồ giúp tôi hình dung sản phẩm khi mặc. | 1-5 |
| Niềm tin | Tôi tin tưởng kết quả này khi cân nhắc mua hàng. | 1-5 |
| Ý định sử dụng | Tôi muốn dùng tính năng này khi mua quần áo online. | 1-5 |
| Quyền riêng tư | Tôi lo ngại khi tải ảnh cá nhân lên hệ thống. | 1-5 |

### 4.7. Thảo luận về hiệu quả kinh tế và xã hội

Về kinh tế, thử đồ ảo có thể tạo giá trị cho doanh nghiệp theo ba hướng. Thứ nhất, hệ thống giúp tăng tương tác với sản phẩm vì người dùng có lý do thử nhiều mẫu, nhiều màu và nhiều phong cách. Thứ hai, hệ thống có thể hỗ trợ quyết định mua bằng cách giảm khoảng cách giữa ảnh sản phẩm và hình dung cá nhân. Thứ ba, nếu kết hợp với gợi ý kích thước, hệ thống có thể góp phần giảm một phần trường hợp hoàn trả do người mua chọn sản phẩm không phù hợp.

Về xã hội, thử đồ ảo giúp người dùng tiếp cận trải nghiệm mua sắm cá nhân hóa mà không cần đến cửa hàng. Công nghệ này có thể hỗ trợ người dùng ở khu vực xa trung tâm thương mại, người bận rộn hoặc người muốn thử nhiều sản phẩm nhanh. Tuy nhiên, hiệu quả xã hội chỉ tích cực khi hệ thống minh bạch, bảo vệ dữ liệu cá nhân và không tạo kỳ vọng sai lệch về sản phẩm.

### 4.8. Thảo luận về rủi ro đạo đức và quyền riêng tư

Ảnh người dùng là dữ liệu nhạy cảm. Một ảnh tải lên hệ thống có thể chứa khuôn mặt, dáng người, không gian sống và thông tin nhận dạng. Do đó, hệ thống cần có chính sách rõ ràng: không lưu ảnh mặc định, chỉ lưu khi có sự đồng ý, cho phép xóa dữ liệu và không dùng ảnh người dùng để huấn luyện lại mô hình nếu chưa được cho phép.

Ngoài ra, mô hình có thể có thiên lệch dữ liệu. Nếu dữ liệu huấn luyện không đa dạng, kết quả có thể tốt với một số nhóm cơ thể hoặc màu da nhưng kém với nhóm khác. Điều này ảnh hưởng đến tính công bằng của hệ thống. OECD (2024) nhấn mạnh các nguyên tắc về minh bạch, công bằng, an toàn và trách nhiệm giải trình trong AI. Tabassi (2023) trong NIST AI RMF 1.0 cũng đề xuất quản trị rủi ro AI trong toàn bộ vòng đời hệ thống. Áp dụng vào thử đồ ảo, nhóm nghiên cứu cần ghi nhận lỗi, công bố giới hạn và thiết kế giao diện minh bạch.

## 5. Kết luận - Đề nghị

### 5.1. Kết luận

Công trình đã hệ thống hóa cơ sở lý thuyết và thực tiễn của thử đồ ảo bằng trí tuệ nhân tạo trong thương mại thời trang, đồng thời cụ thể hóa bài toán vào trang phục áo dài. Kết quả tổng quan cho thấy lĩnh vực virtual try-on đã phát triển từ các phương pháp ghép ảnh và warping truyền thống sang các mô hình khuếch tán có khả năng sinh ảnh chân thực hơn. Các công trình như VITON, VITON-HD, TryOnDiffusion, LaDI-VTON, StableVITON, IDM-VTON và CatVTON thể hiện xu hướng cải thiện độ phân giải, độ trung thực trang phục và khả năng triển khai.

Đối với đề tài ứng dụng, IDM-VTON là nền tảng phù hợp vì có mã nguồn công khai, có pipeline suy luận và có thể tích hợp vào demo web thông qua Colab bridge. Công trình đã đề xuất kiến trúc hệ thống gồm giao diện web, server local, API bridge và lớp mô hình. Đóng góp riêng của nhóm là thu thập khoảng 100 mẫu áo dài, xây dựng bộ thuộc tính phân tích trang phục và đề xuất quy trình chuẩn hóa dữ liệu để phục vụ thử nghiệm, đánh giá và fine-tune mô hình.

Kết luận quan trọng là thử đồ ảo không nên được xem chỉ như một tính năng tạo ảnh đẹp. Giá trị của hệ thống nằm ở khả năng hỗ trợ người dùng ra quyết định mua hàng tốt hơn, đồng thời phải đảm bảo minh bạch, bảo vệ quyền riêng tư và không gây hiểu nhầm về sản phẩm thật.

### 5.2. Ý nghĩa khoa học

Về mặt khoa học, công trình đóng góp một bản tổng quan có hệ thống về thử đồ ảo dựa trên AI, đặc biệt là hướng diffusion-based virtual try-on. Điểm mới quan trọng là đưa ra hướng bản địa hóa dữ liệu cho áo dài Việt Nam thông qua bộ dữ liệu khoảng 100 mẫu và bộ nhãn thuộc tính trang phục. Công trình cũng đề xuất khung đánh giá kết hợp giữa chỉ số kỹ thuật, phân tích lỗi theo thuộc tính áo dài và khảo sát người dùng, phù hợp với nghiên cứu ứng dụng trong điều kiện sinh viên hoặc nhóm nghiên cứu nhỏ.

### 5.3. Hiệu quả kinh tế và xã hội

Về kinh tế, hệ thống có tiềm năng hỗ trợ website thời trang tăng tương tác sản phẩm, tăng niềm tin khi mua hàng và giảm một phần bất định liên quan đến hoàn trả. Về xã hội, hệ thống giúp người dùng có trải nghiệm mua sắm trực quan và cá nhân hóa hơn. Tuy nhiên, hiệu quả này chỉ bền vững khi công nghệ được triển khai có trách nhiệm, tôn trọng quyền riêng tư và không phóng đại khả năng mô phỏng.

### 5.4. Quy mô và phạm vi áp dụng

Trong giai đoạn đầu, hệ thống phù hợp để áp dụng ở quy mô demo nghiên cứu, phục vụ báo cáo, thuyết trình và khảo sát người dùng. Phạm vi phù hợp nhất là áo dài và các biến thể áo dài cách tân. Khi có thêm dữ liệu, GPU ổn định và quy trình bảo mật tốt hơn, hệ thống có thể mở rộng sang nhiều loại trang phục truyền thống hoặc tích hợp vào website thương mại điện tử thử nghiệm.

### 5.5. Đề nghị hướng nghiên cứu tiếp theo

Công trình đề xuất các hướng nghiên cứu tiếp theo:

1. Mở rộng bộ dữ liệu từ khoảng 100 mẫu lên quy mô lớn hơn, có thêm nhiều kiểu áo dài truyền thống, áo dài cách tân, màu sắc, chất liệu và họa tiết.
2. Hoàn thiện dữ liệu paired bằng cách thu thập thêm ảnh người mặc tương ứng, mask và densepose để phục vụ train/fine-tune ổn định hơn.
3. Chạy thực nghiệm so sánh IDM-VTON gốc với phiên bản fine-tune trên dữ liệu áo dài.
4. So sánh IDM-VTON với các mô hình khác như CatVTON để đánh giá chất lượng và chi phí suy luận.
5. Kết hợp thử đồ ảo với gợi ý kích thước để hỗ trợ cả yếu tố thị giác và độ vừa vặn.
6. Xây dựng module phát hiện lỗi tự động như sai màu, mất hoa văn, lệch cổ áo, cụt tà áo hoặc biến dạng tay.
7. Thiết kế nghiên cứu người dùng theo mô hình A/B để đo tác động của tính năng thử đồ ảo đến ý định mua hàng.
8. Hoàn thiện chính sách quyền riêng tư và quy trình xin đồng ý khi xử lý ảnh cá nhân.

## 6. Tài liệu tham khảo, phụ lục và danh mục công trình trước đây

### 6.1. Tài liệu tham khảo

Chen, C., Ni, J. and P. Zhang. 2024. Virtual try-on systems in fashion consumption: A systematic review. *Applied Sciences* 14(24): 11839. <https://doi.org/10.3390/app142411839>.

Choi, S., Park, S., Lee, M. and J. Choo. 2021. VITON-HD: High-resolution virtual try-on via misalignment-aware normalization. *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*: pp. 14131-14140. <https://openaccess.thecvf.com/content/CVPR2021/html/Choi_VITON-HD_High-Resolution_Virtual_Try-On_via_Misalignment-Aware_Normalization_CVPR_2021_paper.html>.

Choi, Y., Kwak, S., Lee, K., Choi, H. and J. Shin. 2024. Improving diffusion models for authentic virtual try-on in the wild. *arXiv preprint arXiv:2403.05139*. <https://doi.org/10.48550/arXiv.2403.05139>.

Chong, Z., Dong, X., Li, H., Zhang, S., Zhang, W., Zhang, X., Zhao, H., Jiang, D. and X. Liang. 2024/2025. CatVTON: Concatenation is all you need for virtual try-on with diffusion models. *arXiv preprint arXiv:2407.15886*. <https://doi.org/10.48550/arXiv.2407.15886>.

Gustafsson, E., Jonsson, P. and J. Holmstrom. 2021. Reducing retail supply chain costs of product returns using digital product fitting. *International Journal of Physical Distribution & Logistics Management* 51(8): pp. 877-896. <https://doi.org/10.1108/IJPDLM-10-2020-0334>.

Han, X., Wu, Z., Wu, Z., Yu, R. and L.S. Davis. 2018. VITON: An image-based virtual try-on network. *Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)*. <https://doi.org/10.48550/arXiv.1711.08447>.

Kim, J., Gu, G., Park, M., Park, S. and J. Choo. 2024. StableVITON: Learning semantic correspondence with latent diffusion model for virtual try-on. *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*: pp. 8176-8185. <https://openaccess.thecvf.com/content/CVPR2024/html/Kim_StableVITON_Learning_Semantic_Correspondence_with_Latent_Diffusion_Model_for_Virtual_CVPR_2024_paper.html>.

McKinsey and The Business of Fashion. 2026. The State of Fashion 2026: When the rules change. Xem 20.5.2026, <https://www.mckinsey.com/industries/retail/our-insights/state-of-fashion>.

Morelli, D., Baldrati, A., Cartella, G., Cornia, M., Bertini, M. and R. Cucchiara. 2023. LaDI-VTON: Latent diffusion textual-inversion enhanced virtual try-on. *arXiv preprint arXiv:2305.13501*. <https://doi.org/10.48550/arXiv.2305.13501>.

National Retail Federation. 2024. NRF and Happy Returns Report: 2024 Retail Returns to Total $890 Billion. Xem 20.5.2026, <https://nrf.com/media-center/press-releases/nrf-and-happy-returns-report-2024-retail-returns-total-890-billion>.

OECD. 2024. OECD AI Principles. Xem 20.5.2026, <https://www.oecd.org/en/topics/ai-principles.html>.

Tabassi, E. 2023. Artificial Intelligence Risk Management Framework (AI RMF 1.0). National Institute of Standards and Technology. <https://doi.org/10.6028/NIST.AI.100-1>.

Zhu, L., Yang, D., Zhu, T., Reda, F., Chan, W., Saharia, C., Norouzi, M. and I. Kemelmacher-Shlizerman. 2023. TryOnDiffusion: A tale of two UNets. *arXiv preprint arXiv:2306.08276*. <https://doi.org/10.48550/arXiv.2306.08276>.

### 6.2. Phụ lục A: Mẫu bảng ghi nhận kết quả thực nghiệm áo dài

| Mã mẫu | Ảnh người | Ảnh áo dài | Seed | Thời gian xử lý | Lỗi quan sát được | Nhận xét |
|---|---|---|---:|---:|---|---|
| M01 | person_01.jpg | aodai_001.jpg | 42 | ... giây | ... | ... |
| M02 | person_02.jpg | aodai_002.jpg | 42 | ... giây | ... | ... |
| M03 | person_03.jpg | aodai_003.jpg | 42 | ... giây | ... | ... |

### 6.3. Phụ lục B: Mẫu phiếu khảo sát người dùng

Người tham gia đánh giá theo thang điểm 1-5, trong đó 1 là rất không đồng ý và 5 là rất đồng ý.

| STT | Câu hỏi | Thang điểm |
|---:|---|---|
| 1 | Ảnh thử đồ trông tự nhiên. | 1-5 |
| 2 | Trang phục trong ảnh kết quả giống ảnh sản phẩm gốc. | 1-5 |
| 3 | Khuôn mặt và cơ thể người mặc được giữ ổn định. | 1-5 |
| 4 | Ảnh thử đồ giúp tôi hình dung sản phẩm khi mặc. | 1-5 |
| 5 | Tính năng này làm tôi tự tin hơn khi mua quần áo online. | 1-5 |
| 6 | Tôi sẵn sàng dùng tính năng này trên website bán hàng. | 1-5 |
| 7 | Tôi lo ngại về việc tải ảnh cá nhân lên hệ thống. | 1-5 |
| 8 | Tôi muốn hệ thống có cảnh báo rõ ràng rằng ảnh chỉ là mô phỏng AI. | 1-5 |

Câu hỏi mở:

1. Bạn thấy lỗi nào rõ nhất trong ảnh thử đồ?
2. Bạn có tin kết quả này khi quyết định mua hàng không? Vì sao?
3. Bạn muốn hệ thống bổ sung tính năng gì?

### 6.4. Phụ lục C: Lệnh chạy demo tham khảo

Chạy web UI local:

`python web_demo/server.py --host 127.0.0.1 --port 7861`

Chạy API bridge trên Colab hoặc máy có GPU:

`python web_demo/colab_bridge.py --host 0.0.0.0 --port 7862`

Nếu dùng bridge từ xa, truyền URL về local server:

`python web_demo/server.py --host 127.0.0.1 --port 7861 --remote-url https://your-public-colab-url`

### 6.5. Phụ lục D: Mẫu bảng mã hóa thuộc tính áo dài

| Mã mẫu | Màu chính | Kiểu cổ | Kiểu tay | Độ dài tà | Họa tiết | Trạng thái dữ liệu | Ghi chú |
|---|---|---|---|---|---|---|---|
| AD001 | Trắng | Cổ cao | Tay dài | Tà dài | Trơn | Garment-only | Cần ảnh người mặc tương ứng |
| AD002 | Đỏ | Cổ cao | Tay dài | Tà dài | Hoa văn dày | Paired | Có thể dùng cho train/validation |
| AD003 | Pastel | Cổ cách tân | Tay lỡ | Tà vừa | Thêu nhẹ | Unpaired | Dùng đánh giá inference |

### 6.6. Danh mục các công trình trước đây của tác giả

Chưa có công trình đã công bố trước đây liên quan trực tiếp đến đề tài này. Mục này có thể được cập nhật khi nhóm tác giả có bài báo, poster, demo, báo cáo hội nghị hoặc sản phẩm phần mềm đã được nghiệm thu.

### 6.7. Tuyên bố sử dụng AI

Báo cáo được soạn thảo với sự hỗ trợ của công cụ AI theo quy trình Academic Research Suite. AI được sử dụng để hỗ trợ tổng quan tài liệu, cấu trúc nội dung, diễn đạt học thuật và định dạng bản thảo. Nhóm tác giả chịu trách nhiệm kiểm tra nội dung, kiểm chứng tài liệu tham khảo, điều chỉnh theo yêu cầu của đơn vị đào tạo và đảm bảo tính trung thực của công trình.
