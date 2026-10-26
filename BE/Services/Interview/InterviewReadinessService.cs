using System;
using System.Collections.Generic;
using System.Linq;
using backend.Models;

namespace backend.Services.Interview
{
    public interface IInterviewReadinessService
    {
        InterviewReadinessResult Evaluate(CreateSessionRequest request);
    }

    public class InterviewReadinessService : IInterviewReadinessService
    {
        private static readonly HashSet<string> ValidSeniorityLevels = new(StringComparer.OrdinalIgnoreCase)
        {
            "Intern",
            "Fresher",
            "Junior",
            "Mid-level",
            "Middle",
            "Senior",
            "Lead",
            "Staff",
            "Principal",
            "Manager",
            "Director"
        };

        public InterviewReadinessResult Evaluate(CreateSessionRequest request)
        {
            var result = new InterviewReadinessResult();
            var issues = new List<ReadinessIssue>();
            var suggestions = new List<string>();
            var normalizedContext = new Dictionary<string, string>();

            if (request == null)
            {
                result.Status = ReadinessStatus.NOT_READY;
                result.CanStart = false;
                result.Issues.Add(new ReadinessIssue
                {
                    Field = "request",
                    Code = "REQUEST_EMPTY",
                    Severity = "ERROR",
                    Message = "Dữ liệu yêu cầu khởi tạo phỏng vấn không hợp lệ."
                });
                return result;
            }

            // 1. Mandatory: Target Role / Job Title
            var jobTitle = request.JobTitle?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(jobTitle))
            {
                issues.Add(new ReadinessIssue
                {
                    Field = "JobTitle",
                    Code = "JOB_TITLE_MISSING",
                    Severity = "ERROR",
                    Message = "Vui lòng nhập vị trí ứng tuyển mục tiêu để hệ thống định hình câu hỏi."
                });
            }
            else if (jobTitle.Length < 2)
            {
                issues.Add(new ReadinessIssue
                {
                    Field = "JobTitle",
                    Code = "JOB_TITLE_TOO_SHORT",
                    Severity = "ERROR",
                    Message = "Tên vị trí ứng tuyển quá ngắn (tối thiểu 2 ký tự)."
                });
            }
            else
            {
                normalizedContext["JobTitle"] = jobTitle;
            }

            // 2. Seniority / Experience Level
            var seniority = request.ExperienceLevel?.Trim();
            if (string.IsNullOrWhiteSpace(seniority))
            {
                seniority = "Senior";
                issues.Add(new ReadinessIssue
                {
                    Field = "ExperienceLevel",
                    Code = "SENIORITY_DEFAULTED",
                    Severity = "INFO",
                    Message = "Cấp độ kinh nghiệm chưa được chọn; hệ thống sẽ mặc định đánh giá ở cấp độ Senior."
                });
            }
            else
            {
                if (!ValidSeniorityLevels.Contains(seniority))
                {
                    issues.Add(new ReadinessIssue
                    {
                        Field = "ExperienceLevel",
                        Code = "SENIORITY_UNKNOWN",
                        Severity = "INFO",
                        Message = $"Cấp độ kinh nghiệm '{seniority}' sẽ được điều chỉnh cho phù hợp với tiêu chuẩn đánh giá."
                    });
                }
            }
            normalizedContext["ExperienceLevel"] = seniority;

            // 3. CV & JD Evaluation
            var cvText = request.CvText?.Trim() ?? string.Empty;
            var jdText = request.JdText?.Trim() ?? string.Empty;

            var hasCv = !string.IsNullOrWhiteSpace(cvText);
            var hasJd = !string.IsNullOrWhiteSpace(jdText);

            if (hasCv)
            {
                normalizedContext["CvTextLength"] = cvText.Length.ToString();
            }
            if (hasJd)
            {
                normalizedContext["JdTextLength"] = jdText.Length.ToString();
            }

            // 4. Target Company (Optional)
            var targetCompany = request.TargetCompany?.Trim() ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(targetCompany))
            {
                normalizedContext["TargetCompany"] = targetCompany;
            }

            // 5. Determine Readiness Status
            if (issues.Any(i => i.Severity == "ERROR"))
            {
                result.Status = ReadinessStatus.NOT_READY;
                result.CanStart = false;
                suggestions.Add("Vui lòng hoàn thiện các trường thông tin bắt buộc trước khi bắt đầu.");
            }
            else
            {
                result.CanStart = true;
                if (hasCv && hasJd)
                {
                    result.Status = ReadinessStatus.READY;
                    suggestions.Add("Dữ liệu đầy đủ: Hệ thống sẽ tùy biến câu hỏi theo sát cả CV và yêu cầu JD.");
                }
                else if (hasCv && !hasJd)
                {
                    result.Status = ReadinessStatus.PARTIALLY_READY;
                    issues.Add(new ReadinessIssue
                    {
                        Field = "JdText",
                        Code = "JD_NOT_PROVIDED",
                        Severity = "WARNING",
                        Message = "Chưa cung cấp JD cụ thể; câu hỏi sẽ kết hợp hồ sơ CV và khung năng lực chuẩn ngành."
                    });
                    suggestions.Add("Bạn có thể bổ sung JD để câu hỏi bám sát tiêu chí tuyển dụng của công ty hơn.");
                }
                else if (!hasCv && hasJd)
                {
                    result.Status = ReadinessStatus.PARTIALLY_READY;
                    issues.Add(new ReadinessIssue
                    {
                        Field = "CvText",
                        Code = "CV_NOT_PROVIDED",
                        Severity = "WARNING",
                        Message = "Chưa tải lên CV; buổi phỏng vấn sẽ tập trung thẩm định các yêu cầu được mô tả trong JD."
                    });
                    suggestions.Add("Bạn có thể tải lên CV để AI đối chiếu trực tiếp kinh nghiệm của bạn với JD.");
                }
                else
                {
                    result.Status = ReadinessStatus.PARTIALLY_READY;
                    issues.Add(new ReadinessIssue
                    {
                        Field = "CvAndJd",
                        Code = "CV_AND_JD_NOT_PROVIDED",
                        Severity = "WARNING",
                        Message = $"Chưa cung cấp CV và JD; hệ thống sẽ phỏng vấn theo khung năng lực tiêu chuẩn cho vị trí {jobTitle} ({seniority})."
                    });
                    suggestions.Add("Cung cấp CV hoặc JD sẽ giúp buổi phỏng vấn mang tính cá nhân hóa cao hơn.");
                }
            }

            result.Issues = issues;
            result.Suggestions = suggestions;
            result.NormalizedContext = normalizedContext;
            return result;
        }
    }
}
