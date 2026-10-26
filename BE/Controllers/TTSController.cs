using System;
using System.Threading;
using System.Threading.Tasks;
using backend.Services.TTS;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/tts")]
    public class TTSController : ControllerBase
    {
        private readonly IElevenLabsTtsService _ttsService;

        public TTSController(IElevenLabsTtsService ttsService)
        {
            _ttsService = ttsService;
        }

        // GET api/tts/status
        [HttpGet("status")]
        public IActionResult GetStatus()
        {
            return Ok(new
            {
                configured = _ttsService.IsConfigured,
                provider = "elevenlabs",
                defaultModel = ElevenLabsTtsService.DefaultTtsModel,
                defaultTtsModel = ElevenLabsTtsService.DefaultTtsModel,
                defaultVoiceDesignModel = ElevenLabsTtsService.DefaultVoiceDesignModel,
                supportedSpeedRange = new { min = 0.7, max = 1.2, @default = 1.0 },
                zeroRetentionEnabled = _ttsService.ZeroRetentionEnabled
            });
        }

        // GET api/tts/voices
        [HttpGet("voices")]
        public async Task<IActionResult> GetVoices(CancellationToken cancellationToken)
        {
            var result = await _ttsService.GetVoicesAsync(cancellationToken);
            if (!result.Configured)
            {
                return StatusCode(503, new
                {
                    error = result.Error,
                    message = result.Message,
                    configured = false,
                    voices = Array.Empty<object>()
                });
            }

            if (!result.Success)
            {
                return StatusCode(502, new
                {
                    error = result.Error,
                    message = result.Message,
                    configured = true,
                    voices = Array.Empty<object>()
                });
            }

            return Ok(new
            {
                configured = true,
                count = result.Voices.Count,
                voices = result.Voices
            });
        }

        // POST api/tts/speak
        [HttpPost("speak")]
        public async Task<IActionResult> Speak([FromBody] TtsSpeakRequest request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest(new { error = "INVALID_REQUEST", message = "Dữ liệu yêu cầu phát âm không hợp lệ." });
            }

            var result = await _ttsService.SpeakAsync(request, cancellationToken);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new
                {
                    error = result.ErrorCode,
                    message = result.ErrorMessage
                });
            }

            if (result.AudioBytes == null || result.AudioBytes.Length == 0)
            {
                return StatusCode(502, new { error = "EMPTY_AUDIO", message = "Không nhận được luồng âm thanh từ ElevenLabs." });
            }

            return File(result.AudioBytes, result.ContentType, enableRangeProcessing: true);
        }

        // POST api/tts/voice-design/preview
        [HttpPost("voice-design/preview")]
        public async Task<IActionResult> CreateVoiceDesignPreview([FromBody] VoiceDesignPreviewRequest request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest(new { error = "INVALID_REQUEST", message = "Dữ liệu mô tả giọng không hợp lệ." });
            }

            var result = await _ttsService.CreateVoiceDesignPreviewAsync(request, cancellationToken);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new
                {
                    error = result.Error,
                    message = result.Message
                });
            }

            return Ok(new
            {
                success = true,
                text = result.Text,
                previews = result.Previews
            });
        }

        // POST api/tts/voice-design/save
        [HttpPost("voice-design/save")]
        public async Task<IActionResult> SaveVoiceDesign([FromBody] VoiceDesignSaveRequest request, CancellationToken cancellationToken)
        {
            if (request == null)
            {
                return BadRequest(new { error = "INVALID_REQUEST", message = "Dữ liệu lưu giọng không hợp lệ." });
            }

            var result = await _ttsService.SaveVoiceFromPreviewAsync(request, cancellationToken);
            if (!result.Success)
            {
                return StatusCode(result.StatusCode, new
                {
                    error = result.Error,
                    message = result.Message
                });
            }

            return Ok(new
            {
                success = true,
                voiceId = result.VoiceId,
                name = result.Name
            });
        }
    }
}
