using System;
using System.Threading.Tasks;
using backend.Models.QBank;
using backend.Services.QBank;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/qbank")]
    public class QBankController : ControllerBase
    {
        private readonly IQBankService _qBankService;

        public QBankController(IQBankService qBankService)
        {
            _qBankService = qBankService;
        }

        [HttpGet("questions")]
        public async Task<IActionResult> GetQuestions(
            [FromQuery] string? keyword,
            [FromQuery] string? industry,
            [FromQuery] string? company,
            [FromQuery] string? difficulty,
            [FromQuery] string? seniority,
            [FromQuery] string? questionType,
            [FromQuery] string? language,
            [FromQuery] string? provenance,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 6,
            [FromQuery] string? sortBy = "recommended")
        {
            if (page < 1) page = 1;
            if (page > 100) page = 100;
            if (pageSize < 1) pageSize = 6;
            if (pageSize > 50) pageSize = 50;

            var query = new QBankQuery
            {
                Keyword = keyword,
                Industry = industry,
                Company = company,
                Difficulty = difficulty,
                Seniority = seniority,
                QuestionType = questionType,
                Language = language,
                Provenance = provenance,
                Page = page,
                PageSize = pageSize,
                SortBy = sortBy ?? "recommended"
            };

            var result = await _qBankService.SearchQuestionsAsync(query);
            return Ok(result);
        }

        [HttpGet("questions/{id}")]
        public async Task<IActionResult> GetQuestionById(string id)
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return BadRequest(new { error = "Mã câu hỏi không hợp lệ." });
            }

            var question = await _qBankService.GetQuestionByIdAsync(id);
            if (question == null)
            {
                return NotFound(new { error = $"Không tìm thấy câu hỏi với mã '{id}'." });
            }

            return Ok(question);
        }

        [HttpGet("sources")]
        public async Task<IActionResult> GetSources()
        {
            var sources = await _qBankService.GetSourcesAsync();
            return Ok(new { total = sources.Count, sources });
        }

        [HttpGet("taxonomy")]
        public async Task<IActionResult> GetTaxonomy()
        {
            var taxonomy = await _qBankService.GetTaxonomyAsync();
            return Ok(taxonomy);
        }
    }
}
