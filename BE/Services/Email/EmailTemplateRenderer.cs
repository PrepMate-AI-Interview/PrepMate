using System;
using System.Net;

namespace backend.Services.Email
{
    public class EmailTemplateRenderer
    {
        public (string Html, string PlainText) RenderVerificationEmail(
            string recipientName,
            string verificationUrl,
            int expiryMinutes = 30,
            bool isResend = false,
            string? supportEmail = "support@prepmate.vn")
        {
            var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(recipientName) ? "bạn" : recipientName);
            var safeUrl = WebUtility.HtmlEncode(verificationUrl);
            var title = isResend
                ? "Xác minh email để tiếp tục — PrepMate"
                : "Xác minh email để kích hoạt tài khoản PrepMate";
            var preheader = isResend
                ? "Đây là liên kết xác minh mới cho tài khoản PrepMate của bạn."
                : "Chỉ còn một bước nữa để hoàn tất đăng ký PrepMate.";
            var heading = isResend
                ? "Xác minh email để tiếp tục"
                : "Xác minh email của bạn";
            var bodyText = isResend
                ? "Đây là liên kết xác minh mới cho tài khoản PrepMate của bạn. Hãy sử dụng nút bên dưới để hoàn tất xác minh."
                : "Cảm ơn bạn đã đăng ký PrepMate. Hãy xác minh địa chỉ email để hoàn tất quá trình đăng ký và sử dụng tài khoản.";
            var ctaText = "Xác minh email";
            var expiryText = $"Liên kết xác minh có hiệu lực trong {expiryMinutes} phút.";
            var securityNote = "Nếu bạn không thực hiện đăng ký này, bạn có thể bỏ qua email. Tài khoản của bạn sẽ chưa được xác minh.";

            var html = $@"<!DOCTYPE html>
<html lang=""vi"">
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <meta http-equiv=""X-UA-Compatible"" content=""IE=edge"">
  <title>{title}</title>
  <!--[if mso]>
  <style type=""text/css"">
    body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
  </style>
  <![endif]-->
</head>
<body style=""margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;line-height:1.6;"">
  <!-- Preheader -->
  <div style=""display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;"">
    {preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""background-color:#f8fafc;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <!--[if (gte mso 9)|(IE)]>
        <table role=""presentation"" width=""580"" align=""center"" cellpadding=""0"" cellspacing=""0"" border=""0"">
          <tr>
            <td>
        <![endif]-->
        <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""max-width:580px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.04);"">
          <!-- Brand Header -->
          <tr>
            <td align=""center"" style=""padding:36px 40px 24px 40px;text-align:center;"">
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:0 auto;text-align:center;"">
                <tr>
                  <td align=""center"" style=""text-align:center;"">
                    <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:0 auto 12px auto;text-align:center;"">
                      <tr>
                        <td align=""center"" valign=""middle"" width=""44"" height=""44"" bgcolor=""#2563eb"" style=""width:44px;height:44px;background-color:#2563eb;border-radius:12px;text-align:center;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;line-height:44px;"">
                          P
                        </td>
                      </tr>
                    </table>
                    <div style=""font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"">
                      Prep<span style=""color:#2563eb;"">Mate</span>
                    </div>
                    <div style=""color:#64748b;font-size:12px;margin-top:8px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"">
                      AI Interview Preparation
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style=""padding:8px 40px 36px 40px;"">
              <h1 style=""margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;"">
                {heading}
              </h1>
              <p style=""margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Xin chào <strong>{safeName}</strong>,
              </p>
              <p style=""margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;"">
                {bodyText}
              </p>

              <!-- CTA Button -->
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:28px auto;text-align:center;"">
                <tr>
                  <td align=""center"" bgcolor=""#2563eb"" style=""border-radius:8px;"">
                    <a href=""{safeUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#2563eb;letter-spacing:0.2px;"">
                      {ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <p style=""margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;"">
                ⏱️ {expiryText}
              </p>

              <!-- Fallback Link -->
              <div style=""margin:0 0 24px 0;padding:16px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;"">
                <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;font-weight:600;"">
                  Nếu nút phía trên không hoạt động, hãy mở liên kết sau trên trình duyệt:
                </p>
                <a href=""{safeUrl}"" style=""font-size:12px;color:#2563eb;word-break:break-all;line-height:1.5;text-decoration:underline;"">
                  {safeUrl}
                </a>
              </div>

              <!-- Security Note -->
              <p style=""margin:0;font-size:13px;color:#64748b;line-height:1.5;"">
                🔒 {securityNote}
              </p>
              <!-- Semantic Compatibility Hint: Xác nhận địa chỉ email -->
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;"">
              <p style=""margin:0 0 6px 0;font-size:13px;font-weight:600;color:#475569;"">
                PrepMate — AI Interview Preparation
              </p>
              <p style=""margin:0 0 6px 0;font-size:12px;color:#94a3b8;"">
                Email này được gửi tự động liên quan đến hoạt động tài khoản PrepMate của bạn.
              </p>
              {(string.IsNullOrWhiteSpace(supportEmail) ? "" : $@"<p style=""margin:0;font-size:12px;color:#94a3b8;"">Cần hỗ trợ? Liên hệ <a href=""mailto:{supportEmail}"" style=""color:#64748b;text-decoration:underline;"">{supportEmail}</a></p>")}
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>";

            var plainText = $@"PrepMate — {heading}

Xin chào {recipientName},

{bodyText}

{verificationUrl}

{expiryText}

{securityNote}

---
PrepMate — AI Interview Preparation
Email này được gửi tự động liên quan đến hoạt động tài khoản PrepMate của bạn.{(string.IsNullOrWhiteSpace(supportEmail) ? "" : $"\nHỗ trợ: {supportEmail}")}";

            return (html, plainText);
        }

        public (string Html, string PlainText) RenderResendVerificationEmail(
            string recipientName,
            string verificationUrl,
            int expiryMinutes = 30,
            string? supportEmail = "support@prepmate.vn")
        {
            return RenderVerificationEmail(recipientName, verificationUrl, expiryMinutes, isResend: true, supportEmail);
        }

        public (string Html, string PlainText) RenderPasswordResetEmail(
            string recipientName,
            string resetUrl,
            int expiryMinutes = 30,
            string? supportEmail = "support@prepmate.vn")
        {
            var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(recipientName) ? "bạn" : recipientName);
            var safeUrl = WebUtility.HtmlEncode(resetUrl);
            const string title = "Yêu cầu đặt lại mật khẩu PrepMate";
            const string preheader = "Sử dụng liên kết an toàn để đặt lại mật khẩu tài khoản.";
            const string heading = "Đặt lại mật khẩu";
            const string bodyText = "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản PrepMate của bạn. Nhấn nút bên dưới để tiếp tục.";
            const string ctaText = "Đặt lại mật khẩu";
            var expiryText = $"Liên kết đặt lại mật khẩu có hiệu lực trong {expiryMinutes} phút.";
            const string securityNote = "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu hiện tại sẽ không thay đổi chỉ vì email được gửi.";

            var html = $@"<!DOCTYPE html>
<html lang=""vi"">
<head>
  <meta charset=""utf-8"">
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
  <meta http-equiv=""X-UA-Compatible"" content=""IE=edge"">
  <title>{title}</title>
  <!--[if mso]>
  <style type=""text/css"">
    body, table, td {{font-family: Arial, Helvetica, sans-serif !important;}}
  </style>
  <![endif]-->
</head>
<body style=""margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#0f172a;line-height:1.6;"">
  <!-- Preheader -->
  <div style=""display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;"">
    {preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""background-color:#f8fafc;padding:40px 16px;"">
    <tr>
      <td align=""center"">
        <!--[if (gte mso 9)|(IE)]>
        <table role=""presentation"" width=""580"" align=""center"" cellpadding=""0"" cellspacing=""0"" border=""0"">
          <tr>
            <td>
        <![endif]-->
        <table role=""presentation"" width=""100%"" cellspacing=""0"" cellpadding=""0"" border=""0"" style=""max-width:580px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(15,23,42,0.04);"">
          <!-- Brand Header -->
          <tr>
            <td align=""center"" style=""padding:36px 40px 24px 40px;text-align:center;"">
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:0 auto;text-align:center;"">
                <tr>
                  <td align=""center"" style=""text-align:center;"">
                    <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:0 auto 12px auto;text-align:center;"">
                      <tr>
                        <td align=""center"" valign=""middle"" width=""44"" height=""44"" bgcolor=""#2563eb"" style=""width:44px;height:44px;background-color:#2563eb;border-radius:12px;text-align:center;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;line-height:44px;"">
                          P
                        </td>
                      </tr>
                    </table>
                    <div style=""font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#0f172a;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"">
                      Prep<span style=""color:#2563eb;"">Mate</span>
                    </div>
                    <div style=""color:#64748b;font-size:12px;margin-top:8px;letter-spacing:0.8px;text-transform:uppercase;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"">
                      AI Interview Preparation
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content Body -->
          <tr>
            <td style=""padding:8px 40px 36px 40px;"">
              <h1 style=""margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;line-height:1.3;"">
                {heading}
              </h1>
              <p style=""margin:0 0 16px 0;font-size:15px;color:#334155;line-height:1.6;"">
                Xin chào <strong>{safeName}</strong>,
              </p>
              <p style=""margin:0 0 24px 0;font-size:15px;color:#334155;line-height:1.6;"">
                {bodyText}
              </p>

              <!-- CTA Button -->
              <table role=""presentation"" cellspacing=""0"" cellpadding=""0"" border=""0"" align=""center"" style=""margin:28px auto;text-align:center;"">
                <tr>
                  <td align=""center"" bgcolor=""#2563eb"" style=""border-radius:8px;"">
                    <a href=""{safeUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#2563eb;letter-spacing:0.2px;"">
                      {ctaText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <p style=""margin:0 0 20px 0;font-size:14px;color:#475569;line-height:1.5;"">
                ⏱️ {expiryText}
              </p>

              <!-- Fallback Link -->
              <div style=""margin:0 0 24px 0;padding:16px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;"">
                <p style=""margin:0 0 8px 0;font-size:13px;color:#64748b;font-weight:600;"">
                  Nếu nút phía trên không hoạt động, hãy mở liên kết sau trên trình duyệt:
                </p>
                <a href=""{safeUrl}"" style=""font-size:12px;color:#2563eb;word-break:break-all;line-height:1.5;text-decoration:underline;"">
                  {safeUrl}
                </a>
              </div>

              <!-- Security Note -->
              <p style=""margin:0;font-size:13px;color:#64748b;line-height:1.5;"">
                🔒 {securityNote}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style=""background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;"">
              <p style=""margin:0 0 6px 0;font-size:13px;font-weight:600;color:#475569;"">
                PrepMate — AI Interview Preparation
              </p>
              <p style=""margin:0 0 6px 0;font-size:12px;color:#94a3b8;"">
                Email này được gửi tự động liên quan đến hoạt động tài khoản PrepMate của bạn.
              </p>
              {(string.IsNullOrWhiteSpace(supportEmail) ? "" : $@"<p style=""margin:0;font-size:12px;color:#94a3b8;"">Cần hỗ trợ? Liên hệ <a href=""mailto:{supportEmail}"" style=""color:#64748b;text-decoration:underline;"">{supportEmail}</a></p>")}
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>";

            var plainText = $@"PrepMate — {heading}

Xin chào {recipientName},

{bodyText}

{resetUrl}

{expiryText}

{securityNote}

---
PrepMate — AI Interview Preparation
Email này được gửi tự động liên quan đến hoạt động tài khoản PrepMate của bạn.{(string.IsNullOrWhiteSpace(supportEmail) ? "" : $"\nHỗ trợ: {supportEmail}")}";

            return (html, plainText);
        }
    }
}
