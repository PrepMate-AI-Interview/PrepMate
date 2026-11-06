using System;
using System.Net;

namespace backend.Services.Email
{
    public class EmailTemplateRenderer
    {
        public (string Html, string PlainText) RenderVerificationEmail(string recipientName, string verificationUrl, string? supportEmail = "support@prepmate.vn")
        {
            var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(recipientName) ? "bạn" : recipientName);
            var safeUrl = WebUtility.HtmlEncode(verificationUrl);

            var html = $@"<!DOCTYPE html>
<html lang=""vi"">
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Xác nhận địa chỉ email PrepMate</title>
</head>
<body style=""margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;"">
  <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""background-color:#f1f5f9;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);border:1px solid #e2e8f0;"">
          <!-- Header -->
          <tr>
            <td style=""background-color:#0f172a;padding:32px 40px;text-align:center;"">
              <div style=""display:inline-block;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;"">
                Prep<span style=""color:#38bdf8;"">Mate</span>
              </div>
              <div style=""color:#94a3b8;font-size:13px;margin-top:6px;letter-spacing:0.3px;text-transform:uppercase;font-weight:600;"">
                Nền tảng luyện phỏng vấn AI thông minh
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style=""padding:40px;"">
              <h1 style=""margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;"">
                Xác thực địa chỉ email của bạn
              </h1>
              <p style=""margin:0 0 20px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Chào <strong>{safeName}</strong>,
              </p>
              <p style=""margin:0 0 28px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Cảm ơn bạn đã đăng ký tài khoản tại <strong>PrepMate</strong>. Để bắt đầu luyện tập phỏng vấn và kích hoạt toàn bộ tính năng hỗ trợ nghề nghiệp cùng AI, vui lòng bấm nút bên dưới để xác nhận email của bạn:
              </p>
              <!-- CTA Button -->
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""margin:0 0 32px 0;"">
                <tr>
                  <td style=""border-radius:10px;background-color:#2563eb;text-align:center;"">
                    <a href=""{safeUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#2563eb;letter-spacing:0.2px;"">
                      Xác minh email ngay
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback Link -->
              <div style=""margin:0 0 28px 0;padding:16px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;"">
                <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;font-weight:600;"">
                  Nếu nút trên không hoạt động, bạn có thể sao chép và dán liên kết sau vào trình duyệt:
                </p>
                <a href=""{safeUrl}"" style=""font-size:12px;color:#2563eb;word-break:break-all;line-height:1.5;text-decoration:underline;"">
                  {safeUrl}
                </a>
              </div>
              <!-- Expiry & Notice -->
              <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.5;"">
                ⏱️ Liên kết xác minh có hiệu lực trong vòng <strong>24 giờ</strong> và chỉ sử dụng được một lần.
              </p>
              <p style=""margin:0;font-size:13px;color:#64748b;line-height:1.5;"">
                🔒 Nếu bạn không thực hiện đăng ký tài khoản PrepMate bằng email này, vui lòng bỏ qua thư này mà không cần thao tác gì thêm.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;"">
              <p style=""margin:0 0 6px 0;font-size:12px;color:#94a3b8;"">
                © 2026 PrepMate AI Inc. Mọi quyền được bảo lưu.
              </p>
              <p style=""margin:0;font-size:12px;color:#94a3b8;"">
                Cần hỗ trợ? Liên hệ <a href=""mailto:{supportEmail}"" style=""color:#64748b;text-decoration:underline;"">{supportEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

            var plainText = $@"PrepMate — Xác thực địa chỉ email

Chào {recipientName},

Cảm ơn bạn đã đăng ký tài khoản tại PrepMate. Vui lòng truy cập liên kết bên dưới để xác nhận email của bạn:

{verificationUrl}

Liên kết này có hiệu lực trong vòng 24 giờ. Nếu bạn không tạo tài khoản trên PrepMate, bạn có thể yên tâm bỏ qua email này.

---
© 2026 PrepMate AI Inc. Hỗ trợ: {supportEmail}";

            return (html, plainText);
        }

        public (string Html, string PlainText) RenderPasswordResetEmail(string recipientName, string resetUrl, int expiryMinutes = 30, string? supportEmail = "support@prepmate.vn")
        {
            var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(recipientName) ? "bạn" : recipientName);
            var safeUrl = WebUtility.HtmlEncode(resetUrl);

            var html = $@"<!DOCTYPE html>
<html lang=""vi"">
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <title>Yêu cầu đặt lại mật khẩu PrepMate</title>
</head>
<body style=""margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;"">
  <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""background-color:#f1f5f9;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.06);border:1px solid #e2e8f0;"">
          <!-- Header -->
          <tr>
            <td style=""background-color:#0f172a;padding:32px 40px;text-align:center;"">
              <div style=""display:inline-block;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;"">
                Prep<span style=""color:#38bdf8;"">Mate</span>
              </div>
              <div style=""color:#94a3b8;font-size:13px;margin-top:6px;letter-spacing:0.3px;text-transform:uppercase;font-weight:600;"">
                Hệ thống đặt lại mật khẩu an toàn
              </div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style=""padding:40px;"">
              <h1 style=""margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;"">
                Yêu cầu đặt lại mật khẩu
              </h1>
              <p style=""margin:0 0 20px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Chào <strong>{safeName}</strong>,
              </p>
              <p style=""margin:0 0 28px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Hệ thống PrepMate vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này. Để tiến hành thiết lập mật khẩu mới, bạn vui lòng bấm nút bên dưới:
              </p>
              <!-- CTA Button -->
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""margin:0 0 32px 0;"">
                <tr>
                  <td style=""border-radius:10px;background-color:#2563eb;text-align:center;"">
                    <a href=""{safeUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#2563eb;letter-spacing:0.2px;"">
                      Đặt lại mật khẩu
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback Link -->
              <div style=""margin:0 0 28px 0;padding:16px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;"">
                <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;font-weight:600;"">
                  Nếu nút trên không hoạt động, bạn có thể sao chép và dán liên kết sau vào trình duyệt:
                </p>
                <a href=""{safeUrl}"" style=""font-size:12px;color:#2563eb;word-break:break-all;line-height:1.5;text-decoration:underline;"">
                  {safeUrl}
                </a>
              </div>
              <!-- Expiry & Notice -->
              <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;line-height:1.5;"">
                ⏱️ Liên kết đặt lại mật khẩu này chỉ có hiệu lực trong <strong>{expiryMinutes} phút</strong> và chỉ sử dụng được <strong>1 lần duy nhất</strong>.
              </p>
              <p style=""margin:0;font-size:13px;color:#b91c1c;line-height:1.5;"">
                ⚠️ Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn được giữ nguyên an toàn.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;"">
              <p style=""margin:0 0 6px 0;font-size:12px;color:#94a3b8;"">
                © 2026 PrepMate AI Inc. Mọi quyền được bảo lưu.
              </p>
              <p style=""margin:0;font-size:12px;color:#94a3b8;"">
                Cần hỗ trợ? Liên hệ <a href=""mailto:{supportEmail}"" style=""color:#64748b;text-decoration:underline;"">{supportEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

            var plainText = $@"PrepMate — Yêu cầu đặt lại mật khẩu

Chào {recipientName},

Hệ thống PrepMate vừa nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng truy cập liên kết sau để thiết lập mật khẩu mới:

{resetUrl}

Liên kết này có hiệu lực trong {expiryMinutes} phút và chỉ sử dụng được 1 lần duy nhất.

Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể yên tâm bỏ qua email này.

---
© 2026 PrepMate AI Inc. Hỗ trợ: {supportEmail}";

            return (html, plainText);
        }
    }
}
