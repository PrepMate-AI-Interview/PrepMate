using Microsoft.AspNetCore.Mvc;
using System;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/health")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetHealth()
        {
            return Ok(new
            {
                status = "ok",
                message = "PrepMate server đang chạy!",
                timestamp = DateTime.UtcNow.ToString("o")
            });
        }
    }
}
