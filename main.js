/* =============================================
   app.js – Logic chính của trang quản lý phiếu mượn
   Sử dụng: jQuery + jQuery Validate + Bootstrap 5
   ============================================= */

/* ========== 1. CẤU HÌNH CHUNG ========== */

/* Key dùng để lưu dữ liệu vào Local Storage */
const LS_KEY = 'library_borrows';

/* Biến đối tượng Bootstrap Modal (sẽ khởi tạo khi DOM sẵn sàng) */
let borrowModal;


/* ========== 2. LOCAL STORAGE HELPERS ========== */

/**
 * Lấy danh sách phiếu mượn từ Local Storage.
 * Nếu chưa có gì → trả về mảng rỗng.
 */
function getAll() {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? JSON.parse(raw) : [];
}

/**
 * Lưu toàn bộ mảng phiếu mượn vào Local Storage.
 * @param {Array} data - Mảng phiếu mượn cần lưu
 */
function saveAll(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}


/* ========== 3. KHỞI ĐỘNG ========== */

/**
 * Hàm chạy đầu tiên khi trang load xong.
 *
 * Luồng xử lý dữ liệu mẫu:
 *   - Nếu Local Storage ĐÃ có dữ liệu → dùng luôn, không đọc file.
 *   - Nếu Local Storage CHƯA có dữ liệu → dùng fetch() đọc data.json,
 *     lưu vào Local Storage, rồi mới render bảng.
 *
 * Tại sao dùng fetch() thay vì import/require?
 *   Vì đây là file HTML thuần, không có bundler (webpack/vite).
 *   fetch() là cách chuẩn để đọc file JSON từ trình duyệt.
 *
 * ⚠️ LƯU Ý: fetch() cần chạy qua HTTP server (ví dụ: VS Code Live Server,
 *   hoặc `npx serve`). Mở file trực tiếp bằng file:// sẽ bị lỗi CORS.
 */
function init() {
  // Khởi tạo Bootstrap Modal
  borrowModal = new bootstrap.Modal(document.getElementById('borrowModal'));

  // Đếm ký tự ghi chú theo thời gian thực
  document.getElementById('note').addEventListener('input', function () {
    document.getElementById('note-count').textContent = this.value.length;
  });

  // Kiểm tra Local Storage đã có dữ liệu chưa
  if (localStorage.getItem(LS_KEY)) {
    // Đã có → render luôn, không cần đọc file
    renderTable();
  } else {
    // Chưa có → fetch dữ liệu mẫu từ data.json
    fetch('data.json')
      .then(function (response) {
        // response.json() chuyển nội dung file thành mảng JavaScript
        return response.json();
      })
      .then(function (sampleData) {
        // Lưu dữ liệu mẫu vào Local Storage
        saveAll(sampleData);
        // Render bảng sau khi đã có dữ liệu
        renderTable();
      })
      .catch(function (err) {
        /*
          Lỗi thường gặp: fetch bị chặn khi mở file bằng file://
          Giải pháp: dùng Live Server trong VS Code (click "Go Live" góc dưới phải)
          hoặc chạy: npx serve . trong thư mục chứa file
        */
        console.error('Không thể đọc data.json:', err);
        console.warn('Hãy mở trang qua HTTP server (VS Code Live Server) thay vì mở file trực tiếp.');
        // Vẫn render bảng (sẽ hiển thị trạng thái rỗng)
        renderTable();
      });
  }
}

// Chạy init() khi toàn bộ DOM đã tải xong
document.addEventListener('DOMContentLoaded', init);


/* ========== 4. RENDER BẢNG & THỐNG KÊ ========== */

/**
 * Vẽ lại toàn bộ bảng và cập nhật thẻ thống kê.
 * Hàm này được gọi sau mọi thao tác thêm/sửa/xóa.
 */
function renderTable() {
  const list  = getAll();
  const tbody = document.getElementById('borrow-tbody');

  // Xoá nội dung cũ của bảng
  tbody.innerHTML = '';

  if (list.length === 0) {
    // Nếu không có dữ liệu → hiện thông báo trống
    document.getElementById('empty-state').style.display = 'block';
  } else {
    document.getElementById('empty-state').style.display = 'none';

    // Duyệt qua từng phiếu và tạo một hàng <tr> trong bảng
    list.forEach((item, index) => {
      const row = document.createElement('tr');

      // Chọn class CSS cho badge trạng thái
      // Nút Sửa và Xóa ở đây!
      const badgeClass = item.status === 'Đang mượn' ? 'badge-borrowing' : 'badge-returned';

      row.innerHTML = `
        <td><strong>${escapeHtml(item.borrowId)}</strong></td>
        <td>${escapeHtml(item.borrowerName)}</td>
        <td>${escapeHtml(item.bookId)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${item.borrowDate}</td>
        <td>${item.returnDate}</td>
        <td>${escapeHtml(item.phone)}</td>
        <td>${escapeHtml(item.email)}</td>
        <td><span class="badge-status ${badgeClass}">${escapeHtml(item.status)}</span></td>
        <td>${escapeHtml(item.note) || '<span class="text-muted">—</span>'}</td>
        <td class="text-center">
          <!-- Nút Sửa: truyền index vào hàm editBorrow -->
          <button class="btn-edit me-1" onclick="editBorrow(${index})">
            <i class="bi bi-pencil-square"></i> Sửa 
          </button>
          <!-- Nút Xóa: truyền index vào hàm deleteBorrow -->
          <button class="btn-delete" onclick="deleteBorrow(${index})">
            <i class="bi bi-trash3"></i> Xóa
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  // Cập nhật thẻ thống kê
  updateStats(list);
}

/**
 * Cập nhật 3 số liệu thống kê ở đầu trang.
 * @param {Array} list - Danh sách phiếu mượn hiện tại
 */
function updateStats(list) {
  const total     = list.length;
  const borrowing = list.filter(i => i.status === 'Đang mượn').length;
  const returned  = list.filter(i => i.status === 'Đã trả').length;

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-borrowing').textContent = borrowing;
  document.getElementById('stat-returned').textContent  = returned;
}


/* ========== 5. MỞ / ĐÓNG MODAL ========== */

/**
 * Mở modal ở chế độ THÊM MỚI.
 * Reset form và đặt trạng thái về 'add'.
 */
function openModal() {
  // Xoá dữ liệu form cũ
  resetForm();

  // Đặt chế độ thêm mới
  document.getElementById('edit-mode').value  = 'add';
  document.getElementById('original-id').value = '';

  // Cập nhật tiêu đề modal
  document.getElementById('modalTitle').innerHTML =
    '<i class="bi bi-journal-plus me-2"></i>Thêm phiếu mượn';

  // Hiện modal
  borrowModal.show();
}

/**
 * Mở modal ở chế độ SỬA.
 * Nạp dữ liệu của phiếu cần sửa vào form.
 * @param {number} index - Vị trí phiếu trong mảng
 */
function editBorrow(index) {
  const list = getAll();
  const item = list[index];          // Lấy phiếu theo index

  // Nạp từng trường vào form
  document.getElementById('borrow-id').value    = item.borrowId;
  document.getElementById('borrower-name').value= item.borrowerName;
  document.getElementById('book-id').value      = item.bookId;
  document.getElementById('book-category').value= item.category;
  document.getElementById('borrow-date').value  = item.borrowDate;
  document.getElementById('return-date').value  = item.returnDate;
  document.getElementById('phone').value        = item.phone;
  document.getElementById('email').value        = item.email;
  document.getElementById('status').value       = item.status;
  document.getElementById('note').value         = item.note || '';

  // Cập nhật bộ đếm ký tự ghi chú
  document.getElementById('note-count').textContent = (item.note || '').length;

  // Đặt chế độ sửa + lưu lại mã phiếu gốc (để so sánh khi kiểm tra trùng)
  document.getElementById('edit-mode').value   = 'edit';
  document.getElementById('original-id').value = item.borrowId;

  // Cập nhật tiêu đề modal
  document.getElementById('modalTitle').innerHTML =
    '<i class="bi bi-pencil-square me-2"></i>Sửa phiếu mượn';

  // Xóa thông báo lỗi cũ (nếu còn sót)
  clearErrors();

  borrowModal.show();
}


/* ========== 6. LƯU PHIẾU MƯỢN (THÊM / SỬA) ========== */

/**
 * Hàm được gọi khi nhấn nút "Lưu phiếu mượn".
 * Sẽ trigger jQuery Validate, nếu hợp lệ thì lưu vào Local Storage.
 */
function saveBorrow() {
  // Kích hoạt validate thủ công trên form
  // (vì chúng ta không dùng nút submit mặc định)
  const isValid = $('#borrow-form').valid();

  if (!isValid) {
    // Rung nhẹ nút lưu để báo có lỗi
    const btn = document.getElementById('btn-save');
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 400);
    return; // Dừng lại, không lưu
  }

  // === Lấy dữ liệu từ form ===
  const borrowId    = document.getElementById('borrow-id').value.trim();
  const borrowerName= document.getElementById('borrower-name').value.trim();
  const bookId      = document.getElementById('book-id').value.trim();
  const category    = document.getElementById('book-category').value;
  const borrowDate  = document.getElementById('borrow-date').value;
  const returnDate  = document.getElementById('return-date').value;
  const phone       = document.getElementById('phone').value.trim();
  const email       = document.getElementById('email').value.trim();
  const status      = document.getElementById('status').value;
  const note        = document.getElementById('note').value.trim();

  const editMode   = document.getElementById('edit-mode').value;   // 'add' hoặc 'edit'
  const originalId = document.getElementById('original-id').value;

  // Tạo object phiếu mượn mới
  const newItem = { borrowId, borrowerName, bookId, category, borrowDate, returnDate, phone, email, status, note };

  const list = getAll();

  if (editMode === 'add') {
    // === THÊM MỚI ===
    list.push(newItem);
    saveAll(list);
    showToast('Thêm phiếu mượn thành công!', 'success');
  } else {
    // === SỬA ===
    // Tìm index của phiếu cần cập nhật theo mã gốc
    const idx = list.findIndex(i => i.borrowId === originalId);
    if (idx !== -1) {
      list[idx] = newItem;   // Thay thế phiếu cũ bằng dữ liệu mới
      saveAll(list);
      showToast('Cập nhật phiếu mượn thành công!', 'success');
    }
  }

  // Đóng modal và render lại bảng
  borrowModal.hide();
  renderTable();
}


/* ========== 7. XÓA PHIẾU MƯỢN ========== */

/**
 * Xóa phiếu mượn tại vị trí index.
 * Hiển thị hộp thoại xác nhận trước khi xóa.
 * @param {number} index - Vị trí phiếu trong mảng
 */
function deleteBorrow(index) {
  const list = getAll();
  const item = list[index];

  // Hỏi xác nhận người dùng
  const confirmed = confirm(
    `Bạn có chắc muốn xóa phiếu mượn?\n\nMã phiếu: ${item.borrowId}\nNgười mượn: ${item.borrowerName}`
  );

  if (confirmed) {
    list.splice(index, 1);   // Xóa 1 phần tử tại vị trí index
    saveAll(list);
    renderTable();
    showToast('Đã xóa phiếu mượn!', 'danger');
  }
}


/* ========== 8. JQUERY VALIDATE ========== */

/**
 * Cấu hình jQuery Validate cho form #borrow-form.
 *
 * LƯU Ý QUAN TRỌNG - Tại sao cần $(document).ready:
 *   jQuery Validate cần jQuery đã load xong mới dùng được.
 *   $(document).ready đảm bảo toàn bộ HTML và JS thư viện đã sẵn sàng.
 *
 * LƯU Ý QUAN TRỌNG - rules dùng NAME, không phải ID:
 *   jQuery Validate nhận diện trường qua thuộc tính name="" của input.
 *   Key trong object rules phải khớp chính xác với name của input đó.
 */
$(document).ready(function () {

  /* ============================================================
     BƯỚC 1: Đăng ký các luật validate tùy chỉnh (custom rules)
     Cú pháp: $.validator.addMethod('tênLuật', hàmKiểmTra, 'thôngBáoMặcĐịnh')
     - hàmKiểmTra nhận (value, element) và trả về true (hợp lệ) / false (lỗi)
  ============================================================ */

  // Luật: Mã phiếu phải theo định dạng PM-XXXX (4 chữ số)
  $.validator.addMethod('borrowIdFormat', function (value) {
    return /^PM-\d{4}$/.test(value);
  }, 'Mã phiếu phải có định dạng PM-XXXX (4 chữ số, ví dụ: PM-2048).');

  // Luật: Mã phiếu không được trùng với bản ghi đã có trong Local Storage
  $.validator.addMethod('noDuplicateId', function (value) {
    const editMode   = document.getElementById('edit-mode').value;
    const originalId = document.getElementById('original-id').value;
    const list       = getAll();
    // Khi đang SỬA và mã không đổi → hợp lệ (không coi là trùng)
    if (editMode === 'edit' && value === originalId) return true;
    // Kiểm tra xem mã đã tồn tại chưa
    return !list.some(i => i.borrowId === value);
  }, 'Mã phiếu mượn này đã tồn tại, vui lòng chọn mã khác.');

  // Luật: Họ tên chỉ chứa chữ cái (kể cả tiếng Việt) và khoảng trắng
  $.validator.addMethod('nameFormat', function (value) {
    // \p{L} là Unicode property escape, khớp mọi chữ cái kể cả tiếng Việt
    return /^[\p{L}\s]+$/u.test(value);
  }, 'Họ tên chỉ được chứa chữ cái và khoảng trắng.');

  // Luật: Mã sách phải bắt đầu bằng BK và theo sau là đúng 5 chữ số
  $.validator.addMethod('bookIdFormat', function (value) {
    return /^BK\d{5}$/.test(value);
  }, 'Mã sách phải bắt đầu bằng BK và theo sau là đúng 5 chữ số (ví dụ: BK10234).');

  // Luật: Ngày mượn không được lớn hơn ngày hôm nay
  $.validator.addMethod('notFutureDate', function (value) {
    if (!value) return true; // Để 'required' xử lý trường hợp rỗng
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const selected = new Date(value);
    return selected <= today;
  }, 'Ngày mượn không được lớn hơn ngày hiện tại.');

  // Luật: Hạn trả phải >= ngày mượn VÀ không vượt quá 30 ngày kể từ ngày mượn
  $.validator.addMethod('returnDateValid', function (value) {
    const borrowDate = document.getElementById('borrow-date').value;
    if (!value || !borrowDate) return true;
    const bDate = new Date(borrowDate);
    const rDate = new Date(value);
    if (rDate < bDate) return false;                               // Hạn trả trước ngày mượn → lỗi
    const diff = (rDate - bDate) / (1000 * 60 * 60 * 24);
    return diff <= 30;                                             // Quá 30 ngày → lỗi
  }, 'Hạn trả phải ≥ ngày mượn và không quá 30 ngày kể từ ngày mượn.');

  // Luật: SĐT đúng 10 chữ số, bắt đầu bằng 03/05/07/08/09
  $.validator.addMethod('phoneFormat', function (value) {
    return /^(03|05|07|08|09)\d{8}$/.test(value);
  }, 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.');

  // Luật: Email phải đúng định dạng và kết thúc bằng @library.vn
  $.validator.addMethod('libraryEmail', function (value) {
    return /^[^\s@]+@library\.vn$/.test(value);
  }, 'Email phải đúng định dạng và kết thúc bằng @library.vn.');

  // Luật: Ghi chú không được chứa thẻ HTML nguy hiểm
  $.validator.addMethod('noHtmlTags', function (value) {
    if (!value) return true;
    return !/<(script|iframe|img)[^>]*>/i.test(value);
  }, 'Ghi chú không được chứa thẻ HTML như <script>, <iframe>, <img>.');

  /* ============================================================
     BƯỚC 2: Khởi tạo validate trên form
     KEY CỦA rules PHẢI KHỚP VỚI THUỘC TÍNH name="" TRÊN INPUT
     (Không phải id — đây là nguyên nhân validate không chạy nếu thiếu name)
  ============================================================ */
  $('#borrow-form').validate({

    rules: {
      // name="borrow-id"
      'borrow-id': {
        required:       true,
        borrowIdFormat: true,
        noDuplicateId:  true
      },
      // name="borrower-name"
      'borrower-name': {
        required:   true,
        minlength:  2,
        maxlength:  40,
        nameFormat: true
      },
      // name="book-id"
      'book-id': {
        required:     true,
        bookIdFormat: true
      },
      // name="book-category"
      'book-category': {
        required: true
      },
      // name="borrow-date"
      'borrow-date': {
        required:      true,
        notFutureDate: true
      },
      // name="return-date"
      'return-date': {
        required:        true,
        returnDateValid: true
      },
      // name="phone"
      'phone': {
        required:    true,
        phoneFormat: true
      },
      // name="email"
      'email': {
        required:     true,
        libraryEmail: true
      },
      // name="status"
      'status': {
        required: true
      },
      // name="note" — không bắt buộc, chỉ kiểm tra nếu có giá trị
      'note': {
        maxlength:  120,
        noHtmlTags: true
      }
    },

    // Ghi đè thông báo lỗi mặc định (tiếng Anh) sang tiếng Việt
    messages: {
      'borrow-id':     { required: 'Vui lòng nhập mã phiếu mượn.' },
      'borrower-name': {
        required:  'Vui lòng nhập họ tên người mượn.',
        minlength: 'Họ tên phải có ít nhất 2 ký tự.',
        maxlength: 'Họ tên không được vượt quá 40 ký tự.'
      },
      'book-id':       { required: 'Vui lòng nhập mã sách.' },
      'book-category': { required: 'Vui lòng chọn thể loại sách.' },
      'borrow-date':   { required: 'Vui lòng chọn ngày mượn.' },
      'return-date':   { required: 'Vui lòng chọn hạn trả.' },
      'phone':         { required: 'Vui lòng nhập số điện thoại.' },
      'email':         { required: 'Vui lòng nhập email.' },
      'status':        { required: 'Vui lòng chọn trạng thái mượn.' },
      'note':          { maxlength: 'Ghi chú không được vượt quá 120 ký tự.' }
    },

    /*
      BƯỚC 3: Tùy chỉnh cách hiển thị lỗi.
      Mặc định jQuery Validate tự chèn thẻ <label class="error"> vào DOM.
      Ở đây chúng ta chặn hành vi đó và tự đưa lỗi vào đúng <div id="err-XYZ">.

      - showErrors(errorMap, errorList):
          errorList = mảng các lỗi hiện tại { element, message }
          this.successList = mảng các trường vừa hợp lệ trở lại

      - Chúng ta dùng id của input để tìm div lỗi tương ứng:
          input id="borrow-id"  →  div id="err-borrow-id"
    */
    showErrors: function (errorMap, errorList) {
      // Hiển thị lỗi cho các trường chưa hợp lệ
      errorList.forEach(function (error) {
        const fieldId = $(error.element).attr('id');          // Lấy id của input lỗi
        const errDiv  = document.getElementById('err-' + fieldId); // Tìm div lỗi tương ứng
        if (errDiv) errDiv.textContent = error.message;       // Ghi thông báo lỗi vào div
        $(error.element).addClass('is-invalid');              // Tô đỏ viền input
      });

      // Xóa lỗi cho các trường vừa được sửa đúng
      this.successList.forEach(function (element) {
        const fieldId = $(element).attr('id');
        const errDiv  = document.getElementById('err-' + fieldId);
        if (errDiv) errDiv.textContent = '';                  // Xóa thông báo lỗi
        $(element).removeClass('is-invalid');                 // Bỏ viền đỏ
      });
    },

    // Ngăn jQuery Validate tự tạo thẻ <label class="error"> trong DOM
    errorPlacement: function () { /* Không làm gì — chúng ta xử lý trong showErrors */ }
  });

  /*
    BƯỚC 4: Xóa lỗi ngay khi người dùng bắt đầu nhập lại vào một trường.
    Giúp UX tốt hơn — lỗi biến mất ngay lập tức thay vì đợi submit lại.
  */
  $('#borrow-form input, #borrow-form select, #borrow-form textarea').on('input change', function () {
    const fieldId = $(this).attr('id');
    const errDiv  = document.getElementById('err-' + fieldId);
    if (errDiv) errDiv.textContent = '';
    $(this).removeClass('is-invalid');
  });

}); // end $(document).ready


/* ========== 9. HELPER FUNCTIONS ========== */

/**
 * Reset toàn bộ form về trạng thái trống.
 */
function resetForm() {
  document.getElementById('borrow-form').reset();
  document.getElementById('note-count').textContent = '0';
  clearErrors();

  // Reset validator để xóa trạng thái cũ của jQuery Validate
  if ($('#borrow-form').data('validator')) {
    $('#borrow-form').validate().resetForm();
  }
}

/**
 * Xóa toàn bộ thông báo lỗi và class is-invalid trên form.
 */
function clearErrors() {
  // Xóa text trong tất cả div error-msg
  document.querySelectorAll('.error-msg').forEach(div => div.textContent = '');
  // Xóa class is-invalid trên tất cả input/select/textarea
  document.querySelectorAll('.form-control, .form-select').forEach(el => el.classList.remove('is-invalid'));
}

/**
 * Mã hóa chuỗi để tránh XSS khi hiển thị vào innerHTML.
 * Ví dụ: '<script>' → '&lt;script&gt;'
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Hiển thị thông báo toast nhỏ ở góc màn hình.
 * Tự động ẩn sau 2.5 giây.
 * @param {string} message - Nội dung thông báo
 * @param {string} type    - 'success' | 'danger' | 'warning'
 */
function showToast(message, type) {
  // Tạo container toast nếu chưa có
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    // Vị trí: góc dưới phải màn hình
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
    `;
    document.body.appendChild(container);
  }

  // Màu nền theo loại thông báo
  const colors = { success: '#057a55', danger: '#c81e1e', warning: '#c27803' };
  const icons  = { success: 'bi-check-circle-fill', danger: 'bi-trash3-fill', warning: 'bi-exclamation-triangle-fill' };

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${colors[type] || '#1a56db'}; color: #fff;
    padding: 12px 20px; border-radius: 8px; font-size: .9rem; font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,.2); display: flex; align-items: center; gap: 8px;
    animation: fadeInUp .3s ease;
  `;
  toast.innerHTML = `<i class="bi ${icons[type] || 'bi-info-circle-fill'}"></i> ${escapeHtml(message)}`;

  // Thêm CSS animation fadeInUp nếu chưa có
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity:0; transform: translateY(20px); }
        to   { opacity:1; transform: translateY(0);   }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  // Tự xóa toast sau 2.5 giây
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity    = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}